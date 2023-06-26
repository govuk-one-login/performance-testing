import { sleep } from 'k6'
import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile
} from '../common/utils/config/load-profiles'
import {
  postSelectDeviceAndValidateResponse,
  postSelectSmartphoneAndValidateResponse,
  postValidPassportAndValidateResponse,
  postBiometricChipAndValidateResponse,
  postFlashingWarningAndValidateResponse,
  postIphoneModelAndValidateResponse,
  getRedirectAndValidateResponse,
  postWorkingCameraAndValidateResponse,
  getBiometricTokenAndValidateResponse,
  postFinishBiometricSessionAndValidateResponse,
  postIdCheckAppAndValidateResponse,
  getAbortCommandAndValidateResponse,
  startJourneyAndValidateResponse
} from './utils/functions-mobile-journey'

const profiles: ProfileList = {
  smoke: {
    mamIphonePassport: {
      executor: 'ramping-arrival-rate',
      startRate: 1, // start with one iteration
      timeUnit: '1s',
      preAllocatedVUs: 75, // Calculation: 5 journeys / second * 15 seconds average journey time
      maxVUs: 120, // Calculation: 5 journeys / second * 24 seconds maximum journey time
      stages: [
        { target: 5, duration: '30s' }, // linear increase from 1 iteration per second to 5 iterations per second for 30 seconds
        { target: 5, duration: '30s' } // maintain 5 iterations per second for 30 seconds
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
  startJourneyAndValidateResponse()
  sleep(1 + Math.random())
  postSelectDeviceAndValidateResponse()
  sleep(1 + Math.random())
  postSelectSmartphoneAndValidateResponse()
  sleep(1 + Math.random())
  postValidPassportAndValidateResponse()
  sleep(1 + Math.random())
  postBiometricChipAndValidateResponse()
  sleep(1 + Math.random())
  postIphoneModelAndValidateResponse()
  sleep(1 + Math.random())
  postIdCheckAppAndValidateResponse()
  sleep(1 + Math.random())
  postWorkingCameraAndValidateResponse()
  sleep(1 + Math.random())
  postFlashingWarningAndValidateResponse()
  sleep(1 + Math.random())
  if (Math.random() <= 0.8) {
    getBiometricTokenAndValidateResponse()
    sleep(1)
    postFinishBiometricSessionAndValidateResponse()
    sleep(1)
    getRedirectAndValidateResponse()
  } else {
    getAbortCommandAndValidateResponse()
  }
}
