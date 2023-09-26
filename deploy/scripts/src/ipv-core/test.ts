import { group } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { getStaticResources } from '../common/utils/request/static'
import { timeRequest } from '../common/utils/request/timing'
import { passportPayload, addressPayloadP, kbvPayloadP, fraudPayloadP } from './data/passportData'
import { addressPayloadDL, kbvPayloaDL, fraudPayloadDL, drivingLicencePayload } from './data/drivingLicenceData'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'

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
  lowVolumeTest: {
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 3000,
      stages: [
        { target: 20, duration: '5m' }, // Ramp up to 20 iterations per second in 5 minutes
        { target: 20, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 20 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'passport'
    },
    drivingLicence: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 3000,
      stages: [
        { target: 20, duration: '5m' }, // Ramp up to 20 iterations per second in 5 minutes
        { target: 20, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 20 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
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
      maxVUs: 7500,
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

export function setup (): void {
  describeProfile(loadProfile)
}

const env = {
  orchStubEndPoint: __ENV.IDENTITY_ORCH_STUB_URL,
  ipvCoreURL: __ENV.IDENTITY_CORE_URL,
  staticResources: __ENV.K6_NO_STATIC_RESOURCES !== 'true'
}

export function passport (): void {
  let res: Response

  res = group('B01_Passport_01_LaunchOrchestratorStub GET', () =>
    timeRequest(() => http.get(env.orchStubEndPoint, {
      tags: { name: 'B01_Passport_01_LaunchOrchestratorStub' }
    }),
    { isStatusCode200, ...pageContentCheck('Enter userId manually') }))

  sleepBetween(1, 2)

  res = group('B01_Passport_02_GoToFullJourneyRoute GET', () =>
    timeRequest(() => {
      const response = http.get(env.orchStubEndPoint + '/authorize?journeyType=full&userIdText=', { tags: { name: 'B01_Passport_02_GoToFullJourneyRoute' } })
      if (env.staticResources) getStaticResources(response)
      return response
    },
    { isStatusCode200, ...pageContentCheck('Tell us if you have one of the following types of photo ID') }))

  sleepBetween(1, 2)

  group('B01_Passport_03_ClickContinueStartPage POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: { journey: 'next' },
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_03_ClickContinueStartPage_01_CoreCall' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      tags: { name: 'B01_Passport_03_ClickContStartPage_02_DCMAWStub' } // pragma: allowlist secret
    }),
    { isStatusCode200, ...pageContentCheck('DOC Checking App (Stub)') })
  })

  sleepBetween(1, 2)

  group('B01_Passport_04_DCMAWContinue POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: {
        requested_oauth_error_endpoint: 'auth',
        requested_oauth_error: 'access_denied'
      },
      params: {
        redirects: 1,
        tags: { name: 'B01_Passport_04_DCMAWContinue_01_DCMAWStub' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(env.ipvCoreURL + res.headers.Location, {
      tags: { name: 'B01_Passport_04_DCMAWContinue_02_CoreCall' }
    }),
    { isStatusCode200, ...pageContentCheck('Enter your UK passport details and answer security questions online') })
  })

  sleepBetween(1, 2)

  group('B01_Passport_05_ContinueOnPYIStartPage POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: { journey: 'next/passport' },
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_05_ContOnPYIStartPage_01_CoreCall' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, { tags: { name: 'B01_Passport_05_ContOnPYIStartPage_02_PassStub' } }),
      { isStatusCode200, ...pageContentCheck('UK Passport (Stub)') })
  })

  sleepBetween(1, 2)

  group('B01_Passport_06_PassportDataContinue POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: {
        jsonPayload: passportPayload,
        strengthScore: '4',
        validityScore: '2'
      },
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_06_PassDataContinue_01_PassStub' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location,
      {
        redirects: 0,
        tags: { name: 'B01_Passport_06_PassDataContinue_02_CoreCall' }
      }
    ),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      tags: { name: 'B01_Passport_06_PassDataContinue_03_AddStub' }
    }),
    { isStatusCode200, ...pageContentCheck('Address (Stub)') })
  })

  sleepBetween(1, 2)

  group('B01_Passport_07_AddrDataContinue POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: { jsonPayload: addressPayloadP },
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_07_AddrDataContinue_01_AddStub' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location,
      {
        redirects: 0,
        tags: { name: 'B01_Passport_07_AddrDataContinue_02_CoreCall' }
      }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      tags: { name: 'B01_Passport_07_AddrDataContinue_03_FraudStub' }
    }),
    { isStatusCode200, ...pageContentCheck('Fraud Check (Stub)') })
  })

  sleepBetween(1, 2)

  group('B01_Passport_08_FraudDataContinue POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: {
        jsonPayload: fraudPayloadP,
        identityFraudScore: '2'
      },
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_08_FraudDataContinue_01_FraudStub' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => {
      const response = http.get(res.headers.Location, { tags: { name: 'B01_Passport_08_FraudDataContinue_02_CoreCall' } })
      if (env.staticResources) getStaticResources(response)
      return response
    },
    { isStatusCode200, ...pageContentCheck('Answer security questions') })
  })

  sleepBetween(1, 2)

  group('B01_Passport_09_PreKBVTransition POST', () => {
    res = timeRequest(() => res.submitForm({
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_09_PreKBVTransition_01_CoreCall' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      tags: { name: 'B01_Passport_09_PreKBVTransition_02_KBVStub' }
    }),
    { isStatusCode200, ...pageContentCheck('Knowledge Based Verification (Stub)') })
  })

  sleepBetween(1, 2)

  group('B01_Passport_10_KBVDataContinue POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: {
        jsonPayload: kbvPayloadP,
        verificationScore: '2'
      },
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_10_KBVDataContinue_01_KBVStub' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => {
      const response = http.get(res.headers.Location, { tags: { name: 'B01_Passport_10_KBVDataContinue_02_CoreCall' } })
      if (env.staticResources) getStaticResources(response)
      return response
    },
    { isStatusCode200, ...pageContentCheck('You’ve successfully proved your identity') })
  })

  sleepBetween(1, 2)

  group('B01_Passport_11_ContinuePYISuccessPage POST', () => {
    res = timeRequest(() => res.submitForm({
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_11_ContPYISuccessPage_01_CoreCall' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      tags: { name: 'B01_Passport_11_ContPYISuccessPage_02_OrchStub' }
    }),
    { isStatusCode200, ...pageContentCheck('User information') })
  })
}

