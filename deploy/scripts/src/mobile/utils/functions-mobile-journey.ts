import { check, group } from 'k6'
import http, { type Response } from 'k6/http'
import { URL } from './url'

const env = {
  testClientExecuteUrl: __ENV.MOBILE_TEST_CLIENT_EXECUTE_URL,
  backEndUrl: __ENV.MOBILE_BACK_END_URL,
  frontEndUrl: __ENV.MOBILE_FRONT_END_URL,
  biometricSessionId: __ENV.MOBILE_BIOMETRIC_SESSION_ID
}

export enum SmartphoneType {
  IPHONE = 'iphone',
  ANDROID = 'android',
}

export enum DeviceType {
  SMARTPHONE = 'smartphone',
  COMPUTER_OR_TABLET = 'computerOrTablet',
}

export enum HasValidPassport {
  YES = 'yes',
  NO = 'no',
}

export enum HasBiometricChip {
  YES = 'yes',
  NO = 'no',
}

export enum HasValidDrivingLicense {
  YES = 'yes',
  NO = 'no',
}

export enum HasWorkingCamera {
  YES = 'yes',
  NO = 'no',
}

export enum CanHandleFlashingColours {
  YES = 'yes',
  NO = 'no',
}

export enum IphoneModel {
  IPHONE_7_OR_NEWER = 'iphone7OrNewer',
}

const OAUTH_ROUTE = '/dca/oauth2'

function isStatusCode200 (res: Response): boolean {
  return check(res, {
    'is status 200': (r) => r.status === 200
  })
}

function isStatusCode201 (res: Response): boolean {
  return check(res, {
    'is status 201': (r) => r.status === 201
  })
}

function isStatusCode302 (res: Response): boolean {
  return check(res, {
    'is status 302': (r) => r.status === 302
  })
}

function isPageContentCorrect (res: Response, pageContent: string): boolean {
  return check(res, {
    'verify page content': (r) => (r.body as string).includes(pageContent)
  })
}

function isPageRedirectCorrect (res: Response, pageUrl: string): boolean {
  return check(res, {
    'verify url redirect': (r) => r.url.includes(pageUrl)
  })
}

function isHeaderLocationCorrect (res: Response, content: string): boolean {
  return check(res, {
    'verify url redirect': (r) => {
      return r.headers.Location.includes(content)
    }
  })
}

