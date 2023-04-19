import { check } from 'k6'
import http, { type Response } from 'k6/http'
import { URL } from 'https://jslib.k6.io/url/1.0.0/index.js'

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

export interface Cookies {
  readonly cookies: Record<string, string>
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

function getSessionId (verifyRes: Response): string {
  const sessionId = verifyRes.cookies.sessionId.find(s => s.value.length > 0)?.value

  if (sessionId == null) {
    throw new Error('Cannot find sessionId cookie')
  }

  return sessionId
}

export function sessionIdCookie (): Cookies {
  const res = postToVerifyURL()
  isStatusCode201(res)

  const verifyUrl = parseVerifyUrl(res)
  const verifyRes = http.get(verifyUrl, { redirects: 0 })
  const sessionId = getSessionId(verifyRes)

  const cookies = { sessionId }
  return { cookies }
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

export function startDcmawJourney ({ cookies }: Cookies): void {
  const res = http.get(getFrontendUrl('/selectDevice'), { cookies })
  isStatusCode200(res)
  isPageContentCorrect(res, 'Are you on a computer or a tablet right now?')
  isPageRedirectCorrect(res, '/selectDevice')
}

export function checkSelectDeviceRedirect ({ cookies }: Cookies, device: DeviceType): void {
  const res = http.post(getFrontendUrl('/selectDevice'), { 'select-device-choice': device }, { cookies: { ...cookies, device } })
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

export function checkSelectSmartphoneRedirect ({ cookies }: Cookies, smartphone: SmartphoneType): void {
  const res = http.post(getFrontendUrl('/selectSmartphone'), { 'smartphone-choice': smartphone }, { cookies: { ...cookies, nfc: 'false', smartphone } })
  isStatusCode200(res)
  isPageContentCorrect(res, 'Do you have a valid passport?')
  isPageRedirectCorrect(res, '/validPassport')
}

export function checkValidPassportPageRedirect ({ cookies }: Cookies, validPassport: YesOrNo): void {
  const res = http.post(getFrontendUrl('/validPassport'), { 'select-option': validPassport }, { cookies })
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

export function checkValidDrivingLicenseRedirect ({ cookies }: Cookies, validDrivingLicense: YesOrNo): void {
  const res = http.post(getFrontendUrl('/validDrivingLicence'), { 'driving-licence-choice': validDrivingLicense }, { cookies })
  isStatusCode200(res)
  isPageContentCorrect(
    res,
    'Use your UK driving licence and a GOV.UK app to confirm your identity'
  )
}

export function checkBiometricChipRedirect ({ cookies }: Cookies, validChip: YesOrNo, smartphone: SmartphoneType): void {
  const res = http.post(getFrontendUrl('/biometricChip'), { 'select-option': validChip }, { cookies })
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

export function checkIphoneModelRedirect ({ cookies }: Cookies, iphoneModel: IphoneType): void {
  const res = http.post(getFrontendUrl('/iphoneModel'), { 'select-option': iphoneModel }, { cookies: { ...cookies, nfc: 'true' } })
  isStatusCode200(res)
  isPageContentCorrect(
    res,
    'Use your passport and a GOV.UK app to confirm your identity'
  )
  isPageRedirectCorrect(res, '/idCheckApp')
}

export function checkWorkingCameraRedirect ({ cookies }: Cookies, workingCameraAnswer: YesOrNo): void {
  const res = http.post(getFrontendUrl('/workingCamera'), { 'working-camera-choice': workingCameraAnswer }, { cookies })
  isStatusCode200(res)
  isPageContentCorrect(
    res,
    'The app uses flashing colours. Do you want to continue?'
  )
  isPageRedirectCorrect(res, '/flashingWarning')
}

export function checkFlashingWarningRedirect ({ cookies }: Cookies, warningAnswer: YesOrNo, device: DeviceType): void {
  const res = http.post(getFrontendUrl('/flashingWarning'), { 'flashing-colours-choice': warningAnswer }, { cookies })
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

export function getBiometricToken ({ cookies }: Cookies): void {
  const biometricTokenUrl = getBackendUrl('/biometricToken', { authSessionId: cookies.sessionId })
  const res = http.get(biometricTokenUrl)

  isStatusCode200(res)
}

export function postFinishBiometricToken ({ cookies }: Cookies): void {
  const finishBiometricSessionUrl = getBackendUrl('/finishBiometricSession', { authSessionId: cookies.sessionId, biometricSessionId: env.biometricSessionId })
  const res = http.post(finishBiometricSessionUrl)

  isStatusCode200(res)
}

export function checkRedirectPage ({ cookies }: Cookies): void {
  const redirectUrl = getFrontendUrl('/redirect', { sessionId: cookies.sessionId })
  const res = http.get(redirectUrl, { cookies: { ...cookies }, redirects: 0 })

  isStatusCode302(res)
  isHeaderLocationCorrect(res, '/redirect')
}