export function drivingLicence (): void {
  let res: Response

  res = group('B02_DrivingLicence_01_LaunchOrchestratorStub GET', () =>
    timeRequest(() => http.get(env.orchStubEndPoint, {
      tags: { name: 'B02_DrivingLicence_01_LaunchOrchestratorStub' }
    }),
    { isStatusCode200, ...pageContentCheck('Enter userId manually') }))

  sleepBetween(1, 3)

  res = group('B02_DrivingLicence_02_SelectUserIDContinue GET', () =>
    timeRequest(() => {
      const response = http.get(env.orchStubEndPoint + '/authorize?journeyType=full&userIdText=', { tags: { name: 'B02_DrivingLicence_02_SelectUserIDContinue' } })
      if (env.staticResources) getStaticResources(response)
      return response
    },
    { isStatusCode200, ...pageContentCheck('Tell us if you have one of the following types of photo ID') }))

  sleepBetween(1, 3)

  group('B02_DrivingLicence_03_ContinueStartPage POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: { journey: 'next' },
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_03_ContStartPage_01_CoreCall' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_03_ContStartPage_02_DCMAWStub' }
    }),
    { isStatusCode200, ...pageContentCheck('DOC Checking App (Stub)') })
  })

  sleepBetween(1, 3)

  group('B02_DrivingLicence_04_DCMAWContinue POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: {
        requested_oauth_error_endpoint: 'auth',
        requested_oauth_error: 'access_denied'
      },
      params: {
        redirects: 1,
        tags: { name: 'B02_DrivingLicence_04_DCMAWContinue_01_DCMAWStub' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => {
      const response = http.get(env.ipvCoreURL + res.headers.Location, { tags: { name: 'B02_DrivingLicence_04_DCMAWContinue_02_CoreCall' } })
      if (env.staticResources) getStaticResources(response)
      return response
    },
    { isStatusCode200, ...pageContentCheck('Enter your UK photocard driving licence details and answer security questions online') })
  })

  group('B02_DrivingLicence_05_ContinueOnPYIStartPage POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: { journey: 'next/driving-licence' },
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_05_ContPYIStartPage_01_CoreCall' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_05_ContPYIStartPage_02_DLStub' }
    }),
    { isStatusCode200, ...pageContentCheck('Driving Licence (Stub)') })
  })

  group('B02_DrivingLicence_06_DrivingLicenceDataContinue POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: {
        jsonPayload: drivingLicencePayload,
        strengthScore: '3',
        validityScore: '2',
        activityHistoryScore: '1'
      },
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_06_DLDataContinue_01_DLStub' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      redirects: 0,
      tags: { name: 'B02_DrivingLicence_06_DLDataContinue_02_CoreCall' }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_06_DLDataContinue_03_AddStub' }
    }),
    { isStatusCode200, ...pageContentCheck('Address (Stub)') })
  })

  sleepBetween(1, 3)

  group('B02_DrivingLicence_07_AddrDataContinue POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: { jsonPayload: addressPayloadDL },
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_07_AddrDataCont_01_AddStub' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      redirects: 0,
      tags: { name: 'B02_DrivingLicence_07_AddrDataCont_02_CoreCall' }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_07_AddrDataCont_03_FraudStub' }
    }),
    { isStatusCode200, ...pageContentCheck('Fraud Check (Stub)') })
  })

  sleepBetween(1, 3)

  group('B02_DrivingLicence_08_FraudDataContinue POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: {
        jsonPayload: fraudPayloadDL,
        identityFraudScore: '2',
        activityHistoryScore: '2'
      },
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_08_FraudDataCont_01_FraudStub' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => {
      const response = http.get(res.headers.Location, { tags: { name: 'B02_DrivingLicence_08_FraudDataCont_02_CoreCall' } })
      if (env.staticResources) getStaticResources(response)
      return response
    },
    { isStatusCode200, ...pageContentCheck('Answer security questions') })
  })

  sleepBetween(1, 3)

  group('B02_DrivingLicence_09_PreKBVTransition POST', () => {
    res = timeRequest(() => res.submitForm({
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_09_PreKBVTransition_01_CoreCall' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_09_PreKBVTransition_02_KBVStub' }
    }),
    { isStatusCode200, ...pageContentCheck('Knowledge Based Verification (Stub)') })
  })

  sleepBetween(1, 3)

  group('B02_DrivingLicence_10_KBVDataContinue POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: {
        jsonPayload: kbvPayloaDL,
        verificationScore: '2'
      },
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_10_KBVDataContinue_01_KBVStub' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => {
      const response = http.get(res.headers.Location, { tags: { name: 'B02_DrivingLicence_10_KBVDataContinue_02_CoreCall' } })
      if (env.staticResources) getStaticResources(response)
      return response
    },
    { isStatusCode200, ...pageContentCheck('Continue to the service you want to use') })
  })

  sleepBetween(1, 3)

  group('B02_DrivingLicence_11_ContinueDrivingLicenceSuccessPage POST', () => {
    res = timeRequest(() => res.submitForm({
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_11_ContDLSuccess_01_CoreCall' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      tags: { name: 'B02_DrivingLicence_11_ContDLSuccess_02_OrchStub' }
    }),
    { isStatusCode200, ...pageContentCheck('User information') })
  })
}
