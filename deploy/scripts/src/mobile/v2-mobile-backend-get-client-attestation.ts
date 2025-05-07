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
  },
  perf006Iteration3PeakTest: {
    getClientAttestation: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 528,
      stages: [
        { target: 150, duration: '151s' },
        { target: 150, duration: '30m' }
      ],
      exec: 'getClientAttestation'
    }
  }
}

const loadProfile = selectProfile(profiles)
export const groupMap = {
  getClientAttestation: [
    '01_GET_/appInfo',
    '02_GET_/app-check-token',
    '03_POST_/client-attestation',
    '04_GET_/.well-known/jwks.json'
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
