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
    '03 GET /async/activeSession'
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

  console.log(sessionId)

  /* 
  To do:

  1) Simulate call to async/.well-known/jwks.json endpoint 
  2) POST /async/biomtericToken
  2) 20% weighted journey to POST /async/abortSession
  3) 80% weighted journey to:
    - POST /async/txmaEvent * 3
    - POST /async/finishBiometricSession
  */
  iterationsCompleted.add(1)
}

