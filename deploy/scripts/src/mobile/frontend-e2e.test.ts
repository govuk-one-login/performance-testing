import { sleep } from 'k6'
import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile
} from '../common/utils/config/load-profiles'
import {
  postSelectDeviceAndValidateRedirect,
  postSelectSmartphoneAndValidateRedirect,
  postValidPassportAndValidateRedirect,
  postBiometricChipAndValidateRedirect,
  postFlashingWarningAndValidateRedirect,
  postIphoneModelAndValidateRedirect,
  getRedirectAndValidateResponse,
  postWorkingCameraAndValidateRedirect,
  getBiometricTokenAndValidateResponse,
  postFinishBiometricTokenAndValidateResponse,
  postIdCheckAppAndValidateRedirect,
  getAbortCommandAndValidateResponse,
  checkAuthorizeRedirect
} from './utils/functions-mobile-journey'

const profiles: ProfileList = {
  smoke: {
    mamIphonePassport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 75,
      maxVUs: 120,
      stages: [
        { target: 5, duration: '30s' },
        { target: 5, duration: '30s' }
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
  checkAuthorizeRedirect()
  sleep(1)
  postSelectDeviceAndValidateRedirect()
  sleep(1)
  postSelectSmartphoneAndValidateRedirect()
  sleep(1)
  postValidPassportAndValidateRedirect()
  sleep(1)
  postBiometricChipAndValidateRedirect()
  sleep(1)
  postIphoneModelAndValidateRedirect()
  sleep(1)
  postIdCheckAppAndValidateRedirect()
  sleep(1)
  postWorkingCameraAndValidateRedirect()
  sleep(1)
  postFlashingWarningAndValidateRedirect()
  sleep(1)
  if (Math.random() <= 0.8) {
    getBiometricTokenAndValidateResponse()
    postFinishBiometricTokenAndValidateResponse()
    sleep(3)
    getRedirectAndValidateResponse()
  } else {
    getAbortCommandAndValidateResponse()
  }
}
