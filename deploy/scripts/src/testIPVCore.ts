import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { Trend } from 'k6/metrics'
import { selectProfile, type ProfileList, describeProfile } from './utils/config/load-profiles'

const profiles: ProfileList = {
  smoke: {
    coreScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
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
      maxVUs: 1500,
      stages: [
        { target: 30, duration: '10m' } // Ramp up to 30 iterations per second in 10 minutes
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
  let extractedUserIDFull: string
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

      extractedUserIDFull = res.html().find('select[name=userIdSelect]>option').eq(2).text()

      extractedUserIDFull.startsWith('urn:uuid:') && extractedUserIDFull.endsWith(' - Non app journey user')
        ? uniqueUserID = extractedUserIDFull.slice(9, 45)
        : console.log(`User ID not found for ${__VU} and ${__ITER}`)
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_02_SelectUserIDContinue GET',
    function () {
      const startTime = Date.now()
      res = http.get(
        env.orchStubEndPoint + `/authorize?journeyType=full&userIdSelect=urn%3Auuid%3A${uniqueUserID}&userIdText=`,
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
        'verify page content': (r) => (r.body as string).includes('Enter your passport details and answer security questions')
      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')

      csrfToken = getCSRF(res)
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_04_ClickContiueOnPYIStartPage POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        env.coreEndPoint + '/ipv/page/page-passport-doc-check',
        {
          _csrf: csrfToken,
          journey: 'next'
        },
        {
          redirects: 0,
          tags: { name: 'B01_Core_04_ClickContiueOnPYIStartPage_01_Core' }
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
          tags: { name: 'B01_Core_04_ClickContiueOnPYIStartPage_02_PassportStub' }
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
    'B01_Core_05_SelectPassportDataAndContinue POST',
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
          tags: { name: 'B01_Core_05_SelectPassportDataAndContinue_01_PassportStub' }
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
          tags: { name: 'B01_Core_05_SelectPassportDataAndContinue_02_Core' }
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
          tags: { name: 'B01_Core_05_SelectPassportDataAndContinue_03_AddressStub' }
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
    'B01_Core_06_SelectAddressDataAndContinue POST',
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
          tags: { name: 'B01_Core_06_SelectAddressDataAndContinue_01_AddressStub' }
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
          tags: { name: 'B01_Core_06_SelectAddressDataAndContinue_02_Core' }
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
          tags: { name: 'B01_Core_06_SelectAddressDataAndContinue_03_FraudStub' }
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
    'B01_Core_07_SelectFraudDataAndContinue POST',
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
          tags: { name: 'B01_Core_07_SelectFraudDataAndContinue_01_FraudStub' }
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
          tags: { name: 'B01_Core_07_SelectFraudDataAndContinue_02_Core' }
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
    'B01_Core_08_ContinueOnPreKBVTransition POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        env.coreEndPoint + '/ipv/page/page-pre-kbv-transition',
        {
          _csrf: csrfToken
        },
        {
          redirects: 0,
          tags: { name: 'B01_Core_08_ContinueOnPreKBVTransition_01_Core' }
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
          tags: { name: 'B01_Core_08_ContinueOnPreKBVTransition_02_KBVStub' }
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
    'B01_Core_09_SelectKBVDataAndContinue POST',
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
          tags: { name: 'B01_Core_09_SelectKBVDataAndContinue_01_KBVStub' }
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
          tags: { name: 'B01_Core_09_SelectKBVDataAndContinue_02_Core' }
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
    'B01_Core_10_ContinueOnPYISuccessPage POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        env.coreEndPoint + '/ipv/page/page-ipv-success',
        {
          _csrf: csrfToken
        },
        {
          redirects: 0,
          tags: { name: 'B01_Core_10_ContinueOnPYISuccessPage_01_Core' }
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
          tags: { name: 'B01_Core_10_ContinueOnPYISuccessPage_02_OrchStub' }
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
