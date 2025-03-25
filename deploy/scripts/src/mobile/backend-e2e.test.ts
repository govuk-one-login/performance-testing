import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import {
  postVerifyAuthorizeRequest,
  postResourceOwnerDocumentGroups,
  getBiometricTokenV2,
  postFinishBiometricSession,
  getRedirect,
  postToken
  //postUserInfoV2
} from './testSteps/backend'
import { sleep } from 'k6'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('backendJourney', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('backendJourney', LoadProfile.full, 10)
  },
  load: {
    ...createScenario('backendJourney', LoadProfile.full, 40)
  },
  deploy: {
    ...createScenario('backendJourney', LoadProfile.deployment, 1)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  backendJourney: [
    'POST test client /start',
    'POST /verifyAuthorizeRequest',
    'POST /resourceOwner/documentGroups',
    'GET /biometricToken/v2',
    'POST /finishBiometricSession',
    'GET /redirect',
    'POST /token',
    'POST /userinfo/v2'
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

export function backendJourney(): void {
  iterationsStarted.add(1)
  const sessionId = postVerifyAuthorizeRequest()
  sleep(1)
  postResourceOwnerDocumentGroups(sessionId)
  sleep(1)
  getBiometricTokenV2(sessionId)
  sleep(1)
  postFinishBiometricSession(sessionId)
  sleep(1)
  const { authorizationCode, redirectUri } = getRedirect(sessionId)
  sleep(1)
  const accessToken = postToken(authorizationCode, redirectUri)
  sleep(1)
  //postUserInfoV2(accessToken)
  iterationsCompleted.add(1)
}
