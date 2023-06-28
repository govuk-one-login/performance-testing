import { sleep } from 'k6'
import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile
} from '../common/utils/config/load-profiles'
import {
  postSelectDevice,
  postSelectSmartphone,
  postValidPassport,
  postBiometricChip,
  postFlashingWarning,
  postIphoneModel,
  getRedirect,
  postWorkingCamera,
  postIdCheckApp,
  getAbortCommand,
  startJourney,
  getSessionIdFromCookieJar
} from './testSteps/frontend'
import {
  getBiometricTokenV2,
  postFinishBiometricSession
} from './testSteps/backend'

const profiles: ProfileList = {
  smoke: {
    mamIphonePassport: {
      executor: 'ramping-arrival-rate',
      startRate: 1, // start with one iteration
      timeUnit: '1s',
      preAllocatedVUs: 75, // Calculation: 5 journeys / second * 15 seconds average journey time
      maxVUs: 120, // Calculation: 5 journeys / second * 24 seconds maximum journey time
      stages: [
        { target: 5, duration: '10s' }, // linear increase from 1 iteration per second to 5 iterations per second for 30 seconds
        // { target: 5, duration: '30s' } // maintain 5 iterations per second for 30 seconds
      ],
      exec: 'mamIphonePassport'
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

export function mamIphonePassport (): void {
  startJourney()
  simulateUserWait()
  postSelectDevice()
  simulateUserWait()
  postSelectSmartphone()
  simulateUserWait()
  postValidPassport()
  simulateUserWait()
  postBiometricChip()
  simulateUserWait()
  postIphoneModel()
  simulateUserWait()
  postIdCheckApp()
  simulateUserWait()
  postWorkingCamera()
  simulateUserWait()
  postFlashingWarning()
  simulateUserWait()
  if (Math.random() <= 0.8) { // Approximately 80% of users complete journey successfully
    const sessionId = getSessionIdFromCookieJar()
    getBiometricTokenV2(sessionId)
    sleep(1)
    postFinishBiometricSession(sessionId)
    sleep(1)
    getRedirect()
  } else { // Approximately 20% of users abort journey
    getAbortCommand()
  }
}

function simulateUserWait (): void {
  sleep(1 + Math.random()) // Simulate random time between 1s and 2s for user to stay on page
}
