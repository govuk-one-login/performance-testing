import { sleep } from 'k6'
import { type Options } from 'k6/options'
import { describeProfile, type ProfileList, selectProfile, createScenario, LoadProfile } from '../common/utils/config/load-profiles'
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
import { sleepBetween } from '../common/utils/sleep/sleepBetween'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('mamIphonePassport', LoadProfile.smoke)
  },
  load: {
    ...createScenario('mamIphonePassport', LoadProfile.full, 40, 37)
  },
  loadSelfAssessment: {
    mamIphonePassport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 450,
      stages: [
        { target: 10, duration: '15m' },
        { target: 10, duration: '10m' }
      ],
      exec: 'mamIphonePassport'
    }
  },
  deploy: {
    mamIphonePassport: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '25m',
      preAllocatedVUs: 15, // Calculation: 1 journeys / second * 15 seconds average journey time
      maxVUs: 75, // Calculation: 1 journeys / second * 24 seconds maximum journey time + 50 buffer
      exec: 'mamIphonePassport'
    }
  },
  incrementalLoad: {
    mamIphonePassport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1700, // Calculation: 100 journeys / second * 17 seconds average journey time
      maxVUs: 3000, // Calculation: 100 journeys / second * 2.5 seconds maximum expected from NFR (2.5 per request, 10 user-facing requests + safety)
      stages: [
        { target: 25, duration: '4m' }, // linear increase from 0 iteration per second to 25 iterations per second for 4 mins -> 0.1 t/s/s
        { target: 25, duration: '10m' }, // maintain 25 iterations per second for 10 min
        { target: 50, duration: '4m' }, // linear increase from 25 iteration per second to 50 iterations per second for 4 mins -> 0.1 t/s/s
        { target: 50, duration: '10m' }, // maintain 50 iterations per second for 10 min
        { target: 75, duration: '4m' }, // linear increase from 50 iteration per second to 75 iterations per second for 4 mins -> 0.1 t/s/s
        { target: 75, duration: '10m' }, // maintain 75 iterations per second for 10 min
        { target: 100, duration: '4m' }, // linear increase from 75 iteration per second to 100 iterations per second for 4 mins -> 0.1 t/s/s
        { target: 100, duration: '10m' } // maintain 100 iterations per second for 10 min
      ],
      exec: 'mamIphonePassport'
    }
  },
  incrementalSmallVolumes: {
    mamIphonePassport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 700, // Calculation: 40 journeys / second * 17 seconds average journey time
      maxVUs: 1500, // Calculation: 40 journeys / second * 2.5 seconds maximum expected from NFR (2.5 per request, 10 user-facing requests + safety)
      stages: [
        { target: 5, duration: '4m' }, // linear increase from 0 iteration per second to 5 iterations per second for 4 mins
        { target: 5, duration: '10m' }, // maintain 5 iterations per second for 10 min
        { target: 15, duration: '4m' }, // linear increase from 15 iteration per second to 50 iterations per second for 4 mins
        { target: 15, duration: '10m' }, // maintain 15 iterations per second for 10 min
        { target: 30, duration: '4m' }, // linear increase from 15 iteration per second to 30 iterations per second for 4 mins
        { target: 30, duration: '10m' }, // maintain 30 iterations per second for 10 min
        { target: 40, duration: '4m' }, // linear increase from 30 iteration per second to 40 iterations per second for 4 mins
        { target: 40, duration: '10m' } // maintain 40 iterations per second for 10 min
      ],
      exec: 'mamIphonePassport'
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
  sleepBetween(1, 2) // Simulate random time between 1s and 2s for user to stay on page
}
