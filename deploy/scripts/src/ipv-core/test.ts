import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import encoding from 'k6/encoding'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI3SpikeSignUpScenario,
  createI3SpikeSignInScenario,
  createI4PeakTestSignUpScenario,
  createI4PeakTestSignInScenario
} from '../common/utils/config/load-profiles'
import { timeGroup } from '../common/utils/request/timing'
import { passportPayload, addressPayloadP, kbvPayloadP, fraudPayloadP } from './data/passportData'
import { addressPayloadDL, kbvPayloaDL, fraudPayloadDL, drivingLicencePayload } from './data/drivingLicenceData'
import {
  passportPayloadM1C,
  chippedPassportPayloadM1C,
  addressPayloadM1C,
  fraudPayloadM1C,
  failedFraudCheckPayloadM1C
} from './data/m1CData'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { SharedArray } from 'k6/data'
import { uuidv4 } from '../common/utils/jslib/index'
import execution from 'k6/execution'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('identity', LoadProfile.smoke),
    ...createScenario('idReuse', LoadProfile.smoke),
    ...createScenario('orchStubIsolatedTest', LoadProfile.smoke),
    ...createScenario('identityM1C', LoadProfile.smoke)
  },
  deployment: {
    ...createScenario('identity', LoadProfile.deployment, 2),
    ...createScenario('idReuse', LoadProfile.deployment, 10)
  },
  lowVolume: {
    ...createScenario('identity', LoadProfile.short, 20),
    ...createScenario('idReuse', LoadProfile.short, 20)
  },
  load: {
    ...createScenario('identity', LoadProfile.full, 100),
    ...createScenario('idReuse', LoadProfile.full, 1900, 5),
    ...createScenario('orchStubIsolatedTest', LoadProfile.full, 100)
  },
  loadMar2025: {
    ...createScenario('identity', LoadProfile.short, 20, 44),
    ...createScenario('idReuse', LoadProfile.short, 40, 8)
  },
  soakMar2025: {
    ...createScenario('identity', LoadProfile.soak, 20, 44),
    ...createScenario('idReuse', LoadProfile.soak, 40, 8)
  },
  spikeNFR: {
    ...createScenario('identity', LoadProfile.spikeNFRSignUp, 20, 44),
    ...createScenario('idReuse', LoadProfile.spikeNFRSignIn, 40, 8)
  },
  spikeSudden: {
    ...createScenario('identity', LoadProfile.spikeSudden, 20, 44),
    ...createScenario('idReuse', LoadProfile.spikeSudden, 40, 8)
  },
  loadMar2025L2: {
    ...createScenario('identity', LoadProfile.short, 40, 44),
    ...createScenario('idReuse', LoadProfile.short, 80, 8)
  },
  soakMar2025L2: {
    ...createScenario('identity', LoadProfile.soak, 40, 44),
    ...createScenario('idReuse', LoadProfile.soak, 80, 8)
  },
  spikeNFRL2: {
    ...createScenario('identity', LoadProfile.spikeNFRSignUpL2, 40, 44),
    ...createScenario('idReuse', LoadProfile.spikeNFRSignInL2, 80, 8)
  },
  spikeSuddenL2: {
    ...createScenario('identity', LoadProfile.spikeSudden, 40, 44),
    ...createScenario('idReuse', LoadProfile.spikeSudden, 80, 8)
  },
  dataCreationForIDReuse: {
    identity: {
      executor: 'per-vu-iterations',
      vus: 250,
      iterations: 200,
      maxDuration: '120m',
      exec: 'identity'
    }
  },
  adhocLoadTest: {
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1000,
      maxVUs: 3000,
      stages: [
        { target: 100, duration: '15m' }, // Ramp up to target throughput over 15 minutes
        { target: 100, duration: '5m' }, // Maintain steady state at target throughput for 5 minutes
        { target: 0, duration: '5m' } // Ramp down over 5 minutes
      ],
      exec: 'passport'
    }
  },
  lowVolPerf007Test: {
    identity: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 20, duration: '200s' },
        { target: 20, duration: '180s' }
      ],
      exec: 'identity'
    },
    idReuse: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 10, duration: '200s' },
        { target: 10, duration: '180s' }
      ],
      exec: 'idReuse'
    }
  },
  perf006Iteration1: {
    identity: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 504,
      stages: [
        { target: 140, duration: '141s' },
        { target: 140, duration: '15m' }
      ],
      exec: 'identity'
    },
    idReuse: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 15,
      maxVUs: 18,
      stages: [
        { target: 3, duration: '3s' },
        { target: 3, duration: '15m' }
      ],
      exec: 'idReuse'
    }
  },
  perf006Iteration2PeakTest: {
    identity: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 432,
      stages: [
        { target: 120, duration: '121s' },
        { target: 120, duration: '30m' }
      ],
      exec: 'identity'
    },
    idReuse: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 15,
      maxVUs: 66,
      stages: [
        { target: 11, duration: '6s' },
        { target: 11, duration: '30m' }
      ],
      exec: 'idReuse'
    }
  },
  spikeI2HighTraffic: {
    ...createScenario('identity', LoadProfile.spikeI2HighTraffic, 35, 44),
    ...createScenario('idReuse', LoadProfile.spikeI2HighTraffic, 32, 8)
  },
  perf006Iteration3PeakTest: {
    identity: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 576,
      stages: [
        { target: 160, duration: '161s' },
        { target: 160, duration: '30m' }
      ],
      exec: 'identity'
    },
    idReuse: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 144,
      stages: [
        { target: 24, duration: '12s' },
        { target: 24, duration: '30m' }
      ],
      exec: 'idReuse'
    }
  },
  identityM1CPeakTest: {
    identityM1C: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 576,
      stages: [
        { target: 160, duration: '161s' },
        { target: 160, duration: '30m' }
      ],
      exec: 'identityM1C'
    },
    idReuse: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 144,
      stages: [
        { target: 24, duration: '12s' },
        { target: 24, duration: '30m' }
      ],
      exec: 'idReuse'
    }
  },
  perf006Iteration3SpikeTest: {
    ...createI3SpikeSignUpScenario('identity', 490, 36, 491),
    ...createI3SpikeSignInScenario('idReuse', 71, 6, 33)
  },
  perf006I3RegressionTest: {
    identity: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 576,
      stages: [
        { target: 4, duration: '2s' },
        { target: 4, duration: '5m' }
      ],
      exec: 'identity'
    },
    idReuse: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 144,
      stages: [
        { target: 1, duration: '1s' },
        { target: 1, duration: '5m' }
      ],
      exec: 'idReuse'
    }
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('identity', 470, 36, 471),
    ...createI4PeakTestSignInScenario('idReuse', 43, 6, 21)
  },
  perf006Iteration4SoakTest: {
    identity: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 36,
      maxVUs: 72,
      stages: [
        { target: 20, duration: '31s' },
        { target: 20, duration: '6h' }
      ],
      exec: 'identity'
    },
    idReuse: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 6,
      maxVUs: 12,
      stages: [
        { target: 2, duration: '3s' },
        { target: 2, duration: '6h' }
      ],
      exec: 'idReuse'
    }
  },
  perf006Iteration4StressTest: {
    identity: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 1728,
      maxVUs: 3456,
      stages: [
        { target: 160, duration: '161s' },
        { target: 160, duration: '300s' },
        { target: 320, duration: '161s' },
        { target: 320, duration: '300s' },
        { target: 480, duration: '161s' },
        { target: 480, duration: '300s' },
        { target: 640, duration: '161s' },
        { target: 640, duration: '300s' },
        { target: 800, duration: '161s' },
        { target: 800, duration: '300s' },
        { target: 960, duration: '161s' },
        { target: 960, duration: '300s' }
      ],
      exec: 'identity'
    },
    idReuse: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 432,
      maxVUs: 864,
      stages: [
        { target: 24, duration: '13s' },
        { target: 24, duration: '448s' },
        { target: 48, duration: '13s' },
        { target: 48, duration: '448s' },
        { target: 72, duration: '13s' },
        { target: 72, duration: '448s' },
        { target: 96, duration: '13s' },
        { target: 96, duration: '448s' },
        { target: 120, duration: '13s' },
        { target: 120, duration: '448s' },
        { target: 144, duration: '13s' },
        { target: 144, duration: '448s' }
      ],
      exec: 'idReuse'
    }
  },
  perf006I4RegressionTest: {
    identity: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 9,
      maxVUs: 18,
      stages: [
        { target: 5, duration: '6s' },
        { target: 5, duration: '15m' }
      ],
      exec: 'identity'
    },
    idReuse: {
      executor: 'ramping-arrival-rate',
      startRate: 6,
      timeUnit: '1m',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 6, duration: '1s' },
        { target: 6, duration: '15m' }
      ],
      exec: 'idReuse'
    }
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignUpScenario('identity', 570, 36, 571),
    ...createI4PeakTestSignInScenario('idReuse', 65, 6, 30)
  },
  perf006Iteration5SpikeTest: {
    ...createI3SpikeSignUpScenario('identity', 1130, 36, 1131),
    ...createI3SpikeSignInScenario('idReuse', 162, 6, 74)
  },
  perf006Iteration6PeakTest: {
    ...createI4PeakTestSignUpScenario('identity', 570, 36, 571),
    ...createI4PeakTestSignInScenario('idReuse', 104, 6, 48)
  },
  perf006Iteration6SpikeTest: {
    ...createI3SpikeSignUpScenario('identity', 570, 36, 571),
    ...createI3SpikeSignInScenario('idReuse', 260, 6, 119)
  },
  perf006SISPhase2PeakTest: {
    ...createI4PeakTestSignUpScenario('identity', 200, 42, 201),
    ...createI4PeakTestSignInScenario('idReuse', 100, 6, 46)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('identity', 180, 42, 181),
    ...createI4PeakTestSignInScenario('idReuse', 71, 6, 33)
  },
  perf006Iteration7SpikeTest: {
    ...createI3SpikeSignUpScenario('identity', 540, 36, 541),
    ...createI3SpikeSignInScenario('idReuse', 143, 6, 66)
  },
  perf006Iteration8PeakTest: {
    ...createI4PeakTestSignUpScenario('identity', 170, 42, 171),
    ...createI4PeakTestSignInScenario('idReuse', 126, 6, 58)
  },
  perf006Iteration8SpikeTest: {
    ...createI3SpikeSignUpScenario('identity', 630, 42, 631),
    ...createI3SpikeSignInScenario('idReuse', 227, 6, 104)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  identity: [
    'B01_Identity_01_LaunchOrchestratorStub',
    'B01_Identity_02_GoToFullJourneyRoute',
    'B01_Identity_02_GoToFullJourneyRoute::01_OrchStubCall',
    'B01_Identity_02_GoToFullJourneyRoute::02_CoreCall',
    'B01_Identity_03_LiveInTheUK',
    'B01_Identity_04_SelectPhotoIDChoice',
    'B01_Identity_05_SelectDeviceOption',
    'B01_Identity_06_SelectNoSmartphone',
    'B01_Identity_07_SelectAnotherWayToProveIdentity',
    'B01_Identity_08_SelectDocumentType',
    'B01_Identity_08_SelectDocumentType::01_CoreCall',
    'B01_Identity_08_SelectDocumentType::02_PassStub',
    'B01_Identity_08_SelectDocumentType::02_DLStub',
    'B01_Identity_09_DocumentDataContinue',
    'B01_Identity_09_DocumentDataContinue::01_PassStub',
    'B01_Identity_09_DocumentDataContinue::01_DLStub',
    'B01_Identity_09_DocumentDataContinue::02_CoreCall',
    'B01_Identity_09_DocumentDataContinue::03_AddStub',
    'B01_Identity_10_AddrDataContinue',
    'B01_Identity_10_AddrDataContinue::01_AddStub',
    'B01_Identity_10_AddrDataContinue::02_CoreCall',
    'B01_Identity_10_AddrDataContinue::03_FraudStub',
    'B01_Identity_11_FraudDataContinue',
    'B01_Identity_11_FraudDataContinue::01_FraudStub',
    'B01_Identity_11_FraudDataContinue::02_CoreCall',
    'B01_Identity_12_PersonalIndependencePayment',
    'B01_Identity_13_PreKBVTransition',
    'B01_Identity_13_PreKBVTransition::01_CoreCall',
    'B01_Identity_13_PreKBVTransition::02_KBVStub',
    'B01_Identity_14_KBVDataContinue',
    'B01_Identity_14_KBVDataContinue::01_KBVStub',
    'B01_Identity_14_KBVDataContinue::02_CoreCall',
    'B01_Identity_15_ContinueSuccessPage',
    'B01_Identity_15_ContinueSuccessPage::01_CoreCall',
    'B01_Identity_15_ContinueSuccessPage::02_OrchStub'
  ],
  idReuse: [
    'B02_IDReuse_01_LoginToCore',
    'B02_IDReuse_01_LoginToCore::01_OrchStub',
    'B02_IDReuse_01_LoginToCore::02_CoreCall',
    'B02_IDReuse_02_ClickContinue',
    'B02_IDReuse_02_ClickContinue::01_CoreCall',
    'B02_IDReuse_02_ClickContinue::02_OrchStub'
  ],
  orchStubIsolatedTest: [
    'B01_Identity_01_LaunchOrchestratorStub',
    'B01_Identity_02_GoToFullJourneyRoute',
    'B01_Identity_02_GoToFullJourneyRoute::01_OrchStubCall'
  ],
  identityM1C: [
    'B01_IdentityM1C_01_LaunchOrchestratorStub',
    'B01_IdentityM1C_02_GoToFullJourneyRoute',
    'B01_IdentityM1C_02_GoToFullJourneyRoute::01_OrchStubCall',
    'B01_IdentityM1C_02_GoToFullJourneyRoute::02_CoreCall',
    'B01_IdentityM1C_03_LiveInTheUK',
    'B01_IdentityM1C_04_ClickContinueStartPage',
    'B01_IdentityM1C_04_ClickContinueStartPage::01_CoreCall',
    'B01_IdentityM1C_04_ClickContinueStartPage::02_DCMAWStub',
    'B01_IdentityM1C_05_DCMAWContinue',
    'B01_IdentityM1C_05_DCMAWContinue::01_DCMAWStub',
    'B01_IdentityM1C_05_DCMAWContinue::02_CoreCall',
    'B01_IdentityM1C_06_DCMAWSuccessPage',
    'B01_IdentityM1C_06_DCMAWSuccessPage::01_CoreCall',
    'B01_IdentityM1C_06_DCMAWSuccessPage::02_AddStub',
    'B01_IdentityM1C_07_AddrDataContinue',
    'B01_IdentityM1C_07_AddrDataContinue::01_AddStub',
    'B01_IdentityM1C_07_AddrDataContinue::02_CoreCall',
    'B01_IdentityM1C_07_AddrDataContinue::03_FraudStub',
    'B01_IdentityM1C_08_FraudDataContinue',
    'B01_IdentityM1C_08_FraudDataContinue::01_FraudStub',
    'B01_IdentityM1C_08_FraudDataContinue::02_CoreCall',
    'B01_IdentityM1C_09_ContinueSuccessPage',
    'B01_IdentityM1C_09_ContinueSuccessPage::01_CoreCall',
    'B01_IdentityM1C_09_ContinueSuccessPage::02_OrchStub'
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

interface IDReuseUserID {
  userID: string
  emailID: string
}

const csvData: IDReuseUserID[] = new SharedArray('ID Reuse User ID', function () {
  return open('./data/idReuseTestData.csv')
    .split('\n')
    .slice(1)
    .map(s => {
      const data = s.split(',')
      return { userID: data[0], emailID: data[1] }
    })
})

const environment = getEnv('ENVIRONMENT').toLocaleUpperCase()
const validEnvironments = ['BUILD', 'DEV', 'DEFAULT', 'PERF']
if (!validEnvironments.includes(environment))
  throw new Error(`Environment '${environment}' not in [${validEnvironments.toString()}]`)

const env = {
  orchStubEndPoint: getEnv(`IDENTITY_${environment}_ORCH_STUB_URL`),
  ipvCoreURL: getEnv(`IDENTITY_${environment}_CORE_URL`),
  vtrText: getEnv(`IDENTITY_${environment}_CORE_VTR_TEXT`)
  // staticResources: getEnv('K6_NO_STATIC_RESOURCES') !== 'true'
}

const stubCreds = {
  userName: getEnv('IDENTITY_ORCH_STUB_USERNAME'),
  password: getEnv('IDENTITY_ORCH_STUB_PASSWORD')
}

export function identity(stubOnly: boolean = false): void {
  const groups = groupMap.identity
  let res: Response
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:]/g, '') // YYMMDDTHHmm
  const iteration = execution.scenario.iterationInInstance.toString().padStart(6, '0')
  const testEmail = `perftest${timestamp}${iteration}@digital.cabinet-office.gov.uk`
  const passport = Math.random() < 0.8
  iterationsStarted.add(1)

  // B01_Identity_01_LaunchOrchestratorStub
  res = timeGroup(
    groups[0],
    () =>
      http.get(env.orchStubEndPoint, {
        headers: { Authorization: `Basic ${encodedCredentials}` }
      }),
    { isStatusCode200, ...pageContentCheck('Enter userId manually') }
  )

  const userId = getUserId(res)
  const signInJourneyId = getSignInJourneyId(res)

  sleepBetween(0.5, 1)

  // B01_Identity_02_GoToFullJourneyRoute
  timeGroup(groups[1], () => {
    // 01_OrchStub
    res = timeGroup(
      groups[2].split('::')[1],
      () =>
        http.get(
          env.orchStubEndPoint +
            `/authorize?journeyType=full&userIdText=${userId}&signInJourneyIdText=${signInJourneyId}&vtrText=${env.vtrText}&targetEnvironment=${environment}&reproveIdentity=NOT_PRESENT&emailAddress=${testEmail}&votText=&jsonPayload=&evidenceJsonPayload=&error=recoverable`,
          {
            headers: { Authorization: `Basic ${encodedCredentials}` },
            redirects: 0
          }
        ),
      { isStatusCode302 }
    )
    if (stubOnly) return
    // 02_CoreCall
    res = timeGroup(groups[3].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Where do you live?')
    })
  })
  if (stubOnly) {
    iterationsCompleted.add(1)
    return
  }

  sleepBetween(0.5, 1)

  // B01_Identity_03_LiveInTheUK
  res = timeGroup(
    groups[4],
    () =>
      res.submitForm({
        fields: { journey: 'uk' }
      }),
    { isStatusCode200, ...pageContentCheck('Tell us if you have one of the following types of photo ID') }
  )

  sleepBetween(0.5, 1)

  // B01_Identity_04_SelectPhotoIDChoice
  res = timeGroup(
    groups[5],
    () =>
      res.submitForm({
        fields: { journey: 'appTriage' }
      }),
    { isStatusCode200, ...pageContentCheck('Are you on a computer or a tablet right now?') }
  )

  sleepBetween(0.5, 1)

  // B01_Identity_05_SelectDeviceOption
  res = timeGroup(
    groups[6],
    () =>
      res.submitForm({
        fields: { journey: 'computer-or-tablet' }
      }),
    { isStatusCode200, ...pageContentCheck('Do you have access to an iPhone or Android phone?') }
  )

  sleepBetween(0.5, 1)

  // B01_Identity_06_SelectNoSmartphone
  res = timeGroup(
    groups[7],
    () =>
      res.submitForm({
        fields: { journey: 'neither' }
      }),
    { isStatusCode200, ...pageContentCheck('Are you sure you want to try to prove your identity another way?') }
  )

  sleepBetween(0.5, 1)

  // B01_Identity_07_SelectAnotherWayToProveIdentity
  res = timeGroup(
    groups[8],
    () =>
      res.submitForm({
        fields: { journey: 'anotherWay' }
      }),
    { isStatusCode200, ...pageContentCheck('How would you like to prove your identity?') }
  )

  sleepBetween(0.5, 1)

  // B01_Identity_08_SelectDocumentType
  timeGroup(groups[9], () => {
    // 01_CoreCall
    res = timeGroup(
      groups[10].split('::')[1],
      () =>
        res.submitForm({
          fields: { journey: passport ? 'ukPassport' : 'drivingLicence' },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )
    // 02_XXXStub
    const name = (passport ? groups[11] : groups[12]).split('::')[1]
    const content = passport ? 'UK Passport (Stub)' : 'Driving Licence (Stub)'
    res = timeGroup(name, () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck(content)
    })
  })

  sleepBetween(0.5, 1)

  // B01_Identity_09_DocumentDataContinue
  timeGroup(groups[13], () => {
    // 01_XXXStub
    const name = (passport ? groups[14] : groups[15]).split('::')[1] // groups[14] is PassStub, groups[15] is DLStub
    res = timeGroup(
      name,
      () =>
        res.submitForm({
          fields: passport
            ? {
                jsonPayload: passportPayload,
                strengthScore: '4',
                validityScore: '2'
              }
            : {
                jsonPayload: drivingLicencePayload,
                strengthScore: '3',
                validityScore: '2',
                activityHistoryScore: '1'
              },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )

    // 02_CoreCall
    res = timeGroup(groups[16].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
      isStatusCode302
    })
    // 03_AddStub
    res = timeGroup(groups[17].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Address (Stub)')
    })
  })

  sleepBetween(0.5, 1)

  // B01_Identity_10_AddrDataContinue
  timeGroup(groups[18], () => {
    // 01_AddStub
    res = timeGroup(
      groups[19].split('::')[1],
      () =>
        res.submitForm({
          fields: { jsonPayload: passport ? addressPayloadP : addressPayloadDL },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )
    // 02_CoreCall
    res = timeGroup(groups[20].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
      isStatusCode302
    })
    // 03_FraudStub
    res = timeGroup(groups[21].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Fraud Check (Stub)')
    })
  })

  sleepBetween(0.5, 1)

  // B01_Identity_11_FraudDataContinue
  timeGroup(groups[22], () => {
    // 01_FraudStub
    res = timeGroup(
      groups[23].split('::')[1],
      () =>
        res.submitForm({
          fields: passport
            ? {
                jsonPayload: fraudPayloadP,
                identityFraudScore: '2',
                activityHistoryScore: '1'
              }
            : {
                jsonPayload: fraudPayloadDL,
                identityFraudScore: '2',
                activityHistoryScore: '2'
              },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )
    // 02_CoreCall
    res = timeGroup(groups[24].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Tell us if you get Personal Independence Payment (PIP)')
    })
  })

  sleepBetween(0.5, 1)

  // B01_Identity_12_PersonalIndependencePayment
  res = timeGroup(
    groups[25],
    () =>
      res.submitForm({
        fields: { journey: 'end' }
      }),
    { isStatusCode200, ...pageContentCheck('Answer security questions') }
  )

  sleepBetween(0.5, 1)

  // B01_Identity_13_PreKBVTransition
  timeGroup(groups[26], () => {
    // 01_CoreCall
    res = timeGroup(
      groups[27].split('::')[1],
      () =>
        res.submitForm({
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )
    // 02_KBVStub
    res = timeGroup(groups[28].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Knowledge Based Verification (Stub)')
    })
  })

  sleepBetween(0.5, 1)

  // B01_Identity_14_KBVDataContinue
  timeGroup(groups[29], () => {
    // 01_KBVStub
    res = timeGroup(
      groups[30].split('::')[1],
      () =>
        res.submitForm({
          fields: {
            jsonPayload: passport ? kbvPayloadP : kbvPayloaDL,
            verificationScore: '2'
          },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )
    // 02_CoreCall
    res = timeGroup(groups[31].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Continue to the service you need to use')
    })
  })

  sleepBetween(0.5, 1)

  // B01_Identity_15_ContinueSuccessPage
  timeGroup(groups[32], () => {
    // 01_CoreCall
    res = timeGroup(
      groups[33].split('::')[1],
      () => http.get(env.ipvCoreURL + '/ipv/journey/page-ipv-success/next', { redirects: 0 }),
      { isStatusCode302 }
    )
    // 02_OrchStub
    res = timeGroup(
      groups[34].split('::')[1],
      () =>
        http.get(res.headers.Location, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('User information') }
    )
  })
  iterationsCompleted.add(1)
}

export function idReuse(): void {
  const groups = groupMap.idReuse
  let res: Response
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  const idReuseUserID = csvData[execution.scenario.iterationInTest % csvData.length]
  iterationsStarted.add(1)
  const signInJourneyId = uuidv4()

  // B03_IDReuse_01_LoginToCore
  timeGroup(groups[0], () => {
    // 01_OrchStub
    res = timeGroup(
      groups[1].split('::')[1],
      () =>
        http.get(
          env.orchStubEndPoint +
            `/authorize?journeyType=full&userIdText=${idReuseUserID.userID}&signInJourneyIdText=${signInJourneyId}&vtrText=${env.vtrText}&targetEnvironment=${environment}&reproveIdentity=NOT_PRESENT&emailAddress=${idReuseUserID.emailID}&votText=&jsonPayload=&evidenceJsonPayload=&error=recoverable`,
          {
            headers: { Authorization: `Basic ${encodedCredentials}` },
            redirects: 0
          }
        ),
      { isStatusCode302 }
    )
    // 02_CoreCall
    res = timeGroup(groups[2].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('You have already proved your identity')
    })
  })

  sleepBetween(0.5, 1)

  // B03_IDReuse_02_ClickContinue
  timeGroup(groups[3], () => {
    // 01_CoreCall
    res = timeGroup(
      groups[4].split('::')[1],
      () => http.get(env.ipvCoreURL + '/ipv/journey/page-ipv-reuse/next', { redirects: 0 }),
      { isStatusCode302 }
    )
    // 02_OrchStub
    res = timeGroup(
      groups[5].split('::')[1],
      () =>
        http.get(res.headers.Location, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('User information') }
    )
  })
  iterationsCompleted.add(1)
}

export function identityM1C(): void {
  const groups = groupMap.identityM1C
  let res: Response
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:]/g, '') // YYMMDDTHHmm
  const iteration = execution.scenario.iterationInInstance.toString().padStart(6, '0')
  const testEmail = `perftest${timestamp}${iteration}@digital.cabinet-office.gov.uk`
  iterationsStarted.add(1)

  // B01_IdentityM1C_01_LaunchOrchestratorStub
  res = timeGroup(
    groups[0],
    () =>
      http.get(env.orchStubEndPoint, {
        headers: { Authorization: `Basic ${encodedCredentials}` }
      }),
    { isStatusCode200, ...pageContentCheck('Enter userId manually') }
  )

  const userId = getUserId(res)
  const signInJourneyId = getSignInJourneyId(res)

  sleepBetween(0.5, 1)

  // B01_IdentityM1C_02_GoToFullJourneyRoute
  timeGroup(groups[1], () => {
    // 01_OrchStub
    res = timeGroup(
      groups[2].split('::')[1],
      () =>
        http.get(
          env.orchStubEndPoint +
            `/authorize?journeyType=full&userIdText=${userId}&signInJourneyIdText=${signInJourneyId}&vtrText=${env.vtrText}&targetEnvironment=${environment}&reproveIdentity=NOT_PRESENT&emailAddress=${testEmail}&votText=&jsonPayload=&evidenceJsonPayload=&error=recoverable`,
          {
            headers: { Authorization: `Basic ${encodedCredentials}` },
            redirects: 0
          }
        ),
      { isStatusCode302 }
    )
    // 02_CoreCall
    res = timeGroup(groups[3].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Do you live in the UK, the Channel Islands or the Isle of Man') // Do you live in the UK, the Channel Islands or the Isle of Man
    })
  })

  sleepBetween(0.5, 1)

  // B01_IdentityM1C_03_LiveInTheUK
  res = timeGroup(
    groups[4],
    () =>
      res.submitForm({
        fields: { journey: 'uk' }
      }),
    { isStatusCode200, ...pageContentCheck('Tell us if you have one of the following types of photo ID') }
  )

  // B01_IdentityM1C_04_ClickContinueStartPage
  timeGroup(groups[5], () => {
    // 01_CoreCall
    res = timeGroup(
      groups[6].split('::')[1],
      () =>
        res.submitForm({
          fields: { journey: 'appTriage' },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )
    // 02_DCMAWStub
    res = timeGroup(groups[7].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('DOC Checking App (Stub)')
    })
  })

  sleepBetween(0.5, 1)

  // B01_IdentityM1C_05_DCMAWContinue
  timeGroup(groups[8], () => {
    // 01_DCMAWStub
    res = timeGroup(
      groups[9].split('::')[1],
      () =>
        res.submitForm({
          fields: {
            jsonPayload: passportPayloadM1C,
            expand_evidence: 'on',
            evidenceJsonPayload: chippedPassportPayloadM1C
          },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )
    //02_CoreCall
    res = timeGroup(groups[10].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('successfully matched you to the photo on your ID')
    })
  })

  sleepBetween(0.5, 1)

  // B01_IdentityM1C_06_DCMAWSuccessPage
  timeGroup(groups[11], () => {
    // 01_CoreCall
    res = timeGroup(
      groups[12].split('::')[1],
      () =>
        res.submitForm({
          fields: {
            journey: 'next'
          },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )
    // 02_AddressStub
    res = timeGroup(groups[13].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Address (Stub)')
    })
  })

  sleepBetween(0.5, 1)

  // B01_IdentityM1C_07_AddrDataContinue
  timeGroup(groups[14], () => {
    // 01_AddStub
    res = timeGroup(
      groups[15].split('::')[1],
      () =>
        res.submitForm({
          fields: { jsonPayload: addressPayloadM1C },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )
    // 02_CoreCall
    res = timeGroup(groups[16].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
      isStatusCode302
    })
    // 03_FraudStub
    res = timeGroup(groups[17].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Fraud Check (Stub)')
    })
  })

  sleepBetween(0.5, 1)

  // B01_IdentityM1C_08_FraudDataContinue
  timeGroup(groups[18], () => {
    // 01_FraudStub
    res = timeGroup(
      groups[19].split('::')[1],
      () =>
        res.submitForm({
          fields: {
            jsonPayload: fraudPayloadM1C,
            expand_evidence: 'on',
            evidenceJsonPayload: failedFraudCheckPayloadM1C
          },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )
    // 02_CoreCall
    res = timeGroup(groups[20].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Continue to the service you need to use')
    })
  })

  sleepBetween(0.5, 1)

  // B01_IdentityM1C_09_ContinueSuccessPage
  timeGroup(groups[21], () => {
    // 01_CoreCall
    res = timeGroup(
      groups[22].split('::')[1],
      () =>
        res.submitForm({
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )
    // 02_OrchStub
    res = timeGroup(
      groups[23].split('::')[1],
      () =>
        http.get(res.headers.Location, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('available_authoritative_source') }
    )
  })
  iterationsCompleted.add(1)
}

export function orchStubIsolatedTest(): void {
  identity(true)
}

function getUserId(r: Response): string {
  return r.html().find("input[name='userIdText']").val() ?? 'User ID not found'
}

function getSignInJourneyId(r: Response): string {
  return r.html().find("input[name='signInJourneyIdText']").val() ?? 'Sign In Journey ID not found'
}
