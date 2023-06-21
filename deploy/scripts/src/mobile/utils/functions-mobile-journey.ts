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
  Iphone = 'iphone',
  Android = 'android',
}

export enum DeviceType {
  Smartphone = 'smartphone',
  ComputerOrTablet = 'computerOrTablet',
}

export enum YesOrNo {
  YES = 'yes',
  NO = 'no',
}

export enum IphoneType {
  Iphone7OrNewer = 'iphone7OrNewer',
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

export function doAuthorizeRequest (): void {
  let verifyUrl: string
  group('Test Client Execute Request', () => {
    const res = postToVerifyURL()
    isStatusCode201(res)
    verifyUrl = parseVerifyUrl(res)
  })

  group('Authorize Request', () => {
    const verifyRes = http.get(verifyUrl)
    isStatusCode200(verifyRes)
  })
}

export function startDcmawJourney (): void {
  group('Start DCMAW Journey', () => {
    const res = http.get(getFrontendUrl('/selectDevice'), {
      tags: { name: 'Start DCMAW Journey' }
    })
    isStatusCode200(res)
    isPageRedirectCorrect(res, '/selectDevice')
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

export function checkValidPassportPageRedirect (validPassport: YesOrNo): void {
  group(
    `Select valid passport: ${validPassport} from /selectPassport page`,
    () => {
      const res = http.post(
        getFrontendUrl('/validPassport'),
        { 'select-option': validPassport },
        { tags: { name: 'Select Valid Passport Page' } }
      )
      isStatusCode200(res)

      switch (validPassport) {
        case YesOrNo.YES:
          isPageRedirectCorrect(res, '/biometricChip')
          break
        case YesOrNo.NO:
          isPageRedirectCorrect(res, '/validDrivingLicence')
      }
    }
  )
}

export function checkValidDrivingLicenseRedirect (
  validDrivingLicense: YesOrNo
): void {
  group(
    `Select valid driving license: ${validDrivingLicense} from /validDrivingLicence page`,
    () => {
      const res = http.post(
        getFrontendUrl('/validDrivingLicence'),
        { 'driving-licence-choice': validDrivingLicense },
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
  validChip: YesOrNo,
  smartphone: SmartphoneType
): void {
  group(
    `Select valid biometric chip: ${validChip} from /biometricChip page`,
    () => {
      const res = http.post(
        getFrontendUrl('/biometricChip'),
        { 'select-option': validChip },
        { tags: { name: 'Select Valid Chip Page' } }
      )
      isStatusCode200(res)

      switch (validChip) {
        case YesOrNo.YES:
          if (smartphone === SmartphoneType.Iphone) {
            isPageRedirectCorrect(res, '/iphoneModel')
          } else if (smartphone === SmartphoneType.Android) {
            isPageRedirectCorrect(res, '/idCheckApp')
          }
          break
        case YesOrNo.NO:
          isPageRedirectCorrect(res, '/validDrivingLicence')
          break
      }
    }
  )
}

export function checkIphoneModelRedirect (iphoneModel: IphoneType): void {
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

export function checkWorkingCameraRedirect (workingCameraAnswer: YesOrNo): void {
  group(
    `Select working camera: ${workingCameraAnswer} from /workingCamera page`,
    () => {
      const res = http.post(
        getFrontendUrl('/workingCamera'),
        { 'working-camera-choice': workingCameraAnswer },
        { tags: { name: 'Select Working Camera' } }
      )
      isStatusCode200(res)
      isPageRedirectCorrect(res, '/flashingWarning')
    }
  )
}

export function checkFlashingWarningRedirect (
  warningAnswer: YesOrNo,
  device: DeviceType
): void {
  group(
    `Select flashing warning: ${warningAnswer} from /flashingWarning page`,
    () => {
      const res = http.post(
        getFrontendUrl('/flashingWarning'),
        { 'flashing-colours-choice': warningAnswer },
        { tags: { name: 'Select Flashing Warning Page' } }
      )
      isStatusCode200(res)

      switch (device) {
        case DeviceType.Smartphone:
          isPageRedirectCorrect(res, '/downloadApp')
          break
        case DeviceType.ComputerOrTablet:
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
