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
import { generateKey } from './sts/utils/crypto'
import { getAppInfo, postClientAttestation, simulateCallToMobileBackendJwks } from './mobile-backend/testSteps/backend'
import { getAppCheckToken } from './mobile-backend/utils/appCheckToken'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('getClientAttestation', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)
export const groupMap = {
  getClientAttestation: [
    'GET /appInfo',
    'GET /app-check-token',
    'POST /client-attestation',
    'GET /.well-known/jwks.json'
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
  const appCheckToken = getAppCheckToken()
  console.log(postClientAttestation(publicKeyJwk, appCheckToken))
  simulateCallToMobileBackendJwks()
  iterationsCompleted.add(1)
}
