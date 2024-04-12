import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { group } from 'k6'
import { SharedArray } from 'k6/data'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import encoding from 'k6/encoding'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('ninoCheck', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('ninoCheck', LoadProfile.short, 30)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  ninoScenario1: [
    'B02_Nino_01_EntryFromStub',
    'B02_Nino_02_AddUser',
    'B02_Nino_03_SearchNiNo',
    'B02_Nino_03_SearchNiNo::01_NiNOCRICall',
    'B02_Nino_03_SearchNiNo::02_CoreStubCall'
  ]
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
  describeProfile(loadProfile)
}

const env = { ipvCoreStub: getEnv('IDENTITY_CORE_STUB_URL') }

const stubCreds = {
  userName: getEnv('IDENTITY_CORE_STUB_USERNAME'),
  password: getEnv('IDENTITY_CORE_STUB_PASSWORD')
}

interface nino {
  firstName: string
  lastName: string
  birthDay: string
  birthMonth: string
  birthYear: string
  niNumber: string
}

const csvData1: nino[] = new SharedArray('csvDataNino', () => {
  return open('./data/ninoCRIData.csv')
    .split('\n')
    .slice(1)
    .map((s) => {
      const data = s.split(',')
      return {
        firstName: data[0],
        lastName: data[1],
        birthDay: data[2],
        birthMonth: data[3],
        birthYear: data[4],
        niNumber: data[5]
      }
    })
})

export function ninoCheck(): void {
  const groups = groupMap.ninoScenario1
  let res: Response
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  const userNino = csvData1[Math.floor(Math.random() * csvData1.length)]
  iterationsStarted.add(1)

  // B02_Nino_01_EntryFromStub
  res = group(groups[0], () =>
    timeRequest(
      () =>
        http.get(env.ipvCoreStub + '/edit-user?cri=check-hmrc-build', {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('Edit User') }
    )
  )

  sleepBetween(1, 3)

  // B02_Nino_02_AddUser
  res = group(groups[1], () =>
    timeRequest(
      () =>
        res.submitForm({
          fields: {
            firstName: userNino.firstName,
            surname: userNino.lastName,
            'dateOfBirth-day': userNino.birthDay,
            'dateOfBirth-month': userNino.birthMonth,
            'dateOfBirth-year': userNino.birthYear
          },
          submitSelector: '#govuk-button button',
          params: {
            headers: { Authorization: `Basic ${encodedCredentials}` }
          }
        }),
      { isStatusCode200, ...pageContentCheck('national insurance number') }
    )
  )

  sleepBetween(1, 3)

  // B02_Nino_03_SearchNiNo
  group(groups[2], () => {
    timeRequest(() => {
      // 01_NiNOCRICall
      res = group(groups[3].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: { nationalInsuranceNumber: userNino.niNumber },
              params: { redirects: 1 },
              submitSelector: '#continue'
            }),
          { isStatusCode302 }
        )
      )
      // 02_CoreStubCall
      res = group(groups[4].split('::')[1], () =>
        timeRequest(
          () =>
            http.get(res.headers.Location, {
              headers: { Authorization: `Basic ${encodedCredentials}` }
            }),
          { isStatusCode200, ...pageContentCheck('Verifiable') }
        )
      )
    }, {})
  })
  iterationsCompleted.add(1)
}
