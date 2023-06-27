import { type Options } from 'k6/options'
import { describeProfile, type ProfileList, selectProfile } from '../common/utils/config/load-profiles'
import {
  postVerifyAuthorizeRequest,
  postResourceOwnerDocumentGroups,
  getBiometricTokenV2,
  postFinishBiometricSession,
  getRedirect,
  postToken,
  postUserInfo
} from './utils/backend'
import { sleep } from 'k6'

const profiles: ProfileList = {
  smoke: {
    backendJourney: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 50,
      stages: [
        { target: 5, duration: '30s' },
        { target: 5, duration: '30s' }
      ],
      exec: 'backendJourney'
    }
  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
  // httpDebug: 'full',
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'], // 95th percentile response time <=1000ms, 99th percentile response time <=2500ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
}

export function setup (): void {
  describeProfile(loadProfile)
}

export function backendJourney (): void {
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
  postUserInfo(accessToken)
}