function postToVerifyURL (): Response {
  return http.post(
    getUrl('start', env.testClientExecuteUrl),
    JSON.stringify({ target: env.backEndUrl, frontendUri: env.frontEndUrl }),
    {
      tags: { name: 'Post request to Verify URL' },
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

function parseVerifyUrl (response: Response): string {
  const responseBody = response.body?.toString()
  const verifyUrl =
    typeof responseBody === 'string'
      ? JSON.parse(responseBody).WebLocation
      : null

  if (verifyUrl === null) {
    throw new Error('Failed to parse verify URL from response')
  }

  return verifyUrl
}

export function getSessionIdFromCookieJar (): string {
  const jar = http.cookieJar()
  const sessionId = jar.cookiesForURL(getFrontendUrl('')).sessionId.toString()
  return sessionId
}

function getUrl (
  path: string,
  base: string,
  query?: Record<string, string>
): string {
  const url = new URL(path, base)

  if (query != null) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return url.toString()
}

function getFrontendUrl (path: string, query?: Record<string, string>): string {
  return getUrl(OAUTH_ROUTE + path, env.frontEndUrl, query)
}

function getBackendUrl (path: string, query?: Record<string, string>): string {
  return getUrl(path, env.backEndUrl, query)
}

export function checkAuthorizeRedirect (): void {
  let verifyUrl: string
  group('Test Client Execute Request', () => {
    const res = postToVerifyURL()
    isStatusCode201(res)
    verifyUrl = parseVerifyUrl(res)
  })

  group('Authorize Request', () => {
    const verifyRes = http.get(verifyUrl)
    isStatusCode200(verifyRes)
    isPageRedirectCorrect(verifyRes, '/selectDevice')
  })
}

export function checkSelectDeviceRedirect (device: DeviceType): void {
  group(`Select device: ${device} from /selectdevice page`, () => {
    const res = http.post(
      getFrontendUrl('/selectDevice'),
      { 'select-device-choice': device },
      { tags: { name: 'Select Device Page' } }
    )
    isStatusCode200(res)
    isPageRedirectCorrect(res, '/selectSmartphone')
  })
}

export function checkSelectSmartphoneRedirect (
  smartphone: SmartphoneType
): void {
  group(`Select smartphone: ${smartphone} from /selectSmartphone page`, () => {
    const res = http.post(
      getFrontendUrl('/selectSmartphone'),
      { 'smartphone-choice': smartphone },
      { tags: { name: 'Select Smartphone Page' } }
    )
    isStatusCode200(res)
    isPageRedirectCorrect(res, '/validPassport')
  })
}

export function checkValidPassportPageRedirect (hasValidPassport: HasValidPassport): void {
  group(
    `Select valid passport: ${hasValidPassport} from /selectPassport page`,
    () => {
      const res = http.post(
        getFrontendUrl('/validPassport'),
        { 'select-option': hasValidPassport },
        { tags: { name: 'Select Valid Passport Page' } }
      )
      isStatusCode200(res)

      switch (hasValidPassport) {
        case HasValidPassport.YES:
          isPageRedirectCorrect(res, '/biometricChip')
          break
        case HasValidPassport.NO:
          isPageRedirectCorrect(res, '/validDrivingLicence')
      }
    }
  )
}

export function checkValidDrivingLicenseRedirect (
  hasValidDrivingLicense: HasValidDrivingLicense
): void {
  group(
    `Select valid driving license: ${hasValidDrivingLicense} from /validDrivingLicence page`,
    () => {
      const res = http.post(
        getFrontendUrl('/validDrivingLicence'),
        { 'driving-licence-choice': hasValidDrivingLicense },
        { tags: { name: 'Select Valid Driving License Page' } }
      )
      isStatusCode200(res)
      isPageContentCorrect(
        res,
        'Use your UK driving licence and a GOV.UK app to confirm your identity'
      )
    }
  )
}

export function checkBiometricChipRedirect (
  hasBiometricChip: HasBiometricChip,
  smartphone: SmartphoneType
): void {
  group(
    `Select valid biometric chip: ${hasBiometricChip} from /biometricChip page`,
    () => {
      const res = http.post(
        getFrontendUrl('/biometricChip'),
        { 'select-option': hasBiometricChip },
        { tags: { name: 'Select Valid Chip Page' } }
      )
      isStatusCode200(res)

      switch (hasBiometricChip) {
        case HasBiometricChip.YES:
          if (smartphone === SmartphoneType.IPHONE) {
            isPageRedirectCorrect(res, '/iphoneModel')
          } else if (smartphone === SmartphoneType.ANDROID) {
            isPageRedirectCorrect(res, '/idCheckApp')
          }
          break
        case HasBiometricChip.NO:
          isPageRedirectCorrect(res, '/validDrivingLicence')
          break
      }
    }
  )
}

export function checkIphoneModelRedirect (iphoneModel: IphoneModel): void {
  group(`Select iphone model: ${iphoneModel} from /iphoneModel page`, () => {
    const res = http.post(
      getFrontendUrl('/iphoneModel'),
      { 'select-option': iphoneModel },
      { tags: { name: 'Select Iphone Model Page' } }
    )
    isStatusCode200(res)
    isPageRedirectCorrect(res, '/idCheckApp')
  })
}

export function checkIdCheckAppRedirect (): void {
  group('Select continue from /idCheckApp page', () => {
    const res = http.post(
      getFrontendUrl('/idCheckApp'),
      {},
      { tags: { name: 'ID Check App Page' } }
    )
    isStatusCode200(res)
    isPageRedirectCorrect(res, '/workingCamera')
  })
}

export function checkWorkingCameraRedirect (hasWorkingCamera: HasWorkingCamera): void {
  group(
    `Select working camera: ${hasWorkingCamera} from /workingCamera page`,
    () => {
      const res = http.post(
        getFrontendUrl('/workingCamera'),
        { 'working-camera-choice': hasWorkingCamera },
        { tags: { name: 'Select Working Camera' } }
      )
      isStatusCode200(res)
      isPageRedirectCorrect(res, '/flashingWarning')
    }
  )
}

export function checkFlashingWarningRedirect (
  canHandleFlashingColours: CanHandleFlashingColours,
  device: DeviceType
): void {
  group(
    `Select flashing warning: ${canHandleFlashingColours} from /flashingWarning page`,
    () => {
      const res = http.post(
        getFrontendUrl('/flashingWarning'),
        { 'flashing-colours-choice': canHandleFlashingColours },
        { tags: { name: 'Select Flashing Warning Page' } }
      )
      isStatusCode200(res)

      switch (device) {
        case DeviceType.SMARTPHONE:
          isPageRedirectCorrect(res, '/downloadApp')
          break
        case DeviceType.COMPUTER_OR_TABLET:
          isPageRedirectCorrect(res, '/downloadApp')
          break
      }
    }
  )
}

export function getBiometricToken (): void {
  group('Get Biometric Token BE Request', () => {
    const biometricTokenUrl = getBackendUrl('/biometricToken', {
      authSessionId: getSessionIdFromCookieJar()
    })
    const res = http.get(biometricTokenUrl, {
      tags: { name: 'Get Biometric Token' }
    })
    isStatusCode200(res)
  })
}

export function postFinishBiometricToken (): void {
  group('Post Finish Biometric Token BE Request', () => {
    const finishBiometricSessionUrl = getBackendUrl('/finishBiometricSession', {
      authSessionId: getSessionIdFromCookieJar(),
      biometricSessionId: env.biometricSessionId
    })
    const res = http.post(finishBiometricSessionUrl)
    isStatusCode200(res)
  })
}

export function checkRedirectPage (): void {
  group('Check Redirect Final Page /redirect', () => {
    const redirectUrl = getFrontendUrl('/redirect', { sessionId: getSessionIdFromCookieJar() })
    const res = http.get(redirectUrl, {
      redirects: 0,
      tags: { name: 'Redirect Final Page' }
    })
    isStatusCode302(res)
    isHeaderLocationCorrect(res, '/redirect')
  })
}

export function checkAbortCommand (): void {
  group('Check Abort and Redirect', () => {
    const abortCommandUrl = getFrontendUrl('/abortCommand', { sessionId: getSessionIdFromCookieJar() })
    const res = http.get(abortCommandUrl, {
      redirects: 0,
      tags: { name: 'Abort Command' }
    })
    isStatusCode302(res)
    isHeaderLocationCorrect(res, '/redirect')
  })
}
