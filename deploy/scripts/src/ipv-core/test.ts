import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import encoding from 'k6/encoding'
import { group } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
// import { getStaticResources } from '../common/utils/request/static'
import { timeRequest } from '../common/utils/request/timing'
import { passportPayload, addressPayloadP, kbvPayloadP, fraudPayloadP } from './data/passportData'
import { addressPayloadDL, kbvPayloaDL, fraudPayloadDL, drivingLicencePayload } from './data/drivingLicenceData'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { SharedArray } from 'k6/data'
import { uuidv4 } from '../common/utils/jslib/index'

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
    },
    idReuse: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'idReuse'
    }
  },
  deployment: {
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 60,
      stages: [
        { target: 2, duration: '5m' }, // Ramp up to 2 iterations per second over 5 minutes
        { target: 2, duration: '20m' }, // Steady State of 20 minutes at the ramp up load i.e. 2 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes
      ],
      exec: 'passport'
    },
    drivingLicence: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 60,
      stages: [
        { target: 2, duration: '5m' }, // Ramp up to 2 iterations per second over 5 minutes
        { target: 2, duration: '20m' }, // Steady State of 20 minutes at the ramp up load i.e. 2 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes
      ],
      exec: 'drivingLicence'
    },
    idReuse: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 30,
      stages: [
        { target: 10, duration: '5m' }, // Ramp up to 10 iterations per second over 5 minutes
        { target: 10, duration: '20m' }, // Steady State of 20 minutes at the ramp up load i.e. 10 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes
      ],
      exec: 'idReuse'
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
    },
    idReuse: {
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
      exec: 'idReuse'
    }
  },
  load: {
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1000,
      maxVUs: 3000,
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
      maxVUs: 3000,
      stages: [
        { target: 30, duration: '30m' }, // Ramp up to 30 iterations per second in 30 minutes
        { target: 30, duration: '15m' }, // Steady State of 15 minutes at the ramp up load i.e. 30 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'drivingLicence'
    },
    idReuse: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1000,
      maxVUs: 5000,
      stages: [
        { target: 1900, duration: '15m' }, // Ramp up to 1,900 iterations per second in 15 minutes
        { target: 1900, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 1,900 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'idReuse'
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

interface IDReuseUserID {
  userID: string
}

const csvData: IDReuseUserID[] = new SharedArray('ID Reuse User ID', function () {
  return open('./data/idReuseTestData.csv').split('\n').slice(1).map((userID) => {
    return {
      userID
    }
  })
})

const environment = __ENV.ENVIRONMENT.toLocaleUpperCase()
const validEnvironments = ['BUILD', 'DEV']
if (!validEnvironments.includes(environment)) throw new Error(`Environment '${environment}' not in [${validEnvironments.toString()}]`)

const env = {
  orchStubEndPoint: __ENV[`IDENTITY_${environment}_ORCH_STUB_URL`],
  ipvCoreURL: __ENV[`IDENTITY_${environment}_CORE_URL`]
  // staticResources: __ENV.K6_NO_STATIC_RESOURCES !== 'true'
}

const stubCreds = {
  userName: __ENV.IDENTITY_ORCH_STUB_USERNAME,
  password: __ENV.IDENTITY_ORCH_STUB_PASSWORD
}

export function passport (): void {
  let res: Response
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  iterationsStarted.add(1)
  res = group('B01_Passport_01_LaunchOrchestratorStub GET', () =>
    timeRequest(() => http.get(env.orchStubEndPoint, {
      headers: { Authorization: `Basic ${encodedCredentials}` },
      tags: { name: 'B01_Passport_01_LaunchOrchestratorStub' }
    }),
    { isStatusCode200, ...pageContentCheck('Enter userId manually') }))

  const userId = getUserId(res)
  const signInJourneyId = getSignInJourneyId(res)

  sleepBetween(0.5, 1)

  res = group('B01_Passport_02_GoToFullJourneyRoute GET', () =>
    timeRequest(() => {
      const response = http.get(env.orchStubEndPoint + `/authorize?journeyType=full&userIdText=${userId}&signInJourneyIdText=${signInJourneyId}`, {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B01_Passport_02_GoToFullJourneyRoute' }
      })
      // if (env.staticResources) getStaticResources(response)
      return response
    },
    { isStatusCode200, ...pageContentCheck('Tell us if you have one of the following types of photo ID') }))

  sleepBetween(0.5, 1)

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

  sleepBetween(0.5, 1)

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

  sleepBetween(0.5, 1)

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

  sleepBetween(0.5, 1)

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

  sleepBetween(0.5, 1)

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

  sleepBetween(0.5, 1)

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
      // if (env.staticResources) getStaticResources(response)
      return response
    },
    { isStatusCode200, ...pageContentCheck('Answer security questions') })
  })

  sleepBetween(0.5, 1)

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

  sleepBetween(0.5, 1)

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
      // if (env.staticResources) getStaticResources(response)
      return response
    },
    { isStatusCode200, ...pageContentCheck('You’ve successfully proved your identity') })
  })

  sleepBetween(0.5, 1)

  group('B01_Passport_11_ContinuePYISuccessPage POST', () => {
    res = timeRequest(() => res.submitForm({
      params: {
        redirects: 0,
        tags: { name: 'B01_Passport_11_ContPYISuccessPage_01_CoreCall' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      headers: { Authorization: `Basic ${encodedCredentials}` },
      tags: { name: 'B01_Passport_11_ContPYISuccessPage_02_OrchStub' }
    }),
    { isStatusCode200, ...pageContentCheck('User information') })
    iterationsCompleted.add(1)
  })
}

export function drivingLicence (): void {
  let res: Response
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  iterationsStarted.add(1)

  res = group('B02_DrivingLicence_01_LaunchOrchestratorStub GET', () =>
    timeRequest(() => http.get(env.orchStubEndPoint, {
      headers: { Authorization: `Basic ${encodedCredentials}` },
      tags: { name: 'B02_DrivingLicence_01_LaunchOrchestratorStub' }
    }),
    { isStatusCode200, ...pageContentCheck('Enter userId manually') }))
  const userId = getUserId(res)
  const signInJourneyId = getSignInJourneyId(res)

  sleepBetween(0.5, 1)

  res = group('B02_DrivingLicence_02_SelectUserIDContinue GET', () =>
    timeRequest(() => {
      const response = http.get(env.orchStubEndPoint + `/authorize?journeyType=full&userIdText=${userId}&signInJourneyIdText=${signInJourneyId}`, {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B02_DrivingLicence_02_SelectUserIDContinue' }
      })
      // if (env.staticResources) getStaticResources(response)
      return response
    },
    { isStatusCode200, ...pageContentCheck('Tell us if you have one of the following types of photo ID') }))

  sleepBetween(0.5, 1)

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

  sleepBetween(0.5, 1)

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
      // if (env.staticResources) getStaticResources(response)
      return response
    },
    { isStatusCode200, ...pageContentCheck('Enter your UK photocard driving licence details and answer security questions online') })
  })

  sleepBetween(0.5, 1)

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

  sleepBetween(0.5, 1)

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

  sleepBetween(0.5, 1)

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

  sleepBetween(0.5, 1)

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
      // if (env.staticResources) getStaticResources(response)
      return response
    },
    { isStatusCode200, ...pageContentCheck('Answer security questions') })
  })

  sleepBetween(0.5, 1)

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

  sleepBetween(0.5, 1)

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
      // if (env.staticResources) getStaticResources(response)
      return response
    },
    { isStatusCode200, ...pageContentCheck('Continue to the service you want to use') })
  })

  sleepBetween(0.5, 1)

  group('B02_DrivingLicence_11_ContinueDrivingLicenceSuccessPage POST', () => {
    res = timeRequest(() => res.submitForm({
      params: {
        redirects: 0,
        tags: { name: 'B02_DrivingLicence_11_ContDLSuccess_01_CoreCall' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      headers: { Authorization: `Basic ${encodedCredentials}` },
      tags: { name: 'B02_DrivingLicence_11_ContDLSuccess_02_OrchStub' }
    }),
    { isStatusCode200, ...pageContentCheck('User information') })
    iterationsCompleted.add(1)
  })
}

export function idReuse (): void {
  let res: Response
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  const idReuseUserID = csvData[Math.floor(Math.random() * csvData.length)]
  iterationsStarted.add(1)
  const signInJourneyId = uuidv4()

  group('B03_IDReuse_01_LoginToCore GET', () => {
    res = timeRequest(() => http.get(env.orchStubEndPoint + `/authorize?journeyType=full&userIdText=${idReuseUserID.userID}&signInJourneyIdText=${signInJourneyId}`, {
      headers: { Authorization: `Basic ${encodedCredentials}` },
      redirects: 0,
      tags: { name: 'B03_IDReuse_01_LoginToCore_01_OrchStub' }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      tags: { name: 'B03_IDReuse_01_LoginToCore_02_CoreCall' }
    }),
    { isStatusCode200, ...pageContentCheck('You have already proved your identity') })
  })

  sleepBetween(0.5, 1)

  group('B03_IDReuse_02_ClickContinue POST', () => {
    res = timeRequest(() => res.submitForm({
      fields: { submitButton: '' },
      params: {
        redirects: 0,
        tags: { name: 'B03_IDReuse_02_ClickContinue_01_CoreCall' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      headers: { Authorization: `Basic ${encodedCredentials}` },
      tags: { name: 'B03_IDReuse_02_ClickContinue_02_OrchStub' }
    }),
    { isStatusCode200, ...pageContentCheck('User information') })
    iterationsCompleted.add(1)
  })
}

function getUserId (r: Response): string {
  return r.html().find("input[name='userIdText']").val() ?? 'User ID not found'
}

function getSignInJourneyId (r: Response): string {
  return r.html().find("input[name='signInJourneyIdText']").val() ?? 'Sign In Journey ID not found'
}
