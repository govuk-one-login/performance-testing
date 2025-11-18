import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile,
  createScenario,
  LoadProfile,
  createI4PeakTestSignUpScenario,
  createI3SpikeSignUpScenario,
  createI4PeakTestSignInScenario
} from '../common/utils/config/load-profiles'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
import { getActiveSession } from './testSteps/getActiveSession'
import { postBiometricToken } from './testSteps/postBiometricToken'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getWellknownJwks } from './testSteps/getWellKnownJwks'
import { postTxmaEvent } from './testSteps/postTxmaEvent'
import { uuidv4 } from '../common/utils/jslib'
import { postFinishBiometricSession } from './testSteps/postFinishBiometricSession'
import { postAbortSession } from './testSteps/postAbortSession'
import { postToken } from './testSteps/postToken'
import { postCredential } from './testSteps/postCredential'
import { postSetupBiometricSessionByScenario } from './testSteps/postSetupBiometricSessionByScenario'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('idCheckAsyncSignUp', LoadProfile.smoke),
    ...createScenario('idCheckAsyncSignIn', LoadProfile.smoke)
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('idCheckAsyncSignUp', 450, 27, 451)
  },
  perf006Iteration4SpikeTest: {
    ...createI3SpikeSignUpScenario('idCheckAsyncSignUp', 1074, 27, 1075)
  },
  perf006Iteration4CombinedPeakTest: {
    ...createI4PeakTestSignUpScenario('idCheckAsyncSignUp', 450, 27, 451),
    ...createI4PeakTestSignInScenario('idCheckAsyncSignIn', 43, 3, 21)
  },
  perf006Iteration5CombinedPeakTest: {
    ...createI4PeakTestSignUpScenario('idCheckAsyncSignUp', 540, 30, 541),
    ...createI4PeakTestSignInScenario('idCheckAsyncSignIn', 65, 3, 30)
  },
  perf006Iteration6CombinedPeakTest: {
    ...createI4PeakTestSignUpScenario('idCheckAsyncSignUp', 540, 30, 541),
    ...createI4PeakTestSignInScenario('idCheckAsyncSignIn', 104, 3, 48)
  },
  Perf006Iteration7CombinedPeakTest: {
    ...createI4PeakTestSignUpScenario('idCheckAsyncSignUp', 170, 30, 171),
    ...createI4PeakTestSignInScenario('idCheckAsyncSignIn', 71, 3, 33)
  }
}

const loadProfile = selectProfile(profiles)
export const groupMap = {
  idCheckAsyncSignUp: [
    'B01_IDCheckSignUpV2_00_POST_/async/token', //pragma: allowlist secret
    'B01_IDCheckSignUpV2_01_POST_/async/credential', //pragma: allowlist secret
    'B01_IDCheckSignUpV2_02_POST_sts-mock /token',
    'B01_IDCheckSignUpV2_03_GET_/async/activeSession', //pragma: allowlist secret
    'B01_IDCheckSignUpV2_04_POST_/async/biometricToken', //pragma: allowlist secret
    'B01_IDCheckSignUpV2_05_GET_/async/.well-known/jwks.json',
    'B01_IDCheckSignUpV2_06_POST_/async/txmaEvent', //pragma: allowlist secret
    'B01_IDCheckSignUpV2_07_POST_readid-mock /postSetupBiometricSessionByScenario',
    'B01_IDCheckSignUpV2_08_POST_async/finishBiometricSession', //pragma: allowlist secret
    'B01_IDCheckSignUpV2_09_POST async/abortSession'
  ],
  idCheckAsyncSignIn: [
    'B02_IDCheckSignInV2_00_POST_sts-mock /token',
    'B02_IDCheckSignInV2_01_GET_/async/activeSession' //pragma: allowlist secret
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

export function idCheckAsyncSignUp(): void {
  iterationsStarted.add(1)

  const accessToken = postToken(groupMap.idCheckAsyncSignUp[0])
  sleepBetween(0.5, 1)

  const sub = uuidv4()
  postCredential(groupMap.idCheckAsyncSignUp[1], { accessToken, sub })
  sleepBetween(0.5, 1)

  const sessionId = getActiveSession(groupMap.idCheckAsyncSignUp[2], groupMap.idCheckAsyncSignUp[3], 200, sub)
  sleepBetween(0.5, 1)

  const opaqueId = postBiometricToken(groupMap.idCheckAsyncSignUp[4], sessionId)
  sleepBetween(0.5, 1)

  postTxmaEvent(groupMap.idCheckAsyncSignUp[6], sessionId)
  sleepBetween(0.5, 1)

  postTxmaEvent(groupMap.idCheckAsyncSignUp[6], sessionId)
  sleepBetween(0.5, 1)

  if (Math.random() <= 0.8) {
    // Approximately 80% of users complete journey successfully
    const biometricSessionId = uuidv4()
    postSetupBiometricSessionByScenario(groupMap.idCheckAsyncSignUp[7], { biometricSessionId, opaqueId })
    sleepBetween(0.5, 1)

    postFinishBiometricSession(groupMap.idCheckAsyncSignUp[8], { biometricSessionId, sessionId })
    sleepBetween(0.5, 1)

    getWellknownJwks(groupMap.idCheckAsyncSignUp[5])
    sleepBetween(0.5, 1)
  } else {
    // Approximately 20% of users abort journey
    postAbortSession(groupMap.idCheckAsyncSignUp[9], sessionId)
    sleepBetween(0.5, 1)
  }
  iterationsCompleted.add(1)
}

export function idCheckAsyncSignIn(): void {
  const sub = uuidv4()
  iterationsStarted.add(1)
  getActiveSession(groupMap.idCheckAsyncSignIn[0], groupMap.idCheckAsyncSignIn[1], 404, sub)
  iterationsCompleted.add(1)
}
