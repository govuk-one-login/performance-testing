import {
  createScenario,
  describeProfile,
  LoadProfile,
  ProfileList,
  selectProfile
} from '../common/utils/config/load-profiles'
import { Options } from 'k6/options'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
import { generateKey } from './utils/crypto'
import { getAppInfo, postClientAttestation, simulateCallToMobileBackendJwks } from './mobile-backend/testSteps/backend'
import { getAppCheckToken } from './mobile-backend/utils/appCheckToken'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('getClientAttestation', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)
export const groupMap = {
  getClientAttestation: [
    '01 GET /appInfo',
    '02 GET /app-check-token',
    '03 POST /client-attestation',
    '04 GET /.well-known/jwks.json'
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

export async function getClientAttestation(): Promise<void> {
  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  iterationsStarted.add(1)
  getAppInfo()
  sleepBetween(1, 2)
  const appCheckToken = getAppCheckToken()
  postClientAttestation(publicKeyJwk, appCheckToken)
  simulateCallToMobileBackendJwks()
  iterationsCompleted.add(1)
}
