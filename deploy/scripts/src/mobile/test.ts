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
  checkValidDrivingLicenseRedirect,
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
  HasValidDrivingLicense,
  CanHandleFlashingColours,
  checkAuthorizeRedirect
} from './utils/functions-mobile-journey'

const profiles: ProfileList = {
  smoke: {
    dcmawDoAuthorizeRequest: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 5, duration: '30s' },
        { target: 5, duration: '30s' }
      ],
      exec: 'dcmawDoAuthorizeRequest'
    },
    dcmawMamIphonePassport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 75,
      maxVUs: 120,
      stages: [
        { target: 5, duration: '30s' },
        { target: 5, duration: '30s' }
      ],
      exec: 'dcmawMamIphonePassport'
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

export function dcmawDoAuthorizeRequest (): void {
  checkAuthorizeRedirect()
}

export function dcmawMamIphonePassport (): void {
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
  checkFlashingWarningRedirect(
    CanHandleFlashingColours.YES,
    DeviceType.SMARTPHONE
  )
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

export function dcmawDrivingLicenseAndroid (): void {
  checkAuthorizeRedirect()
  sleep(1)
  checkSelectDeviceRedirect(DeviceType.COMPUTER_OR_TABLET)
  sleep(1)
  checkSelectSmartphoneRedirect(SmartphoneType.ANDROID)
  sleep(1)
  checkValidPassportPageRedirect(HasValidPassport.NO)
  sleep(1)
  checkValidDrivingLicenseRedirect(HasValidDrivingLicense.YES)
  sleep(1)
  checkWorkingCameraRedirect(HasWorkingCamera.YES)
  sleep(1)
  checkFlashingWarningRedirect(
    CanHandleFlashingColours.YES,
    DeviceType.COMPUTER_OR_TABLET
  )
  sleep(1)
  getBiometricToken()
  postFinishBiometricToken()
  sleep(3)
  checkRedirectPage()
}
