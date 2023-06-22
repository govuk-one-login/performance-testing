import { sleep } from 'k6'
import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile
} from '../common/utils/config/load-profiles'
import {
  DeviceType,
  SmartphoneType,
  IphoneModel,
  checkSelectDeviceRedirect,
  checkSelectSmartphoneRedirect,
  checkValidPassportPageRedirect,
  checkBiometricChipRedirect,
  checkFlashingWarningRedirect,
  checkIphoneModelRedirect,
  checkRedirectPage,
  checkWorkingCameraRedirect,
  getBiometricToken,
  postFinishBiometricToken,
  checkIdCheckAppRedirect,
  checkAbortCommand,
  HasValidPassport,
  HasBiometricChip,
  HasWorkingCamera,
  CanHandleFlashingColours,
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
  checkSelectDeviceRedirect(DeviceType.SMARTPHONE)
  sleep(1)
  checkSelectSmartphoneRedirect(SmartphoneType.IPHONE)
  sleep(1)
  checkValidPassportPageRedirect(HasValidPassport.YES)
  sleep(1)
  checkBiometricChipRedirect(HasBiometricChip.YES, SmartphoneType.IPHONE)
  sleep(1)
  checkIphoneModelRedirect(IphoneModel.IPHONE_7_OR_NEWER)
  sleep(1)
  checkIdCheckAppRedirect()
  sleep(1)
  checkWorkingCameraRedirect(HasWorkingCamera.YES)
  sleep(1)
  checkFlashingWarningRedirect(CanHandleFlashingColours.YES, DeviceType.SMARTPHONE)
  sleep(1)
  if (Math.random() <= 0.8) {
    getBiometricToken()
    postFinishBiometricToken()
    sleep(3)
    checkRedirectPage()
  } else {
    checkAbortCommand()
  }
}
