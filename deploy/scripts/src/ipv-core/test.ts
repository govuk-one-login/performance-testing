import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { Rate, Trend } from 'k6/metrics'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { getStaticResources } from '../common/utils/request/static'

const profiles: ProfileList = {
  smoke: {
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'passport'
    },
    drivingLicence: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'drivingLicence'
    }
  },
  load: {
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1000,
      maxVUs: 5000,
      stages: [
        { target: 100, duration: '15m' }, // Ramp up to 100 iterations per second in 15 minutes
        { target: 100, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 100 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'passport'
    },
    drivingLicence: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1000,
      maxVUs: 5000,
      stages: [
        { target: 30, duration: '30m' }, // Ramp up to 30 iterations per second in 30 minutes
        { target: 30, duration: '15m' }, // Steady State of 15 minutes at the ramp up load i.e. 30 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'drivingLicence'
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

interface testData {
  address: Record<string, any>
  fraud: Record<string, any>
  kbv: Record<string, any>
}
interface passportDataType extends testData {
  passport: Record<string, any>
}
interface drivingLicenceDataType extends testData {
  drivingLicence: Record<string, any>
}
const passportData: passportDataType = JSON.parse(open('./data/passport.json'))
const drivingLicenceData: drivingLicenceDataType = JSON.parse(open('./data/drivingLicence.json'))

export function setup (): void {
  describeProfile(loadProfile)
}

const env = {
  orchStubEndPoint: __ENV.IDENTITY_ORCH_STUB_URL,
  ipvCoreURL: __ENV.IDENTITY_CORE_URL,
  staticResources: __ENV.K6_NO_STATIC_RESOURCES !== 'true'
}

const transactionDuration = new Trend('duration', true)
const myRate = new Rate('rate')

export function passport (): void {
  let res: Response

  group('B01_Passport_01_LaunchOrchestratorStub GET', () => {
    const startTime = Date.now()
    res = http.get(env.orchStubEndPoint, {
      tags: { name: 'B01_Passport_01_LaunchOrchestratorStub' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Enter userId manually')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_Passport_02_GoToFullJourneyRoute GET', () => {
    const startTime = Date.now()
    res = http.get(env.orchStubEndPoint + '/authorize?journeyType=full&userIdText=', {
      tags: { name: 'B01_Passport_02_GoToFullJourneyRoute' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Tell us if you have one of the following types of photo ID')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_Passport_03_ClickContinueStartPage POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      fields: { journey: 'next' },
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_03_ClickContinueStartPage_01_CoreCall' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B01_Passport_03_ClickContStartPage_02_DCMAWStub' } // pragma: allowlist secret
    })
    if (env.staticResources) getStaticResources(res)
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('DOC Checking App (Stub)')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_Passport_04_DCMAWContinue POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      fields: {
        requested_oauth_error_endpoint: 'auth',
        requested_oauth_error: 'access_denied'
      },
      params: {
        redirects: 1,
        tags: { name: 'B01_Passport_04_DCMAWContinue_01_DCMAWStub' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(env.ipvCoreURL + res.headers.Location, {
      tags: { name: 'B01_Passport_04_DCMAWContinue_02_CoreCall' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Enter your UK passport details and answer security questions online')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_Passport_05_ContinueOnPYIStartPage POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      fields: { journey: 'next/passport' },
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_05_ContOnPYIStartPage_01_CoreCall' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B01_Passport_05_ContOnPYIStartPage_02_PassStub' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('UK Passport (Stub)')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_Passport_06_PassportDataContinue POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      fields: {
        jsonPayload: JSON.stringify(passportData.passport),
        strengthScore: '4',
        validityScore: '2'
      },
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_06_PassDataContinue_01_PassStub' }
      }
    })
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
        tags: { name: 'B01_Passport_06_PassDataContinue_02_CoreCall' }
      }
    )
    const endTime2 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')

    const startTime3 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B01_Passport_06_PassDataContinue_03_AddStub' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime3 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Address (Stub)')
    })
      ? transactionDuration.add(endTime3 - startTime3)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_Passport_07_AddrDataContinue POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      fields: { jsonPayload: JSON.stringify(passportData.address) },
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_07_AddrDataContinue_01_AddStub' }
      }
    })
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
        tags: { name: 'B01_Passport_07_AddrDataContinue_02_CoreCall' }
      })
    const endTime2 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')

    const startTime3 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B01_Passport_07_AddrDataContinue_03_FraudStub' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime3 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Fraud Check (Stub)')
    })
      ? transactionDuration.add(endTime3 - startTime3)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_Passport_08_FraudDataContinue POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      fields: {
        jsonPayload: JSON.stringify(passportData.fraud),
        identityFraudScore: '2'
      },
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_08_FraudDataContinue_01_FraudStub' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B01_Passport_08_FraudDataContinue_02_CoreCall' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Answer security questions')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_Passport_09_PreKBVTransition POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_09_PreKBVTransition_01_CoreCall' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B01_Passport_09_PreKBVTransition_02_KBVStub' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Knowledge Based Verification (Stub)')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_Passport_10_KBVDataContinue POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      fields: {
        jsonPayload: JSON.stringify(passportData.kbv),
        verificationScore: '2'
      },
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_10_KBVDataContinue_01_KBVStub' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B01_Passport_10_KBVDataContinue_02_CoreCall' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('You’ve successfully proved your identity')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_Passport_11_ContinuePYISuccessPage POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_11_ContPYISuccessPage_01_CoreCall' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B01_Passport_11_ContPYISuccessPage_02_OrchStub' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime2 = Date.now()

    const passed = check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('User information')
    })
    myRate.add(passed)
    if (passed) {
      transactionDuration.add(endTime2 - startTime2)
    } else {
      fail('Response Validation Failed')
    }
  })
}

