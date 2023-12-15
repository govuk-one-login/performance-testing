import { type Options } from 'k6/options'
import { describeProfile, type ProfileList, selectProfile } from '../common/utils/config/load-profiles'
import {
  postVerifyAuthorizeRequest,
  postResourceOwnerDocumentGroups,
  getBiometricTokenV2,
  postFinishBiometricSession,
  getRedirect,
  postToken,
  postUserInfoV2
} from './testSteps/backend'
import { sleep } from 'k6'

const profiles: ProfileList = {
  smoke: {
    backendJourney: {
      executor: 'ramping-arrival-rate',
      startRate: 1, // start with one iteration
      timeUnit: '1s',
      preAllocatedVUs: 50, // Calculation: 5 journeys / second * 10 seconds average journey time
      maxVUs: 70, // Calculation: 5 journeys / second * 14 seconds maximum journey time
      stages: [
        { target: 5, duration: '30s' }, // linear increase from 1 iteration per second to 5 iterations per second for 30 seconds
        { target: 5, duration: '30s' } // maintain 5 iterations per second for 30 seconds
      ],
      exec: 'backendJourney'
    }
  },
  load: {
    backendJourney: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1700, // Calculation: 100 journeys / second * 17 seconds average journey time
      maxVUs: 3000, // Calculation: 100 journeys / second * 2.5 seconds maximum expected from NFR (2.5 per request, 10 user-facing requests + safety)
      stages: [
        { target: 100, duration: '15m' }, // linear increase from 0 iteration per second to 100 iterations per second for 15 min -> 0.11 t/s/s
        { target: 100, duration: '30m' } // maintain 100 iterations per second for 30 min
      ],
      exec: 'backendJourney'
    }
  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
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
  postUserInfoV2(accessToken)
}
