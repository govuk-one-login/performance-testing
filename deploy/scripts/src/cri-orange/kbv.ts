import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { group } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { env, encodedCredentials } from './utils/config'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'

const profiles: ProfileList = {
  smoke: {
    kbvScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'kbvScenario1'
    }
  },
  lowVolumeTest: {
    kbvScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 5, duration: '2m' }, // Ramp up to 5 iterations per second in 2 minutes
        { target: 5, duration: '15m' }, // Maintain steady state at 5 iterations per second for 15 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'kbvScenario1'
    }
  },
  stress: {
    kbvScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 408,
      stages: [
        { target: 14, duration: '15m' }, // Ramp up to 14 iterations per second in 15 minutes
        { target: 14, duration: '30m' }, // Maintain steady state at 14 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'kbvScenario1'
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

const kbvAnswersOBJ = {
  kbvAnswers: __ENV.IDENTITY_KBV_ANSWERS
}

export function kbvScenario1 (): void {
  let res: Response
  interface kbvAnswers {
    kbvAns1: string
    kbvAns2: string
    kbvAns3: string
  }
  const kbvAnsJSON: kbvAnswers = JSON.parse(kbvAnswersOBJ.kbvAnswers)
  iterationsStarted.add(1)

  res = group('B01_KBV_01_CoreStubEditUserContinue POST', () =>
    timeRequest(() => http.get(
      env.ipvCoreStub + '/authorize?cri=kbv-cri-' + env.envName + '&rowNumber=197',
      {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B01_KBV_01_CoreStubEditUserContinue' }
      }),
    { isStatusCode200, ...pageContentCheck('You can find this amount on your loan agreement') }))

  sleepBetween(1, 3)

  res = group('B01_KBV_02_KBVQuestion1 POST', () =>
    timeRequest(() => res.submitForm({
      fields: { Q00042: kbvAnsJSON.kbvAns1 },
      params: { tags: { name: 'B01_KBV_02_KBVQuestion1' } },
      submitSelector: '#continue'
    }),
    { isStatusCode200, ...pageContentCheck('This includes any interest') }))

  sleepBetween(1, 3)

  res = group('B01_KBV_03_KBVQuestion2 POST', () =>
    timeRequest(() => res.submitForm({
      fields: { Q00015: kbvAnsJSON.kbvAns2 },
      params: { tags: { name: 'B01_KBV_03_KBVQuestion2' } },
      submitSelector: '#continue'
    }),
    { isStatusCode200, ...pageContentCheck('Think about the amount you agreed to pay back every month') }))

  sleepBetween(1, 3)

  group('B01_KBV_04_KBVQuestion3 POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: { Q00018: kbvAnsJSON.kbvAns3 },
      params: {
        redirects: 2,
        tags: { name: 'B01_KBV_04_KBVQuestion3_KBVCall' }
      },
      submitSelector: '#continue'
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location,
      {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B01_KBV_04_KBVQuestion3_CoreStubCall' }
      }),
    { isStatusCode200, ...pageContentCheck('verificationScore&quot;: 2') })
  })
  iterationsCompleted.add(1)
}
