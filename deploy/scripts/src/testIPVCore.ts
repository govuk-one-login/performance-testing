import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { Trend } from 'k6/metrics'
import { selectProfile, type ProfileList, describeProfile } from './utils/config/load-profiles'

const profiles: ProfileList = {
  smoke: {
    coreScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1m',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '5m' } // Ramps up to target load
      ],
      exec: 'coreScenario1'
    }
  },
  load: {
    coreScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5000,
      stages: [
        { target: 30, duration: '30m' }, // Ramp up to 30 iterations per second in 30 minutes
        { target: 30, duration: '60m' }, // Steady State of 1 hour at the ramp up load i.e. 30 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'coreScenario1'
    }
  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95th percntile response time <1000ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
}

const passportData = open('./data/passportStub.json')
const addressData = open('./data/addressStub.json')
const fraudData = open('./data/fraudStub.json')
const kbvData = open('./data/kbvData.json')

export function setup (): void {
  describeProfile(loadProfile)
}

const env = {
  orchStubEndPoint: __ENV.ORCH_STUB_URL,
  coreEndPoint: __ENV.CORE_URL
}

const transactionDuration = new Trend('duration')

export function coreScenario1 (): void {
  let res: Response
  let csrfToken: string
  let resourceID: string
  let uniqueUserID: string
  let passportStubURL: string
  let addressStubURL: string
  let fraudStubURL: string
  let kbvStubURL: string

  group(
    'B01_Core_01_LaunchOrchestratorStub GET',
    function () {
      const startTime = Date.now()
      res = http.get(env.orchStubEndPoint,
        {
          tags: { name: 'B01_Core_01_LaunchOrchestratorStub' }
        }
      )
      const endTime = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('Choose a user id value')
      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')

      uniqueUserID = res.html().find('select[name=userIdSelect]>option').last().val() ?? fail('User UUID not found')
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_02_SelectUserIDContinue GET',
    function () {
      const startTime = Date.now()
      res = http.get(
        env.orchStubEndPoint + `/authorize?journeyType=full&userIdSelect=${uniqueUserID}&userIdText=`,
        {
          tags: { name: 'B01_Core_02_SelectUserIDContinue' }
        }
      )
      const endTime = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('You’ve signed in to GOV.UK One Login')
      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')

      csrfToken = getCSRF(res)
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_03_ClickContinueAfterLogin POST',
    function () {
      const startTime = Date.now()
      res = http.post(
        env.coreEndPoint + '/ipv/page/page-ipv-identity-start',
        {
          _csrf: csrfToken
        },
        {
          tags: { name: 'B01_Core_03_ClickContinueAfterLogin' }
        }
      )
      const endTime = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('Enter the details from your photo ID and answer security questions')
      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')

      csrfToken = getCSRF(res)
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_04_ContinueOnPYIStartPage POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        env.coreEndPoint + '/ipv/page/page-multiple-doc-check',
        {
          _csrf: csrfToken,
          journey: 'next/passport'
        },
        {
          redirects: 0,
          tags: { name: 'B01_Core_04_ContinueOnPYIStartPage_01_Core' }
        }
      )
      const endTime1 = Date.now()

      check(res, {
        'is status 302': (r) => r.status === 302
      })
        ? transactionDuration.add(endTime1 - startTime1)
        : fail('Response Validation Failed')

      passportStubURL = res.headers.Location

      const startTime2 = Date.now()
      res = http.get(res.headers.Location,
        {
          tags: { name: 'B01_Core_04_ContinueOnPYIStartPage_02_PassStub' }
        }
      )
      const endTime2 = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('UK Passport (Stub)')
      })
        ? transactionDuration.add(endTime2 - startTime2)
        : fail('Response Validation Failed')

      resourceID = getResourceID(res)
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_05_PassportDataContinue POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        passportStubURL,
        {
          jsonPayload: passportData,
          strengthScore: '4',
          validityScore: '2',
          evidenceJsonPayload: '',
          expHours: '0',
          expMinutes: '0',
          expSeconds: '0',
          ci: '',
          requested_oauth_error_endpoint: 'auth',
          requested_oauth_error: 'none',
          requested_oauth_error_description: 'This error was triggered manually in the stub CRI',
          resourceId: resourceID,
          submit: 'Submit data and generate auth code'
        },
        {
          redirects: 0,
          tags: { name: 'B01_Core_05_PassportDataContinue_1_PassStub' }
        }
      )
      const endTime1 = Date.now()

      check(res, {
        'is status 302': (r) => r.status === 302
      })
        ? transactionDuration.add(endTime1 - startTime1)
        : fail('Response Validation Failed')

      const startTime2 = Date.now()
      res = http.get(res.headers.Location,
        {
          redirects: 0,
          tags: { name: 'B01_Core_05_PassportDataContinue_2_Core' }
        }
      )
      const endTime2 = Date.now()

      check(res, {
        'is status 302': (r) => r.status === 302
      })
        ? transactionDuration.add(endTime2 - startTime2)
        : fail('Response Validation Failed')

      addressStubURL = res.headers.Location

      const startTime3 = Date.now()
      res = http.get(res.headers.Location,
        {
          tags: { name: 'B01_Core_05_PassportDataContinue_3_AddStub' }
        }
      )
      const endTime3 = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('Address (Stub)')
      })
        ? transactionDuration.add(endTime3 - startTime3)
        : fail('Response Validation Failed')

      resourceID = getResourceID(res)
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_06_AddrDataContinue POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        addressStubURL,
        {
          jsonPayload: addressData,
          expHours: '0',
          expMinutes: '0',
          expSeconds: '0',
          ci: '',
          requested_oauth_error_endpoint: 'auth',
          requested_oauth_error: 'none',
          requested_oauth_error_description: 'This error was triggered manually in the stub CRI',
          resourceId: resourceID,
          submit: 'Submit data and generate auth code'
        },
        {
          redirects: 0,
          tags: { name: 'B01_Core_06_AddrDataContinue_1_AddStub' }
        }
      )
      const endTime1 = Date.now()

      check(res, {
        'is status 302': (r) => r.status === 302
      })
        ? transactionDuration.add(endTime1 - startTime1)
        : fail('Response Validation Failed')

      const startTime2 = Date.now()
      res = http.get(res.headers.Location,
        {
          redirects: 0,
          tags: { name: 'B01_Core_06_AddrDataContinue_2_Core' }
        }
      )
      const endTime2 = Date.now()

      check(res, {
        'is status 302': (r) => r.status === 302
      })
        ? transactionDuration.add(endTime2 - startTime2)
        : fail('Response Validation Failed')

      fraudStubURL = res.headers.Location

      const startTime3 = Date.now()
      res = http.get(res.headers.Location,
        {
          tags: { name: 'B01_Core_06_AddrDataContinue_3_FraudStub' }
        }
      )
      const endTime3 = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('Fraud Check (Stub)')
      })
        ? transactionDuration.add(endTime3 - startTime3)
        : fail('Response Validation Failed')

      resourceID = getResourceID(res)
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_07_FraudDataContinue POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        fraudStubURL,
        {
          jsonPayload: fraudData,
          identityFraudScore: '2',
          evidenceJsonPayload: '',
          expHours: '0',
          expMinutes: '0',
          expSeconds: '0',
          ci: '',
          requested_oauth_error_endpoint: 'auth',
          requested_oauth_error: 'none',
          requested_oauth_error_description: 'This error was triggered manually in the stub CRI',
          resourceId: resourceID,
          submit: 'Submit data and generate auth code'
        },
        {
          redirects: 0,
          tags: { name: 'B01_Core_07_FraudDataContinue_1_FraudStub' }
        }
      )
      const endTime1 = Date.now()

      check(res, {
        'is status 302': (r) => r.status === 302
      })
        ? transactionDuration.add(endTime1 - startTime1)
        : fail('Response Validation Failed')

      const startTime2 = Date.now()
      res = http.get(res.headers.Location,
        {
          tags: { name: 'B01_Core_07_FraudDataContinue_2_Core' }
        }
      )
      const endTime2 = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('Answer security questions')
      })
        ? transactionDuration.add(endTime2 - startTime2)
        : fail('Response Validation Failed')

      csrfToken = getCSRF(res)
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_08_PreKBVTransition POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        env.coreEndPoint + '/ipv/page/page-pre-kbv-transition',
        {
          _csrf: csrfToken
        },
        {
          redirects: 0,
          tags: { name: 'B01_Core_08_PreKBVTransition_1_Core' }
        }
      )
      const endTime1 = Date.now()

      check(res, {
        'is status 302': (r) => r.status === 302
      })
        ? transactionDuration.add(endTime1 - startTime1)
        : fail('Response Validation Failed')

      kbvStubURL = res.headers.Location

      const startTime2 = Date.now()
      res = http.get(res.headers.Location,
        {
          tags: { name: 'B01_Core_08_PreKBVTransition_2_KBVStub' }
        }
      )
      const endTime2 = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('Knowledge Based Verification (Stub)')
      })
        ? transactionDuration.add(endTime2 - startTime2)
        : fail('Response Validation Failed')

      resourceID = getResourceID(res)
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_09_KBVDataContinue POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        kbvStubURL,
        {
          jsonPayload: kbvData,
          verificationScore: '2',
          evidenceJsonPayload: '',
          expHours: '0',
          expMinutes: '0',
          expSeconds: '0',
          ci: '',
          requested_oauth_error_endpoint: 'auth',
          requested_oauth_error: 'none',
          requested_oauth_error_description: 'This error was triggered manually in the stub CRI',
          resourceId: resourceID,
          submit: 'Submit data and generate auth code'
        },
        {
          redirects: 0,
          tags: { name: 'B01_Core_09_KBVDataContinue_1_KBVStub' }
        }
      )
      const endTime1 = Date.now()

      check(res, {
        'is status 302': (r) => r.status === 302
      })
        ? transactionDuration.add(endTime1 - startTime1)
        : fail('Response Validation Failed')

      const startTime2 = Date.now()
      res = http.get(res.headers.Location,
        {
          tags: { name: 'B01_Core_09_KBVDataContinue_2_Core' }
        }
      )
      const endTime2 = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('You’ve successfully proved your identity')
      })
        ? transactionDuration.add(endTime2 - startTime2)
        : fail('Response Validation Failed')

      csrfToken = getCSRF(res)
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_10_ContinuePYISuccessPage POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        env.coreEndPoint + '/ipv/page/page-ipv-success',
        {
          _csrf: csrfToken
        },
        {
          redirects: 0,
          tags: { name: 'B01_Core_10_ContinuePYISuccessPage_1_Core' }
        }
      )
      const endTime1 = Date.now()

      check(res, {
        'is status 302': (r) => r.status === 302
      })
        ? transactionDuration.add(endTime1 - startTime1)
        : fail('Response Validation Failed')

      const startTime2 = Date.now()
      res = http.get(res.headers.Location,
        {
          tags: { name: 'B01_Core_10_ContinuePYISuccessPage_2_OrchStub' }
        }
      )
      const endTime2 = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('User information')
      })
        ? transactionDuration.add(endTime2 - startTime2)
        : fail('Response Validation Failed')
    }
  )
}

function getCSRF (r: Response): string {
  return r.html().find("input[name='_csrf']").val() ?? ''
}

function getResourceID (r: Response): string {
  return r.html().find("input[name='resourceId']").val() ?? ''
}
