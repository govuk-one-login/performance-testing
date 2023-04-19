import { sleep } from 'k6'
import { type Options } from 'k6/options'
import { describeProfile, type ProfileList, selectProfile } from './utils/config/load-profiles'
import {
  sessionIdCookie,
  startDcmawJourney,
  DeviceType,
  SmartphoneType,
  YesOrNo,
  IphoneType,
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
  postFinishBiometricToken
} from './utils/functions/functions-mobile-journey'

const profiles: ProfileList = {
  smoke: {
    dcmawPassportIphone: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'dcmawPassportIphone'
    },
    dcmawDrivingLicenseAndroid: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'dcmawDrivingLicenseAndroid'
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

export function dcmawPassportIphone (): void {
  const context = sessionIdCookie()
  startDcmawJourney(context)
  sleep(1)
  checkSelectDeviceRedirect(context, DeviceType.Other)
  sleep(1)
  checkSelectSmartphoneRedirect(context, SmartphoneType.Iphone)
  sleep(1)
  checkValidPassportPageRedirect(context, YesOrNo.YES)
  sleep(1)
  checkBiometricChipRedirect(context, YesOrNo.YES, SmartphoneType.Iphone)
  sleep(1)
  checkIphoneModelRedirect(context, IphoneType.Iphone7OrNewer)
  sleep(1)
  checkWorkingCameraRedirect(context, YesOrNo.YES)
  sleep(1)
  checkFlashingWarningRedirect(context, YesOrNo.YES, DeviceType.Other)
  getBiometricToken(context)
  postFinishBiometricToken(context)
  sleep(3)
  checkRedirectPage(context)
}

export function dcmawDrivingLicenseAndroid (): void {
  const context = sessionIdCookie()
  startDcmawJourney(context)
  sleep(1)
  checkSelectDeviceRedirect(context, DeviceType.ComputerOrTablet)
  sleep(1)
  checkSelectSmartphoneRedirect(context, SmartphoneType.Android)
  sleep(1)
  checkValidPassportPageRedirect(context, YesOrNo.NO)
  sleep(1)
  checkValidDrivingLicenseRedirect(context, YesOrNo.YES)
  sleep(1)
  checkWorkingCameraRedirect(context, YesOrNo.YES)
  sleep(1)
  checkFlashingWarningRedirect(context, YesOrNo.YES, DeviceType.ComputerOrTablet)
  getBiometricToken(context)
  postFinishBiometricToken(context)
  sleep(3)
  checkRedirectPage(context)
}
