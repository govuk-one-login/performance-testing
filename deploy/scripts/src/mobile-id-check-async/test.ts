import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
import { createSession } from './testSteps/createSession'
import { getActiveSession } from './testSteps/getActiveSession'
import { postBiometricToken } from './testSteps/postBiometricToken'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getWellknownJwks } from './testSteps/getWellKnownJwks'
import { postTxmaEvent } from './testSteps/postTxmaEvent'
import { postSetupVendorResponse } from './testSteps/postSetupVendorResponse'
import { uuidv4 } from '../common/utils/jslib'
import { postFinishBiometricSession } from './testSteps/postFinishBiometricSession'
import { postAbortSession } from './testSteps/postAbortSession'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('idCheckAsync', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)
export const groupMap = {
  idCheckAsync: [
    '00 POST /async/token',
    '01 POST /async/credential',
    '02 POST sts-mock /token',
    '03 GET /async/activeSession',
    '04 POST /async/biometricToken',
    '05 GET /async/.well-known/jwks.json',
    '06 POST /async/txmaEvent',
    '07 POST readid-mock /setupVendorResponse',
    '08 POST async/finishBiometricSession',
    '09 POST async/abortSession',
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
  const sub = createSession()
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
  const biometricSessionId = uuidv4()
  postSetupVendorResponse({ biometricSessionId, opaqueId })
  sleepBetween(0.5, 1)
  // postFinishBiometricSession({ biometricSessionId, sessionId })
  postAbortSession(sessionId)

  /* 
  To do:

  1) Simulate call to GET async/.well-known/jwks.json endpoint 
  2) 10% weighted journey to POST /async/abortSession
  3) 90% weighted journey to:
    - POST /async/txmaEvent * 3
    - POST /async/finishBiometricSession
  */
  iterationsCompleted.add(1)
}

