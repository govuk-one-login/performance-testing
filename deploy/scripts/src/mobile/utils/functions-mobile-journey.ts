import { check, group } from 'k6'
import http, { type Response } from 'k6/http'
import { URL } from './url'

const env = {
  testClientExecuteUrl: __ENV.MOBILE_TEST_CLIENT_EXECUTE_URL,
  backEndUrl: __ENV.MOBILE_BACK_END_URL,
  frontEndUrl: __ENV.MOBILE_FRONT_END_URL,
  biometricSessionId: __ENV.MOBILE_BIOMETRIC_SESSION_ID
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

function postTestClientStart (): Response {
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
  const verifyUrl = response.json('WebLocation')
  if (typeof verifyUrl !== 'string') {
    throw new Error('Failed to parse verify URL from response')
  }

  return verifyUrl
}

export function getSessionIdFromCookieJar (): string {
  const jar = http.cookieJar()
  return jar.cookiesForURL(getFrontendUrl('')).sessionId.toString()
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
  group('Post test client /start', () => {
    const testClientRes = postTestClientStart()
    isStatusCode201(testClientRes)
    verifyUrl = parseVerifyUrl(testClientRes)
  })

  group('Post /verifyAuthorizeRequest', () => {
    const verifyRes = http.get(verifyUrl)
    isStatusCode200(verifyRes)
    isPageRedirectCorrect(verifyRes, '/selectDevice')
  })
}

export function postSelectDeviceAndValidateRedirect (): void {
  group('Post /selectDevice', () => {
    const res = http.post(
      getFrontendUrl('/selectDevice'),
      { 'select-device-choice': 'smartphone' },
      { tags: { name: 'Select Device Page' } }
    )
    isStatusCode200(res)
    isPageRedirectCorrect(res, '/selectSmartphone')
  })
}

export function postSelectSmartphoneAndValidateRedirect (): void {
  group('Post /selectSmartphone', () => {
    const res = http.post(
      getFrontendUrl('/selectSmartphone'),
      { 'smartphone-choice': 'iphone' },
      { tags: { name: 'Select Smartphone Page' } }
    )
    isStatusCode200(res)
    isPageRedirectCorrect(res, '/validPassport')
  })
}

export function postValidPassportAndValidateRedirect (): void {
  group('Post /validPassport', () => {
    const res = http.post(
      getFrontendUrl('/validPassport'),
      { 'select-option': 'yes' },
      { tags: { name: 'Select Valid Passport Page' } }
    )
    isStatusCode200(res)
    isPageRedirectCorrect(res, '/biometricChip')
  })
}

export function postBiometricChipAndValidateRedirect (): void {
  group('Post /biometricChip', () => {
    const res = http.post(
      getFrontendUrl('/biometricChip'),
      { 'select-option': 'yes' },
      { tags: { name: 'Select Biometric Chip Page' } }
    )
    isStatusCode200(res)
    isPageRedirectCorrect(res, '/iphoneModel')
  })
}

export function postIphoneModelAndValidateRedirect (): void {
  group('Post /iphoneModel', () => {
    const res = http.post(
      getFrontendUrl('/iphoneModel'),
      { 'select-option': 'iphone7OrNewer' },
      { tags: { name: 'Select Iphone Model Page' } }
    )
    isStatusCode200(res)
    isPageRedirectCorrect(res, '/idCheckApp')
  })
}

export function postIdCheckAppAndValidateRedirect (): void {
  group('Post /idCheckApp', () => {
    const res = http.post(
      getFrontendUrl('/idCheckApp'),
      {},
      { tags: { name: 'ID Check App Page' } }
    )
    isStatusCode200(res)
    isPageRedirectCorrect(res, '/workingCamera')
  })
}

export function postWorkingCameraAndValidateRedirect (): void {
  group('Post /workingCamera', () => {
    const res = http.post(
      getFrontendUrl('/workingCamera'),
      { 'working-camera-choice': 'yes' },
      { tags: { name: 'Select Working Camera' } }
    )
    isStatusCode200(res)
    isPageRedirectCorrect(res, '/flashingWarning')
  })
}

export function postFlashingWarningAndValidateRedirect (): void {
  group('Post /flashingWarning', () => {
    const res = http.post(
      getFrontendUrl('/flashingWarning'),
      { 'flashing-colours-choice': 'yes' },
      { tags: { name: 'Select Flashing Warning Page' } }
    )
    isStatusCode200(res)
    isPageRedirectCorrect(res, '/downloadApp')
  })
}

export function getBiometricTokenAndValidateResponse (): void {
  group('Post /biometricToken/v2', () => {
    const biometricTokenUrl = getBackendUrl('/biometricToken/v2', {
      authSessionId: getSessionIdFromCookieJar()
    })
    const res = http.get(biometricTokenUrl, {
      tags: { name: 'Get Biometric Token' }
    })
    isStatusCode200(res)
  })
}

export function postFinishBiometricTokenAndValidateResponse (): void {
  group('Post /finishBiometricSession', () => {
    const finishBiometricSessionUrl = getBackendUrl('/finishBiometricSession', {
      authSessionId: getSessionIdFromCookieJar(),
      biometricSessionId: env.biometricSessionId
    })
    const res = http.post(finishBiometricSessionUrl)
    isStatusCode200(res)
  })
}

export function getRedirectAndValidateResponse (): void {
  group('Get /redirect', () => {
    const redirectUrl = getFrontendUrl('/redirect', { sessionId: getSessionIdFromCookieJar() })
    const res = http.get(redirectUrl, {
      redirects: 0,
      tags: { name: 'Redirect Final Page' }
    })
    isStatusCode302(res)
    isHeaderLocationCorrect(res, '/redirect')
  })
}

export function getAbortCommandAndValidateResponse (): void {
  group('Get /abortCommand', () => {
    const abortCommandUrl = getFrontendUrl('/abortCommand', { sessionId: getSessionIdFromCookieJar() })
    const res = http.get(abortCommandUrl, {
      redirects: 0,
      tags: { name: 'Abort Command' }
    })
    isStatusCode302(res)
    isHeaderLocationCorrect(res, '/redirect')
  })
}
