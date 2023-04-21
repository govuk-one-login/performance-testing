import { check } from 'k6'
import http, { type CookieJar, type Response } from 'k6/http'
import { URL } from '../../misc/url'

const env = {
  testClientExecuteUrl: __ENV.TEST_CLIENT_EXECUTE_URL,
  backEndUrl: __ENV.BACK_END_URL,
  frontEndUrl: __ENV.FRONT_END_URL,
  biometricSessionId: __ENV.BIOMETRIC_SESSION_ID
}

export enum SmartphoneType {
  Iphone = 'iphone',
  Android = 'android',
}

export enum DeviceType {
  Other = 'other',
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
  return http.post(getUrl('start', env.testClientExecuteUrl),
    JSON.stringify({ target: env.backEndUrl, frontendUri: env.frontEndUrl }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}

function parseVerifyUrl (response: Response): string {
  const responseBody = response.body?.toString()
  const verifyUrl = typeof responseBody === 'string' ? JSON.parse(responseBody).WebLocation : null

  if (verifyUrl === null) {
    throw new Error('Failed to parse verify URL from response')
  }

  return verifyUrl
}

export function setSessionCookie (jar: CookieJar, sessionId: string): void {
  jar.set(getFrontendUrl('/'), 'sessionId', sessionId)
}

export function getSessionId (): string {
  const res = postToVerifyURL()
  isStatusCode201(res)

  const verifyUrl = parseVerifyUrl(res)
  const verifyRes = http.get(verifyUrl, { redirects: 0 })
  const sessionId = verifyRes.cookies.sessionId.find(s => s.value.length > 0)?.value

  if (sessionId == null) {
    throw new Error('Cannot find sessionId cookie')
  }
  return sessionId
}

function getUrl (path: string, base: string, query?: Record<string, string>): string {
  const url = new URL(path, base)

  if (query != null) {
    Object.entries(query).forEach(
      ([key, value]) => {
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

export function startDcmawJourney (): void {
  const res = http.get(getFrontendUrl('/selectDevice'))
  isStatusCode200(res)
  isPageContentCorrect(res, 'Are you on a computer or a tablet right now?')
  isPageRedirectCorrect(res, '/selectDevice')
}

export function checkSelectDeviceRedirect (device: DeviceType): void {
  const res = http.post(getFrontendUrl('/selectDevice'), { 'select-device-choice': device })
  isStatusCode200(res)
  isPageRedirectCorrect(res, '/selectSmartphone')

  switch (device) {
    case DeviceType.ComputerOrTablet:
      isPageContentCorrect(res, 'Do you have a smartphone you can use?')
      break
    case DeviceType.Other:
      isPageContentCorrect(res, 'Are you on a smartphone right now?')
      break
  }
}

export function checkSelectSmartphoneRedirect (smartphone: SmartphoneType): void {
  const res = http.post(getFrontendUrl('/selectSmartphone'), { 'smartphone-choice': smartphone })
  isStatusCode200(res)
  isPageContentCorrect(res, 'Do you have a valid passport?')
  isPageRedirectCorrect(res, '/validPassport')
}

export function checkValidPassportPageRedirect (validPassport: YesOrNo): void {
  const res = http.post(getFrontendUrl('/validPassport'), { 'select-option': validPassport })
  isStatusCode200(res)

  switch (validPassport) {
    case YesOrNo.YES:
      isPageContentCorrect(
        res,
        'Does your passport have this symbol on the cover?'
      )
      isPageRedirectCorrect(res, '/biometricChip')
      break
    case YesOrNo.NO:
      isPageContentCorrect(
        res,
        'Do you have a valid UK photocard driving licence?'
      )
      isPageRedirectCorrect(res, '/validDrivingLicence')
  }
}

export function checkValidDrivingLicenseRedirect (validDrivingLicense: YesOrNo): void {
  const res = http.post(getFrontendUrl('/validDrivingLicence'), { 'driving-licence-choice': validDrivingLicense })
  isStatusCode200(res)
  isPageContentCorrect(
    res,
    'Use your UK driving licence and a GOV.UK app to confirm your identity'
  )
}

export function checkBiometricChipRedirect (validChip: YesOrNo, smartphone: SmartphoneType): void {
  const res = http.post(getFrontendUrl('/biometricChip'), { 'select-option': validChip })
  isStatusCode200(res)

  switch (validChip) {
    case YesOrNo.YES:
      if (smartphone === SmartphoneType.Iphone) {
        isPageContentCorrect(res, 'Which iPhone model do you have?')
        isPageRedirectCorrect(res, '/iphoneModel')
      } else if (smartphone === SmartphoneType.Android) {
        isPageContentCorrect(
          res,
          'Use your passport and a GOV.UK app to confirm your identity'
        )
        isPageRedirectCorrect(res, '/idCheckApp')
      }
      break
    case YesOrNo.NO:
      isPageContentCorrect(
        res,
        'Do you have a valid UK photocard driving licence?'
      )
      isPageRedirectCorrect(res, '/validDrivingLicence')
      break
  }
}

export function checkIphoneModelRedirect (iphoneModel: IphoneType): void {
  const res = http.post(getFrontendUrl('/iphoneModel'), { 'select-option': iphoneModel })
  isStatusCode200(res)
  isPageContentCorrect(
    res,
    'Use your passport and a GOV.UK app to confirm your identity'
  )
  isPageRedirectCorrect(res, '/idCheckApp')
}

export function checkWorkingCameraRedirect (workingCameraAnswer: YesOrNo): void {
  const res = http.post(getFrontendUrl('/workingCamera'), { 'working-camera-choice': workingCameraAnswer })
  isStatusCode200(res)
  isPageContentCorrect(
    res,
    'The app uses flashing colours. Do you want to continue?'
  )
  isPageRedirectCorrect(res, '/flashingWarning')
}

export function checkFlashingWarningRedirect (warningAnswer: YesOrNo, device: DeviceType): void {
  const res = http.post(getFrontendUrl('/flashingWarning'), { 'flashing-colours-choice': warningAnswer })
  isStatusCode200(res)

  switch (device) {
    case DeviceType.Other:
      isPageContentCorrect(res, 'Download the GOV.UK ID Check app')
      isPageRedirectCorrect(res, '/downloadApp')
      break
    case DeviceType.ComputerOrTablet:
      isPageContentCorrect(
        res,
        'Scan the QR code to continue confirming your identity on your phone'
      )
      isPageRedirectCorrect(res, '/downloadApp')
      break
  }
}

export function getBiometricToken (sessionId: string): void {
  const biometricTokenUrl = getBackendUrl('/biometricToken', { authSessionId: sessionId })
  const res = http.get(biometricTokenUrl)

  isStatusCode200(res)
}

export function postFinishBiometricToken (sessionId: string): void {
  const finishBiometricSessionUrl = getBackendUrl('/finishBiometricSession', { authSessionId: sessionId, biometricSessionId: env.biometricSessionId })
  const res = http.post(finishBiometricSessionUrl)

  isStatusCode200(res)
}

export function checkRedirectPage (sessionId: string): void {
  const redirectUrl = getFrontendUrl('/redirect', { sessionId })
  const res = http.get(redirectUrl, { redirects: 0 })
  isStatusCode302(res)
  isHeaderLocationCorrect(res, '/redirect')
}
