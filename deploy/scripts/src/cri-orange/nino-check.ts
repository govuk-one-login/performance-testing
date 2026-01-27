import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { SharedArray } from 'k6/data'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import encoding from 'k6/encoding'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI3SpikeSignUpScenario,
  createI4PeakTestSignUpScenario
} from '../common/utils/config/load-profiles'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('ninoCheck', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('ninoCheck', LoadProfile.short, 5)
  },
  lowVolumePERF007Test: {
    ninoCheck: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1m',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 1, duration: '60s' },
        { target: 1, duration: '180s' }
      ],
      exec: 'ninoCheck'
    }
  },
  perf006Iteration1: {
    ninoCheck: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 50, duration: '51s' },
        { target: 50, duration: '15m' }
      ],
      exec: 'ninoCheck'
    }
  },
  spikeI2LowTraffic: {
    ...createScenario('ninoCheck', LoadProfile.spikeI2LowTraffic, 1) //rounded to 1 from 0.4 based on the iteration 2 plan
  },

  perf006Iteration2PeakTest: {
    ninoCheck: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 1, duration: '1s' },
        { target: 1, duration: '30m' }
      ],
      exec: 'ninoCheck'
    }
  },
  perf006Iteration3PeakTest: {
    ninoCheck: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 2, duration: '2s' },
        { target: 2, duration: '30m' }
      ],
      exec: 'ninoCheck'
    }
  },
  perf006Iteration3SpikeTest: {
    ...createI3SpikeSignUpScenario('ninoCheck', 5, 6, 6)
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('ninoCheck', 5, 6, 6)
  },
  perf006Iteration4SpikeTest: {
    ...createI3SpikeSignUpScenario('ninoCheck', 11, 6, 12)
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignUpScenario('ninoCheck', 6, 6, 7)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('ninoCheck', 2, 6, 3)
  },
  perf006Iteration8SpikeTest: {
    ...createI3SpikeSignUpScenario('ninoCheck', 10, 6, 11)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  ninoCheck: [
    'B02_Nino_01_EntryFromStub',
    'B02_Nino_01_EntryFromStub::01_CoreStubCall',
    'B02_Nino_01_EntryFromStub::02_NiNOCRICall',
    'B02_Nino_02_SearchNiNo',
    'B02_Nino_02_SearchNiNo::01_NiNOCRICall',
    'B02_Nino_02_SearchNiNo::02_CoreStubCall'
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

const env = {
  ipvCoreStub: getEnv('IDENTITY_CORE_STUB_URL'),
  envName: getEnv('ENVIRONMENT')
}

const stubCreds = {
  userName: getEnv('IDENTITY_CORE_STUB_USERNAME'),
  password: getEnv('IDENTITY_CORE_STUB_PASSWORD')
}

interface Nino {
  firstName: string
  lastName: string
  birthDay: string
  birthMonth: string
  birthYear: string
  niNumber: string
}

const csvData1: Nino[] = new SharedArray('csvDataNino', () => {
  return open('./data/ninoCRIData.csv')
    .split('\n')
    .slice(1)
    .map(s => {
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
  const groups = groupMap.ninoCheck
  let res: Response
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  const userNino = csvData1[Math.floor(Math.random() * csvData1.length)]
  iterationsStarted.add(1)

  // B02_Nino_01_EntryFromStubEditUser
  timeGroup(groups[0], () => {
    // 01_CoreStubCall
    res = timeGroup(
      groups[1].split('::')[1],
      () =>
        http.post(
          env.ipvCoreStub + '/edit-user',
          {
            cri: `check-hmrc-${env.envName}`,
            rowNumber: '0',
            firstName: userNino.firstName,
            surname: userNino.lastName,
            'dateOfBirth-day': userNino.birthDay,
            'dateOfBirth-month': userNino.birthMonth,
            'dateOfBirth-year': userNino.birthYear,
            buildingNumber: '',
            buildingName: '',
            street: '',
            townCity: '',
            postCode: '',
            validFromDay: '',
            validFromMonth: '',
            validFromYear: '',
            validUntilDay: '',
            validUntilMonth: '',
            validUntilYear: '',
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
    // 01_CRICall
    res = timeGroup(groups[2].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Enter your National Insurance number')
    })
  })

  sleepBetween(1, 3)

  // B02_Nino_02_SearchNiNo
  timeGroup(groups[3], () => {
    // 01_NiNOCRICall
    res = timeGroup(
      groups[4].split('::')[1],
      () =>
        res.submitForm({
          fields: { nationalInsuranceNumber: userNino.niNumber },
          params: { redirects: 1 },
          submitSelector: '#continue'
        }),
      { isStatusCode302 }
    )
    // 02_CoreStubCall
    res = timeGroup(
      groups[5].split('::')[1],
      () =>
        http.get(res.headers.Location, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('Verifiable') }
    )
  })
  iterationsCompleted.add(1)
}
