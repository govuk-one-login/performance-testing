import { sleep } from 'k6'
import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile,
  createScenario,
  LoadProfile,
  createI4PeakTestSignUpScenario,
  createI3SpikeSignUpScenario
} from '../common/utils/config/load-profiles'
import {
  postSelectDevice,
  postSelectSmartphone,
  postValidPassport,
  postBiometricChip,
  postIdCheckApp,
  startJourney,
  getSessionIdFromCookieJar
} from './testSteps/frontend'
import {
  getBiometricTokenV2,
  postFinishBiometricSession,
  postTxmaEvent,
  postToken,
  setupVendorResponse,
  getRedirect,
  getAppInfo,
  postUserInfoV2
} from './testSteps/backend'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('mamIphonePassport', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('mamIphonePassport', LoadProfile.full, 10, 40)
  },
  load: {
    ...createScenario('mamIphonePassport', LoadProfile.full, 40, 40)
  },
  nfrload: {
    ...createScenario('mamIphonePassport', LoadProfile.full, 95, 40)
  },
  deploy: {
    ...createScenario('mamIphonePassport', LoadProfile.deployment, 1, 40)
  },
  incrementalSmallVolumes: {
    ...createScenario('mamIphonePassport', LoadProfile.incremental, 40)
  },
  incrementalLoad: {
    ...createScenario('mamIphonePassport', LoadProfile.incremental, 100)
  },
  lowVolumePERF007Test: {
    mamIphonePassport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 20, duration: '200s' },
        { target: 20, duration: '180s' }
      ],
      exec: 'mamIphonePassport'
    }
  },
  perf006Iteration3PeakTest: {
    mamIphonePassport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 338,
      maxVUs: 675,
      stages: [
        { target: 150, duration: '151s' },
        { target: 150, duration: '30m' }
      ],
      exec: 'mamIphonePassport'
    }
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('mamIphonePassport', 450, 48, 451)
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignUpScenario('mamIphonePassport', 540, 48, 541)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('mamIphonePassport', 170, 48, 171)
  },
  perf006Iteration8PeakTest: {
    ...createI4PeakTestSignUpScenario('mamIphonePassport', 160, 48, 161)
  },
  perf006Iteration8SpikeTest: {
    ...createI3SpikeSignUpScenario('mamIphonePassport', 600, 48, 601)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  mamIphonePassport: [
    'POST test client /start',
    'GET /authorize',
    'POST /selectDevice',
    'POST /selectSmartphone',
    'POST /validPassport',
    'POST /biometricChip',
    'POST /idCheckApp',
    'GET /appInfo', //BE
    'GET /biometricToken/v2',
    'POST /txmaEvent', //BE
    'POST /finishBiometricSession', //BE
    'GET /redirect', //BE
    'POST /token', //BE
    'POST /v2/setupVendorResponse/', //BE
    'POST /userinfo/v2' //BE
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

export function mamIphonePassport(): void {
  iterationsStarted.add(1)
  startJourney()
  simulateUserWait()
  postSelectDevice()
  simulateUserWait()
  postSelectSmartphone()
  simulateUserWait()
  postValidPassport()
  simulateUserWait()
  postBiometricChip()
  simulateUserWait()
  postIdCheckApp()
  simulateUserWait()
  getAppInfo() // BE
  simulateUserWait()
  const sessionId = getSessionIdFromCookieJar()
  const opaqueId = getBiometricTokenV2(sessionId)
  sleep(1)
  postTxmaEvent(sessionId) // BE
  sleep(3)
  const biometricSessionId = postFinishBiometricSession(sessionId) // BE
  sleep(1)
  const { authorizationCode, redirectUri } = getRedirect(sessionId) //BE
  sleep(1)
  const accessToken = postToken(authorizationCode, redirectUri) // BE
  sleep(1)
  setupVendorResponse(biometricSessionId, opaqueId)
  sleep(1)
  postUserInfoV2(accessToken)
  iterationsCompleted.add(1)
}

function simulateUserWait(): void {
  sleepBetween(1, 2) // Simulate random time between 1s and 2s for user to stay on page
}
