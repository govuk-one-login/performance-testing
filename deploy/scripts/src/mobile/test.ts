import { sleep } from 'k6'
import http from 'k6/http'
import { type Options } from 'k6/options'
import { describeProfile, type ProfileList, selectProfile } from '../common/utils/config/load-profiles'
import {
  checkBiometricChipRedirect,
  checkFlashingWarningRedirect,
  checkIphoneModelRedirect,
  checkRedirectPage,
  checkSelectDeviceRedirect,
  checkSelectSmartphoneRedirect,
  checkValidBrpRedirect,
  checkValidDrivingLicenseRedirect,
  checkValidPassportPageRedirect,
  checkWorkingCameraRedirect,
  DeviceType,
  getBiometricToken,
  getSessionId,
  IphoneType,
  postFinishBiometricToken,
  setSessionCookie,
  SmartphoneType,
  startDcmawJourney,
  updateCookiesFromIdCheckAppPage,
  YesOrNo
} from './utils/functions-mobile-journey'

const profiles: ProfileList = {
  smoke: {
    dcmawPassportIphone: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 5, duration: '30s' },
        { target: 5, duration: '30s' }
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
        { target: 5, duration: '30s' }, // Ramps up to target load
        { target: 5, duration: '30s' } // Ramps up to target load
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
  const jar = http.cookieJar()
  const sessionId = getSessionId()
  setSessionCookie(jar, sessionId)
  startDcmawJourney()
  sleep(1)
  checkSelectDeviceRedirect(DeviceType.Smartphone)
  sleep(1)
  checkSelectSmartphoneRedirect(SmartphoneType.Iphone)
  sleep(1)
  checkValidPassportPageRedirect(YesOrNo.YES)
  sleep(1)
  checkBiometricChipRedirect(YesOrNo.YES, SmartphoneType.Iphone)
  sleep(1)
  checkIphoneModelRedirect(IphoneType.Iphone7OrNewer)
  sleep(1)
  checkWorkingCameraRedirect(YesOrNo.YES)
  updateCookiesFromIdCheckAppPage()
  sleep(1)
  checkFlashingWarningRedirect(YesOrNo.YES, DeviceType.Smartphone)
  sleep(1)
  getBiometricToken(sessionId)
  postFinishBiometricToken(sessionId)
  sleep(3)
  checkRedirectPage(sessionId)
}

export function dcmawDrivingLicenseAndroid (): void {
  const jar = http.cookieJar()
  const sessionId = getSessionId()
  setSessionCookie(jar, sessionId)
  startDcmawJourney()
  sleep(1)
  checkSelectDeviceRedirect(DeviceType.ComputerOrTablet)
  sleep(1)
  checkSelectSmartphoneRedirect(SmartphoneType.Android)
  sleep(1)
  checkValidPassportPageRedirect(YesOrNo.NO)
  sleep(1)
  checkValidBrpRedirect(YesOrNo.NO)
  sleep(1)
  checkValidDrivingLicenseRedirect(YesOrNo.YES)
  sleep(1)
  checkWorkingCameraRedirect(YesOrNo.YES)
  updateCookiesFromIdCheckAppPage()
  sleep(1)
  checkFlashingWarningRedirect(YesOrNo.YES, DeviceType.ComputerOrTablet)
  sleep(1)
  getBiometricToken(sessionId)
  postFinishBiometricToken(sessionId)
  sleep(3)
  checkRedirectPage(sessionId)
}
