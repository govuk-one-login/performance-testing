import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { Rate, Trend } from 'k6/metrics'
import { SharedArray } from 'k6/data'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'

const profiles: ProfileList = {
  smoke: {
    coreScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '5m' } // Ramps up to target load
      ],
      exec: 'coreScenario1'
    },
    coreScenario2Driving: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'coreScenario2Driving'
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
        { target: 100, duration: '15m' }, // Ramp up to 100 iterations per second in 15 minutes
        { target: 100, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 100 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'coreScenario1'
    },
    coreScenario2Driving: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5000,
      stages: [
        { target: 30, duration: '30m' }, // Ramp up to 30 iterations per second in 30 minutes
        { target: 30, duration: '15m' }, // Steady State of 15 minutes at the ramp up load i.e. 30 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'coreScenario2Driving'
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

interface StubUser {
  passport: string
  address: string
  fraud: string
  kbv: string
}

const stubUser: StubUser[] = new SharedArray('stub', function () {
  return JSON.parse(open('./data/stubUser.json')).stubUser
})
const passportData = open('./data/passportStub.json')
const addressData = open('./data/addressStub.json')
const fraudData = open('./data/fraudStub.json')
const kbvData = open('./data/kbvData.json')
const drivingLicenceData = open('./data/drivingLicenceStub.json')

export function setup (): void {
  describeProfile(loadProfile)
}

const env = {
  orchStubEndPoint: __ENV.IDENTITY_ORCH_STUB_URL,
  ipvCoreURL: __ENV.IDENTITY_CORE_URL
}

const transactionDuration = new Trend('duration', true)
const myRate = new Rate('rate')

export function coreScenario1 (): void {
  let res: Response
  let csrfToken: string
  let resourceID: string
  let dcmawStubURL: string
  let passportStubURL: string
  let addressStubURL: string
  let fraudStubURL: string
  let kbvStubURL: string
  let passed: boolean
  const user = stubUser[Math.floor(Math.random() * stubUser.length)]

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
        'verify page content': (r) => (r.body as string).includes('Enter userId manually')
      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_02_GoToFullJourneyRoute GET',
    function () {
      const startTime = Date.now()
      res = http.get(
        env.orchStubEndPoint + '/authorize?journeyType=full&userIdText=',
        {
          tags: { name: 'B01_Core_02_GoToFullJourneyRoute' }
        }
      )
      const endTime = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('Tell us if you have one of the following types of photo ID')
      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')

      csrfToken = getCSRF(res)
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_03_ClickContinueStartPage POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        env.ipvCoreURL + '/ipv/page/page-ipv-identity-document-start',
        {
          _csrf: csrfToken,
          journey: 'next'
        },
        {
          redirects: 0,
          tags: { name: 'B01_Core_03_ClickContinueStartPage_01_Core' }
        }
      )
      const endTime1 = Date.now()

      check(res, {
        'is status 302': (r) => r.status === 302
      })
        ? transactionDuration.add(endTime1 - startTime1)
        : fail('Response Validation Failed')

      dcmawStubURL = res.headers.Location

      const startTime2 = Date.now()
      res = http.get(res.headers.Location,
        {
          tags: { name: 'B01_Core_03_ClickContinueStartPage_02_DcmawStub' } // pragma: allowlist secret
        }
      )
      const endTime2 = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('DOC Checking App (Stub)')
      })
        ? transactionDuration.add(endTime2 - startTime2)
        : fail('Response Validation Failed')

      resourceID = getResourceID(res)
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_04_DCMAWContinue POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        dcmawStubURL,
        {
          jsonPayload: '',
          strengthScore: '',
          validityScore: '',
          activityHistoryScore: '',
          biometricVerificationScore: '',
          ci: '',
          evidenceJsonPayload: '',
          expHours: '0',
          expMinutes: '0',
          expSeconds: '0',
          requested_oauth_error_endpoint: 'auth',
          requested_oauth_error: 'access_denied',
          requested_oauth_error_description: 'This error was triggered manually in the stub CRI',
          resourceId: resourceID,
          submit: 'Submit data and generate auth code'
        },
        {
          redirects: 1,
          tags: { name: 'B01_Core_04_DCMAWContinue_1_DcmawStub' }
        }
      )
      const endTime1 = Date.now()

      check(res, {
        'is status 302': (r) => r.status === 302
      })
        ? transactionDuration.add(endTime1 - startTime1)
        : fail('Response Validation Failed')

      const startTime2 = Date.now()
      res = http.get(env.ipvCoreURL + res.headers.Location,
        {
          tags: { name: 'B01_Core_04_DCMAWContinue_2_Core' }
        }
      )
      const endTime2 = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('Enter your UK passport details and answer security questions online')
      })
        ? transactionDuration.add(endTime2 - startTime2)
        : fail('Response Validation Failed')

      csrfToken = getCSRF(res)
    }
  )

  sleep(Math.random() * 3)

  group(
    'B01_Core_05_ContinueOnPYIStartPage POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        env.ipvCoreURL + '/ipv/page/page-multiple-doc-check',
        {
          _csrf: csrfToken,
          journey: 'next/passport'
        },
        {
          redirects: 0,
          tags: { name: 'B01_Core_05_ContinueOnPYIStartPage_01_Core' }
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
          tags: { name: 'B01_Core_05_ContinueOnPYIStartPage_02_PassStub' }
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
    'B01_Core_06_PassportDataContinue POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        passportStubURL,
        {
          sort: user.passport,
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
          tags: { name: 'B01_Core_06_PassportDataContinue_1_PassStub' }
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
          tags: { name: 'B01_Core_06_PassportDataContinue_2_Core' }
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
          tags: { name: 'B01_Core_06_PassportDataContinue_3_AddStub' }
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
    'B01_Core_07_AddrDataContinue POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        addressStubURL,
        {
          sort: user.address,
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
          tags: { name: 'B01_Core_07_AddrDataContinue_1_AddStub' }
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
          tags: { name: 'B01_Core_07_AddrDataContinue_2_Core' }
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
          tags: { name: 'B01_Core_07_AddrDataContinue_3_FraudStub' }
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
    'B01_Core_08_FraudDataContinue POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        fraudStubURL,
        {
          sort: user.fraud,
          jsonPayload: fraudData,
          identityFraudScore: '2',
          activityHistoryScore: '',
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
          tags: { name: 'B01_Core_08_FraudDataContinue_1_FraudStub' }
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
          tags: { name: 'B01_Core_08_FraudDataContinue_2_Core' }
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
    'B01_Core_09_PreKBVTransition POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        env.ipvCoreURL + '/ipv/page/page-pre-kbv-transition',
        {
          _csrf: csrfToken
        },
        {
          redirects: 0,
          tags: { name: 'B01_Core_09_PreKBVTransition_1_Core' }
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
          tags: { name: 'B01_Core_09_PreKBVTransition_2_KBVStub' }
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
    'B01_Core_10_KBVDataContinue POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        kbvStubURL,
        {
          sort: user.kbv,
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
          tags: { name: 'B01_Core_10_KBVDataContinue_1_KBVStub' }
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
          tags: { name: 'B01_Core_10_KBVDataContinue_2_Core' }
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
    'B01_Core_11_ContinuePYISuccessPage POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        env.ipvCoreURL + '/ipv/page/page-ipv-success',
        {
          _csrf: csrfToken
        },
        {
          redirects: 0,
          tags: { name: 'B01_Core_11_ContinuePYISuccessPage_1_Core' }
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
          tags: { name: 'B01_Core_11_ContinuePYISuccessPage_2_OrchStub' }
        }
      )
      const endTime2 = Date.now()

      passed = check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('User information')
      })
      myRate.add(passed)
      if (passed) {
        transactionDuration.add(endTime2 - startTime2)
      } else {
        fail('Response Validation Failed')
      }
    }
  )
}

export function coreScenario2Driving (): void {
  let res: Response
  let csrfToken: string
  let resourceID: string
  let uniqueUserID: string
  let drivingLicenceStubURL: string
  let addressStubURL: string
  let fraudStubURL: string
  let kbvStubURL: string

  group(
    'B02_Core_DrivingLicence_01_LaunchOrchestratorStub GET',
    function () {
      const startTime = Date.now()
      res = http.get(env.orchStubEndPoint,
        {
          tags: { name: 'B02_Core_DrivingLicence_01_LaunchOrchestratorStub' }
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
    'B02_Core_DrivingLicence_02_SelectUserIDContinue GET',
    function () {
      const startTime = Date.now()
      res = http.get(
        env.orchStubEndPoint + `/authorize?journeyType=full&userIdSelect=${uniqueUserID}&userIdText=`,
        {
          tags: { name: 'B02_Core_DrivingLicence_02_SelectUserIDContinue' }
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
    'B02_Core_DrivingLicence_03_ClickContinueAfterLogin POST',
    function () {
      const startTime = Date.now()
      res = http.post(
        env.ipvCoreURL + '/ipv/page/page-ipv-identity-start',
        {
          _csrf: csrfToken
        },
        {
          tags: { name: 'B02_Core_DrivingLicence_03_ClickContinueAfterLogin' }
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
    'B02_Core_DrivingLicence_04_ContinueOnDrivingLicence POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        env.ipvCoreURL + '/ipv/page/page-multiple-doc-check',
        {
          _csrf: csrfToken,
          journey: 'next/driving-licence'
        },
        {
          redirects: 0,
          tags: { name: 'B02_Core_DrivingLicence_04_ContinueOnDrivingLicence' }
        }
      )
      const endTime1 = Date.now()

      check(res, {
        'is status 302': (r) => r.status === 302
      })
        ? transactionDuration.add(endTime1 - startTime1)
        : fail('Response Validation Failed')

      drivingLicenceStubURL = res.headers.Location

      const startTime2 = Date.now()
      res = http.get(res.headers.Location,
        {
          tags: { name: 'B02_Core_DrivingLicence_04_ContinueOnDrivingLicence_02_DrivingLicenceStub' }
        }
      )
      const endTime2 = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('Driving Licence (Stub)')
      })
        ? transactionDuration.add(endTime2 - startTime2)
        : fail('Response Validation Failed')

      resourceID = getResourceID(res)
    }
  )

  sleep(Math.random() * 3)

  group(
    'B02_Core_05_DrivingLicenceDataContinue POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        drivingLicenceStubURL,
        {
          jsonPayload: drivingLicenceData,
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
          tags: { name: 'B02_Core_DrivingLicence_05_Continue' }
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
          tags: { name: 'B02_Core_DrivingLicence_05_DrivingLicenceDataContinue_2_Core' }
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
          tags: { name: 'B02_Core_DrivingLicence_05_DrivingLicenceDataContinue_3_AddStub' }
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
    'B02_Core_DrivingLicence_06_AddrDataContinue POST',
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
          tags: { name: 'B02_Core_DrivingLicence_06_AddrDataContinue_1_AddStub' }
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
          tags: { name: 'B02_Core_DrivingLicence_06_AddrDataContinue_2_Core' }
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
          tags: { name: 'B02_Core_DrivingLicence_06_AddrDataContinue_3_FraudStub' }
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
    'B02_Core_DrivingLicence_07_FraudDataContinue POST',
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
          tags: { name: 'B02_Core_DrivingLicence_07_FraudDataContinue_1_FraudStub' }
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
          tags: { name: 'B02_Core_DrivingLicence_07_FraudDataContinue_2_Core' }
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
    'B02_Core_Driving_Licence_08_PreKBVTransition POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        env.ipvCoreURL + '/ipv/page/page-pre-kbv-transition',
        {
          _csrf: csrfToken
        },
        {
          redirects: 0,
          tags: { name: 'B02_Core_DrivingLicence_08_PreKBVTransition_1_Core' }
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
          tags: { name: 'B02_Core_DrivingLicence_08_PreKBVTransition_2_KBVStub' }
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
    'B02_Core_DrivingLicence_09_KBVDataContinue POST',
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
          tags: { name: 'B02_Core_DrivingLicence_09_KBVDataContinue_1_KBVStub' }
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
          tags: { name: 'B02_Core_09_KBVDataContinue_2_Core' }
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
    'B02_Core_DrivingLicence_10_ContinueDrivingLicenceSuccessPage POST',
    function () {
      const startTime1 = Date.now()
      res = http.post(
        env.ipvCoreURL + '/ipv/page/page-ipv-success',
        {
          _csrf: csrfToken
        },
        {
          redirects: 0,
          tags: { name: 'B02_Core_DrivingLicence_10_ContinueDrivingLicenceSuccessPage_1_Core' }
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
          tags: { name: 'B02_Core_DrivingLicence_10_ContinueDrivingLicenceSuccessPage_2_OrchStub' }
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
