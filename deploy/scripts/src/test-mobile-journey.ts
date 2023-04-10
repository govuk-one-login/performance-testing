import { sleep } from 'k6'
import { type Options } from 'k6/options'
import { describeProfile, ProfileList, selectProfile } from './utils/config/load-profiles'
import {
  checkBiometricChipRedirect,
  checkFlashingWarningRedirect,
  checkIphoneModelRedirect,
  checkRedirectPage,
  checkSelectDeviceRedirect,
  checkSelectSmartphoneRedirect,
  checkValidDrivingLicenseRedirect,
  checkValidPassportPageRedirect,
  checkWorkingCameraRedirect,
  getBiometricToken,
  getRedirectAndSessionId,
  postFinishBiometricToken,
  startDcmawJourney,
  DeviceType,
  SmartphoneType,
  YesOrNo,
  IphoneType
} from './utils/functions/functions-mobile-journey'

const profiles: ProfileList = {
  smoke: {
    dcmawPassportIphone: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '5s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60' } // Ramps up to target load
      ],
      exec: 'dcmawPassportIphone'
    },
    dcmawDrivingLicenseAndroid: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '5s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60' } // Ramps up to target load
      ],
      exec: 'dcmawDrivingLicenseAndroid'
    }
  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
  httpDebug: 'full',
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'], // 95th percentile response time <=1000ms, 99th percentile response time <=2500ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
}

export function setup (): void {
  describeProfile(loadProfile)
}

export function dcmawPassportIphone (): void {
  getRedirectAndSessionId()
  startDcmawJourney()
  sleep(1)
  checkSelectDeviceRedirect(DeviceType.Other)
  sleep(1)
  checkSelectSmartphoneRedirect(SmartphoneType.Iphone)
  sleep(1)
  checkValidPassportPageRedirect(YesOrNo.YES)
  sleep(1)
  checkBiometricChipRedirect(YesOrNo.YES, SmartphoneType.Iphone)
  sleep(1)
  checkIphoneModelRedirect(IphoneType.Iphone7IrNewer)
  sleep(1)
  checkWorkingCameraRedirect(YesOrNo.YES)
  sleep(1)
  checkFlashingWarningRedirect(YesOrNo.YES, DeviceType.Other)
  getBiometricToken()
  postFinishBiometricToken()
  sleep(3)
  checkRedirectPage()
}

export function dcmawDrivingLicenseAndroid (): void {
  getRedirectAndSessionId()
  startDcmawJourney()
  sleep(1)
  checkSelectDeviceRedirect(DeviceType.ComputerOrTablet)
  sleep(1)
  checkSelectSmartphoneRedirect(SmartphoneType.Android)
  sleep(1)
  checkValidPassportPageRedirect(YesOrNo.NO)
  sleep(1)
  checkValidDrivingLicenseRedirect(YesOrNo.YES)
  sleep(1)
  checkWorkingCameraRedirect(YesOrNo.YES)
  sleep(1)
  checkFlashingWarningRedirect(YesOrNo.YES, DeviceType.ComputerOrTablet)
  getBiometricToken()
  postFinishBiometricToken()
  sleep(3)
  checkRedirectPage()
}

