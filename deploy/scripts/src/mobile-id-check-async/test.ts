import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile,
  createScenario,
  LoadProfile,
  createI4PeakTestSignUpScenario
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
    ...createScenario('idCheckAsync', LoadProfile.smoke)
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('idCheckAsync', 450, 27, 451)
  }
}

const loadProfile = selectProfile(profiles)
export const groupMap = {
  idCheckAsync: [
    'B01_IDCheckV2_00_POST_/async/token',
    'B01_IDCheckV2_01_POST_/async/credential', //pragma: allowlist secret
    'B01_IDCheckV2_02_POST_sts-mock /token',
    'B01_IDCheckV2_03_GET_/async/activeSession', //pragma: allowlist secret
    'B01_IDCheckV2_04_POST_/async/biometricToken', //pragma: allowlist secret
    'B01_IDCheckV2_05_GET_/async/.well-known/jwks.json',
    'B01_IDCheckV2_06_POST_/async/txmaEvent', //pragma: allowlist secret
    'B01_IDCheckV2_07_POST_readid-mock /postSetupBiometricSessionByScenario',
    'B01_IDCheckV2_08_POST_async/finishBiometricSession', //pragma: allowlist secret
    'B01_IDCheckV2_09_POST async/abortSession'
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

export function idCheckAsync(): void {
  iterationsStarted.add(1)

  const accessToken = postToken()
  sleepBetween(0.5, 1)

  const sub = uuidv4()
  postCredential({ accessToken, sub })
  sleepBetween(0.5, 1)

  const sessionId = getActiveSession(sub)
  sleepBetween(0.5, 1)

  getWellknownJwks()
  sleepBetween(0.5, 1)

  const opaqueId = postBiometricToken(sessionId)
  sleepBetween(0.5, 1)

  postTxmaEvent(sessionId)
  sleepBetween(0.5, 1)

  postTxmaEvent(sessionId)
  sleepBetween(0.5, 1)

  postTxmaEvent(sessionId)
  sleepBetween(0.5, 1)

  if (Math.random() <= 0.8) {
    // Approximately 80% of users complete journey successfully
    const biometricSessionId = uuidv4()
    postSetupBiometricSessionByScenario({ biometricSessionId, opaqueId })
    sleepBetween(0.5, 1)

    postFinishBiometricSession({ biometricSessionId, sessionId })
    sleepBetween(0.5, 1)

    getWellknownJwks()
    sleepBetween(0.5, 1)
  } else {
    // Approximately 20% of users abort journey
    postAbortSession(sessionId)
    sleepBetween(0.5, 1)
  }
  iterationsCompleted.add(1)
}
