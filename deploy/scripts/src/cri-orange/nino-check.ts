import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { group } from 'k6'
import { SharedArray } from 'k6/data'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import encoding from 'k6/encoding'
import exec from 'k6/execution'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'

const profiles: ProfileList = {
  smoke: {
    ninoScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '5s' } // Ramps up to target load
      ],
      exec: 'ninoScenario1'
    }
  },
  lowVolumeTest: {
    ninoScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 900,
      stages: [
        { target: 30, duration: '5m' }, // Ramp up to 30 iterations per second in 5 minutes
        { target: 30, duration: '15m' }, // Maintain steady state at 30 iterations per second for 15 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'ninoScenario1'
    }
  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'], // 95th percentile response time <=1000ms, 99th percentile response time <=2500ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
}

export function setup (): void {
  describeProfile(loadProfile)
}

const env = {
  ipvCoreStub: __ENV.IDENTITY_CORE_STUB_URL }

const stubCreds = {
  userName: __ENV.IDENTITY_CORE_STUB_USERNAME,
  password: __ENV.IDENTITY_CORE_STUB_PASSWORD
}

interface nino {
  niNumber: string
}

const csvData1: nino[] = new SharedArray('csvDataNino', () => {
  return open('./data/ninoCRIDataStub.csv').split('\n').slice(1).map((s) => {
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

export function ninoScenario1 (): void {
  let res: Response
  const user1Nino = csvData1[exec.scenario.iterationInTest % csvData1.length]
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  const userNino = csvData1[Math.floor(Math.random() * csvData1.length)]
  iterationsStarted.add(1)

  res = group('B02_Nino_01_EntryFromStub  GET', () =>
    timeRequest(() => http.get(env.ipvCoreStub + '/edit-user?cri=check-hmrc-build',
      {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B02_Nino_01_EntryFromStub' }
      }
    ),
    { isStatusCode200, ...pageContentCheck('Edit User') })
  )

  sleepBetween(1, 3)

  res = group('B02_Nino_02_AddUser POST', () =>
    timeRequest(() => res.submitForm({
      fields: {
        firstName: userNino.firstName,
        surname: userNino.lastName,
        'dateOfBirth-day': userNino.birthDay,
        'dateOfBirth-month': userNino.birthMonth,
        'dateOfBirth-year': userNino.birthYear
        },
      submitSelector: '#govuk-button button',
      params: {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B02_Nino_02_AddUser' }
        }
    }),
    { isStatusCode200, ...pageContentCheck('national insurance number') }))

  sleepBetween(1, 3)

  group('B02_Nino_03_SearchNiNo POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: { nationalInsuranceNumber: userNino.niNumber },
      params: {
        redirects: 1,
        tags: { name: 'B02_Nino_03_SearchNiNo' }
      },
      submitSelector: '#continue'
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location,
      {
      headers: { Authorization: `Basic ${encodedCredentials}` },
      tags: { name: 'B02_Nino_03_SearchNiNo' }
      }),
    { isStatusCode200, ...pageContentCheck('Verifiable') })
  })
  iterationsCompleted.add(1)
}
