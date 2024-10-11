import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import http, { RefinedParams, ResponseType, type Response } from 'k6/http'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { getThresholds } from '../common/utils/config/thresholds'
import { timeGroup } from '../common/utils/request/timing'
import { getEnv } from '../common/utils/config/environment-variables'
import encoding from 'k6/encoding'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { Checkers, fail } from 'k6'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('hmrc_kbv', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('hmrc_kbv', LoadProfile.short, 5)
  },
  stress: {
    ...createScenario('hmrc_kbv', LoadProfile.full, 14)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  hmrc_kbv: [
    'B01_HMRC_KBV_01_EditUser',
    'B01_HMRC_KBV_01_EditUser::01_CoreStubCall',
    'B01_HMRC_KBV_01_EditUser::02_CRICall',
    'B01_HMRC_KBV_02_ClickStart',
    'B01_HMRC_KBV_03_SelfAssessmentQuestion',
    'B01_HMRC_KBV_04_P60Question',
    'B01_HMRC_KBV_05_TaxCreditsQuestion',
    'B01_HMRC_KBV_06_StubReturn'
  ]
} as const

const env = {
  ipvCoreStub: getEnv('IDENTITY_CORE_STUB_URL'),
  envName: getEnv('ENVIRONMENT').toLocaleLowerCase()
}

const stubCreds = {
  userName: getEnv('IDENTITY_CORE_STUB_USERNAME'),
  password: getEnv('IDENTITY_CORE_STUB_PASSWORD')
}

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
  describeProfile(loadProfile)
}

export function hmrc_kbv(): void {
  const groups = groupMap.hmrc_kbv
  let res: Response
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  iterationsStarted.add(1)

  function validatePageContent(r: Response): boolean {
    const body = r.body as string
    return (
      body.includes('Self Assessment payment') ||
      body.includes('amount from your P60') ||
      body.includes('tax credits payment amount')
    )
  }

  // B01_HMRC_KBV_01_EditUser
  timeGroup(groups[0], () => {
    // 01_CoreStubCall
    res = timeGroup(
      groups[1].split('::')[1],
      () =>
        http.post(
          env.ipvCoreStub + '/edit-user',
          {
            cri: `hmrc-kbv-cri-${env.envName}`,
            rowNumber: '23',
            firstName: 'ALBERT',
            surname: 'ARKIL',
            'dateOfBirth-day': '20',
            'dateOfBirth-month': '8',
            'dateOfBirth-year': '1949',
            buildingNumber: '3',
            buildingName: '',
            street: 'STOCKS+HILL',
            townCity: 'WORKINGTON',
            postCode: 'CA14+5PH',
            validFromDay: '1',
            validFromMonth: '1',
            validFromYear: '2021',
            validUntilDay: '',
            validUntilMonth: '',
            validUntilYear: '',
            nationalInsuranceNumber: 'AL000000S',
            'SecondaryUKAddress.buildingNumber': '',
            'SecondaryUKAddress.buildingName': '',
            'SecondaryUKAddress.street': '',
            'SecondaryUKAddress.townCity': '',
            'SecondaryUKAddress.postCode': '',
            'SecondaryUKAddress.validFromDay': '',
            'SecondaryUKAddress.validFromMonth': '',
            'SecondaryUKAddress.validFromYear': '',
            'SecondaryUKAddress.validUntilDay': '',
            'SecondaryUKAddress.validUntilMonth': '',
            'SecondaryUKAddress.validUntilYear': ''
          },
          {
            headers: { Authorization: `Basic ${encodedCredentials}` },
            redirects: 0
          }
        ),
      { isStatusCode302 }
    )

    // 02_CRICall
    res = timeGroup(groups[2].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Answer some security questions')
    })
  })

  // B01_HMRC_KBV_02_ClickStart
  res = timeGroup(groups[3], () => res.submitForm({ submitSelector: '#start' }), {
    isStatusCode200,
    validatePageContent
  })

  // Loop for three KBV questions
  for (let i = 0; i < 3; i++) {
    const body = res.body as string
    let checks: Checkers<Response> = {
      isStatusCode200,
      validatePageContent
    }
    let params: RefinedParams<ResponseType> = {}
    if (i == 2) {
      checks = { isStatusCode302 }
      params = { redirects: 3 }
    }

    if (body.includes('Self Assessment payment')) {
      // B01_HMRC_KBV_03_SelfAssessmentQuestion
      res = timeGroup(
        groups[4],
        () =>
          res.submitForm({
            fields: {
              'selfAssessmentPaymentDate-day': '1',
              'selfAssessmentPaymentDate-month': '1',
              'selfAssessmentPaymentDate-year': '2024',
              selfAssessmentPaymentAmount: '300.00'
            },
            params
          }),
        checks
      )
    } else if (body.includes('amount from your P60')) {
      // B01_HMRC_KBV_04_P60Question
      res = timeGroup(
        groups[5],
        () => res.submitForm({ fields: { 'rti-p60-earnings-above-pt': '10045' }, params }),
        checks
      )
    } else if (body.includes('tax credits payment amount')) {
      // B01_HMRC_KBV_05_TaxCreditsQuestion
      res = timeGroup(groups[6], () => res.submitForm({ fields: { 'tc-amount': '123.45' }, params }), checks)
    } else {
      fail('KBV question not found')
    }
  }

  // B01_HMRC_KBV_06_StubReturn
  res = timeGroup(
    groups[7],
    () =>
      http.get(res.headers.Location, {
        headers: { Authorization: `Basic ${encodedCredentials}` }
      }),
    { isStatusCode200, ...pageContentCheck('Verifiable') }
  )

  iterationsCompleted.add(1)
}