export function drivingLicence (): void {
  let res: Response

  group('B02_DrivingLicence_01_LaunchOrchestratorStub GET', () => {
    const startTime = Date.now()
    res = http.get(env.orchStubEndPoint, {
      tags: { name: 'B02_DrivingLicence_01_LaunchOrchestratorStub' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Enter userId manually')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_DrivingLicence_02_SelectUserIDContinue GET', () => {
    const startTime = Date.now()
    res = http.get(env.orchStubEndPoint + '/authorize?journeyType=full&userIdText=', {
      tags: { name: 'B02_DrivingLicence_02_SelectUserIDContinue' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Tell us if you have one of the following types of photo ID')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_DrivingLicence_03_ContinueStartPage POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      fields: { journey: 'next' },
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_03_ContStartPage_01_CoreCall' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_03_ContStartPage_02_DCMAWStub' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('DOC Checking App (Stub)')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_DrivingLicence_04_DCMAWContinue POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      fields: {
        requested_oauth_error_endpoint: 'auth',
        requested_oauth_error: 'access_denied'
      },
      params: {
        redirects: 1,
        tags: { name: 'B02_DrivingLicence_04_DCMAWContinue_01_DCMAWStub' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(env.ipvCoreURL + res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_04_DCMAWContinue_02_CoreCall' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Enter your UK driving licence details and answer security questions online')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })

  group('B02_DrivingLicence_05_ContinueOnPYIStartPage POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      fields: { journey: 'next/driving-licence' },
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_05_ContPYIStartPage_01_CoreCall' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_05_ContPYIStartPage_02_DLStub' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Driving Licence (Stub)')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })

  group('B02_DrivingLicence_06_DrivingLicenceDataContinue POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      fields: {
        jsonPayload: JSON.stringify(drivingLicenceData.drivingLicence),
        strengthScore: '3',
        validityScore: '2',
        activityHistoryScore: '1'
      },
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_06_DLDataContinue_01_DLStub' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location, {
      redirects: 0,
      tags: { name: 'B02_DrivingLicence_06_DLDataContinue_02_CoreCall' }
    })
    const endTime2 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')

    const startTime3 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_06_DLDataContinue_03_AddStub' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime3 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Address (Stub)')
    })
      ? transactionDuration.add(endTime3 - startTime3)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_DrivingLicence_07_AddrDataContinue POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      fields: { jsonPayload: JSON.stringify(drivingLicenceData.address) },
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_07_AddrDataCont_01_AddStub' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location, {
      redirects: 0,
      tags: { name: 'B02_DrivingLicence_07_AddrDataCont_02_CoreCall' }
    })
    const endTime2 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')

    const startTime3 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_07_AddrDataCont_03_FraudStub' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime3 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Fraud Check (Stub)')
    })
      ? transactionDuration.add(endTime3 - startTime3)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_DrivingLicence_08_FraudDataContinue POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      fields: {
        jsonPayload: JSON.stringify(drivingLicenceData.fraud),
        identityFraudScore: '2',
        activityHistoryScore: '2'
      },
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_08_FraudDataCont_01_FraudStub' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_08_FraudDataCont_02_CoreCall' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Answer security questions')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_DrivingLicence_09_PreKBVTransition POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_09_PreKBVTransition_01_CoreCall' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_09_PreKBVTransition_02_KBVStub' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Knowledge Based Verification (Stub)')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_DrivingLicence_10_KBVDataContinue POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      fields: {
        jsonPayload: JSON.stringify(drivingLicenceData.kbv),
        verificationScore: '2'
      },
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_10_KBVDataContinue_01_KBVStub' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_10_KBVDataContinue_02_CoreCall' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Continue to the service you want to use')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_DrivingLicence_11_ContinueDrivingLicenceSuccessPage POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_11_ContDLSuccess_01_CoreCall' }
      }
    })
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_11_ContDLSuccess_02_OrchStub' }
    })
    if (env.staticResources) getStaticResources(res)
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('User information')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })
}
