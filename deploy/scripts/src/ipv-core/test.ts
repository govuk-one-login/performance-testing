import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import encoding from 'k6/encoding'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { timeGroup } from '../common/utils/request/timing'
import { passportPayload, addressPayloadP, kbvPayloadP, fraudPayloadP } from './data/passportData'
import { addressPayloadDL, kbvPayloaDL, fraudPayloadDL, drivingLicencePayload } from './data/drivingLicenceData'
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
    ...createScenario('orchStubIsolatedTest', LoadProfile.smoke)
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
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  identity: [
    'B01_Identity_01_LaunchOrchestratorStub',
    'B01_Identity_02_GoToFullJourneyRoute',
    'B01_Identity_02_GoToFullJourneyRoute::01_OrchStubCall',
    'B01_Identity_02_GoToFullJourneyRoute::02_CoreCall',
    'B01_Identity_03_ClickContinueStartPage',
    'B01_Identity_03_ClickContinueStartPage::01_CoreCall',
    'B01_Identity_03_ClickContinueStartPage::02_DCMAWStub',
    'B01_Identity_04_DCMAWContinue',
    'B01_Identity_04_DCMAWContinue::01_DCMAWStub',
    'B01_Identity_04_DCMAWContinue::02_CoreCall',
    'B01_Identity_05_ContinueOnPYIStartPage',
    'B01_Identity_05_ContinueOnPYIStartPage::01_CoreCall',
    'B01_Identity_05_ContinueOnPYIStartPage::02_PassStub',
    'B01_Identity_05_ContinueOnPYIStartPage::02_DLStub',
    'B01_Identity_06_DocumentDataContinue',
    'B01_Identity_06_DocumentDataContinue::01_PassStub',
    'B01_Identity_06_DocumentDataContinue::01_DLStub',
    'B01_Identity_06_DocumentDataContinue::02_CoreCall',
    'B01_Identity_06_DocumentDataContinue::03_AddStub',
    'B01_Identity_07_AddrDataContinue',
    'B01_Identity_07_AddrDataContinue::01_AddStub',
    'B01_Identity_07_AddrDataContinue::02_CoreCall',
    'B01_Identity_07_AddrDataContinue::03_FraudStub',
    'B01_Identity_08_FraudDataContinue',
    'B01_Identity_08_FraudDataContinue::01_FraudStub',
    'B01_Identity_08_FraudDataContinue::02_CoreCall',
    'B01_Identity_09_PreKBVTransition',
    'B01_Identity_09_PreKBVTransition::01_CoreCall',
    'B01_Identity_09_PreKBVTransition::02_KBVStub',
    'B01_Identity_10_KBVDataContinue',
    'B01_Identity_10_KBVDataContinue::01_KBVStub',
    'B01_Identity_10_KBVDataContinue::02_CoreCall',
    'B01_Identity_11_ContinueSuccessPage',
    'B01_Identity_11_ContinueSuccessPage::01_CoreCall',
    'B01_Identity_11_ContinueSuccessPage::02_OrchStub'
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
const validEnvironments = ['BUILD', 'DEV', 'DEFAULT']
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
      ...pageContentCheck('Tell us if you have one of the following types of photo ID') // Do you live in the UK, the Channel Islands or the Isle of Man
    })
  })
  if (stubOnly) {
    iterationsCompleted.add(1)
    return
  }

  sleepBetween(0.5, 1)

  /*
  // B01_Identity_03_LiveInTheUK
  res = timeGroup(
    groups[4],
    () =>
      res.submitForm({
        fields: { journey: 'uk' }
      }),
    { isStatusCode200, ...pageContentCheck('Tell us if you have one of the following types of photo ID') }
  )
    */

  // B01_Identity_03_ClickContinueStartPage
  timeGroup(groups[4], () => {
    // 01_CoreCall
    res = timeGroup(
      groups[5].split('::')[1],
      () =>
        res.submitForm({
          fields: { journey: 'appTriage' },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )
    // 02_DCMAWStub
    res = timeGroup(groups[6].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('DOC Checking App (Stub)')
    })
  })

  sleepBetween(0.5, 1)

  // B01_Identity_04_DCMAWContinue
  timeGroup(groups[7], () => {
    // 01_DCMAWStub
    res = timeGroup(
      groups[8].split('::')[1],
      () =>
        res.submitForm({
          fields: {
            requested_oauth_error_endpoint: 'auth',
            requested_oauth_error: 'access_denied'
          },
          params: { redirects: 1 }
        }),
      { isStatusCode302 }
    )
    // 02_CoreCall
    res = timeGroup(groups[9].split('::')[1], () => http.get(env.ipvCoreURL + res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Enter your UK passport details')
    })
  })

  sleepBetween(0.5, 1)

  // B01_Identity_05_ContinueOnPYIStartPage
  timeGroup(groups[10], () => {
    // 01_CoreCall
    res = timeGroup(
      groups[11].split('::')[1],
      () =>
        res.submitForm({
          fields: { journey: passport ? 'ukPassport' : 'drivingLicence' },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )
    // 02_XXXStub
    const name = (passport ? groups[12] : groups[13]).split('::')[1]
    const content = passport ? 'UK Passport (Stub)' : 'Driving Licence (Stub)'
    res = timeGroup(name, () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck(content)
    })
  })

  sleepBetween(0.5, 1)

  // B01_Identity_06_DocumentDataContinue
  timeGroup(groups[14], () => {
    // 01_XXXStub
    const name = (passport ? groups[15] : groups[16]).split('::')[1]
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
    res = timeGroup(groups[17].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
      isStatusCode302
    })
    // 03_AddStub
    res = timeGroup(groups[18].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Address (Stub)')
    })
  })

  sleepBetween(0.5, 1)

  // B01_Identity_07_AddrDataContinue
  timeGroup(groups[19], () => {
    // 01_AddStub
    res = timeGroup(
      groups[20].split('::')[1],
      () =>
        res.submitForm({
          fields: { jsonPayload: passport ? addressPayloadP : addressPayloadDL },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )
    // 02_CoreCall
    res = timeGroup(groups[21].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
      isStatusCode302
    })
    // 03_FraudStub
    res = timeGroup(groups[22].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Fraud Check (Stub)')
    })
  })

  sleepBetween(0.5, 1)

  // B01_Identity_08_FraudDataContinue
  timeGroup(groups[23], () => {
    // 01_FraudStub
    res = timeGroup(
      groups[24].split('::')[1],
      () =>
        res.submitForm({
          fields: passport
            ? {
                jsonPayload: fraudPayloadP,
                identityFraudScore: '2'
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
    res = timeGroup(groups[25].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Answer security questions')
    })
  })

  sleepBetween(0.5, 1)

  // B01_Identity_09_PreKBVTransition
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

  // B01_Identity_10_KBVDataContinue
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

  // B01_Identity_11_ContinueSuccessPage
  timeGroup(groups[32], () => {
    // 01_CoreCall
    res = timeGroup(
      groups[33].split('::')[1],
      () =>
        res.submitForm({
          params: { redirects: 0 }
        }),
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
  const idReuseUserID = csvData[execution.vu.idInTest - 1]
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
      () =>
        res.submitForm({
          fields: { submitButton: '' },
          params: { redirects: 0 },
          submitSelector: '#continue'
        }),
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

export function orchStubIsolatedTest(): void {
  identity(true)
}

function getUserId(r: Response): string {
  return r.html().find("input[name='userIdText']").val() ?? 'User ID not found'
}

function getSignInJourneyId(r: Response): string {
  return r.html().find("input[name='signInJourneyIdText']").val() ?? 'Sign In Journey ID not found'
}
