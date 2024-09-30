import { sleep } from 'k6'
import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import {
  postSelectDevice,
  postSelectSmartphone,
  postValidPassport,
  postBiometricChip,
  postIphoneModel,
  getRedirect,
  postIdCheckApp,
  getAbortCommand,
  startJourney,
  getSessionIdFromCookieJar
} from './testSteps/frontend'
import { getBiometricTokenV2, postFinishBiometricSession } from './testSteps/backend'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('mamIphonePassport', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('mamIphonePassport', LoadProfile.full, 10, 40)
  },
  load: {
    ...createScenario('mamIphonePassport', LoadProfile.full, 40, 40)
  },
  deploy: {
    ...createScenario('mamIphonePassport', LoadProfile.deployment, 1, 40)
  },
  incrementalSmallVolumes: {
    ...createScenario('mamIphonePassport', LoadProfile.incremental, 40)
  },
  incrementalLoad: {
    ...createScenario('mamIphonePassport', LoadProfile.incremental, 100)
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

export function setup(): void {
  describeProfile(loadProfile)
}

export function mamIphonePassport(): void {
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
  if (Math.random() <= 0.8) {
    // Approximately 80% of users complete journey successfully
    const sessionId = getSessionIdFromCookieJar()
    getBiometricTokenV2(sessionId)
    sleep(1)
    postFinishBiometricSession(sessionId)
    sleep(1)
    getRedirect()
  } else {
    // Approximately 20% of users abort journey
    getAbortCommand()
  }
}

function simulateUserWait(): void {
  sleepBetween(1, 2) // Simulate random time between 1s and 2s for user to stay on page
}
