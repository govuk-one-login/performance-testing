import { sleep, group, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { Trend } from 'k6/metrics'
import { selectProfile, type ProfileList, describeProfile } from '../../common/utils/config/load-profiles'
import { env, encodedCredentials } from '../utils/config'
import { isStatusCode200, isStatusCode302, validatePageContent } from '../utils/assertions'

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
  load: {
    kbvScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1500,
      stages: [
        { target: 30, duration: '10m' } // Ramp up to 30 iterations per second in 10 minutes
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

const transactionDuration = new Trend('duration')

export function kbvScenario1 (): void {
  let res: Response
  let csrfToken: string
  interface kbvAnswers {
    kbvAns1: string
    kbvAns2: string
    kbvAns3: string
  }
  const kbvAnsJSON: kbvAnswers = JSON.parse(kbvAnswersOBJ.kbvAnswers)

  group(
    'B01_KBV_01_CoreStubEditUserContinue POST',
    function () {
      const startTime = Date.now()
      res = http.get(
        env.ipvCoreStub + '/authorize?cri=kbv-cri-build&rowNumber=197',
        {
          headers: { Authorization: `Basic ${encodedCredentials}` },
          tags: { name: 'B01_KBV_01_CoreStubEditUserContinue' }
        }
      )
      const endTime = Date.now()
      isStatusCode200(res) && validatePageContent(res, 'You can find this amount on your loan agreement')
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')

      csrfToken = getCSRF(res)
    }
  )

  sleep(Math.random() * 3)

  group('B01_KBV_02_KBVQuestion1 POST', function () {
    const startTime = Date.now()
    res = http.post(
      env.kbvEndPoint + '/kbv/question',
      {
        Q00042: kbvAnsJSON.kbvAns1,
        continue: '',
        'x-csrf-token': csrfToken
      },
      {
        tags: { name: 'B01_KBV_02_KBVQuestion1' }
      }
    )
    const endTime = Date.now()
    isStatusCode200(res) && validatePageContent(res, 'This includes any interest')
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B01_KBV_03_KBVQuestion2 POST', function () {
    const startTime = Date.now()
    res = http.post(
      env.kbvEndPoint + '/kbv/question',
      {
        Q00015: kbvAnsJSON.kbvAns2,
        continue: '',
        'x-csrf-token': csrfToken
      },
      {
        tags: { name: 'B01_KBV_03_KBVQuestion2' }
      }
    )
    const endTime = Date.now()
    isStatusCode200(res) && validatePageContent(res, 'Think about the amount you agreed to pay back every month')
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B01_KBV_04_KBVQuestion3 POST', function () {
    const startTime1 = Date.now()
    res = http.post(
      env.kbvEndPoint + '/kbv/question',
      {
        Q00018: kbvAnsJSON.kbvAns3,
        continue: '',
        'x-csrf-token': csrfToken
      },
      {
        redirects: 2,
        tags: { name: 'B01_KBV_04_KBVQuestion3_KBVCall' }
      }
    )
    const endTime1 = Date.now()
    isStatusCode302(res)
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location,
      {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B01_KBV_04_KBVQuestion3_CoreStubCall' }
      }
    )
    const endTime2 = Date.now()
    isStatusCode200(res) && validatePageContent(res, 'verificationScore&quot;: 2')
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })
}

function getCSRF (r: Response): string {
  return r.html().find("input[name='x-csrf-token']").val() ?? ''
}
