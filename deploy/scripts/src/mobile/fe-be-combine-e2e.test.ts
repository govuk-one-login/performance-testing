import { sleep } from 'k6'
import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile,
  createScenario,
  LoadProfile,
  createI4PeakTestSignUpScenario,
  createI3SpikeSignUpScenario,
  createStressTestSignUpScenario
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
  getRedirect,
  getAppInfo,
  postUserInfoV2,
  setupBiometricSessionByScenario
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
  },
  perf006Iteration9StressTest: {
    ...createStressTestSignUpScenario('mamIphonePassport', 600, 48, 601)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  mamIphonePassport: [
    '01_POST_testclient_/start',
    '02_GET_/authorize',
    '03_POST_/selectDevice',
    '04_POST_/selectSmartphone',
    '05_POST_/validPassport',
    '06_POST_/biometricChip',
    '07_POST_/idCheckApp',
    '08_GET_/appInfo', //BE
    '09_GET_/biometricToken/v2',
    '10_POST_/txmaEvent', //BE
    '11_POST_/finishBiometricSession', //BE
    '12_GET_/redirect', //BE
    '13_POST_/token', //BE
    '14_POST_/v2/setupBiometricSessionByScenario/', //BE
    '15_POST_/userinfo/v2' //BE
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
  setupBiometricSessionByScenario({ biometricSessionId, opaqueId })
  sleep(1)
  postUserInfoV2(accessToken)
  iterationsCompleted.add(1)
}

function simulateUserWait(): void {
  sleepBetween(1, 2) // Simulate random time between 1s and 2s for user to stay on page
}
