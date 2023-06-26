import { check, group } from 'k6'
import http, { type Response } from 'k6/http'
import { URL } from './k6/url'
import { uuidv4 } from './k6/k6-utils'

const env = {
  testClientExecuteUrl: __ENV.MOBILE_TEST_CLIENT_EXECUTE_URL,
  backEndUrl: __ENV.MOBILE_BACK_END_URL,
  frontEndUrl: __ENV.MOBILE_FRONT_END_URL
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

function validatePageRedirect (res: Response, pageUrl: string): boolean {
  return check(res, {
    'validate redirect url': (r) => {
      const url = new URL(r.url)
      return url.pathname.includes(pageUrl)
    }
  })
}

function validateHeaderLocation (res: Response): boolean {
  return check(res, {
    'validate redirect url': (res) => {
      const url = new URL(res.headers.Location)
      return url.pathname.includes('/redirect')
    }
  })
}

function validateQueryParam (url: string, param: string): boolean {
  return check(url, {
    'validate query param': (url) => {
      const queryParams = new URL(url).searchParams
      return queryParams.get(param) !== null
    }
  })
}

function postTestClientStart (): Response {
  return http.post(
    getUrl('start', env.testClientExecuteUrl),
    JSON.stringify({ target: env.backEndUrl, frontendUri: env.frontEndUrl }),
    {
      tags: { name: 'Post request to authorize URL' },
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

function parseAuthorizeUrl (response: Response): string {
  const authorizeUrl = response.json('WebLocation')
  if (typeof authorizeUrl !== 'string') {
    throw new Error('Failed to parse authorize URL from response')
  }

  return authorizeUrl
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

export function startJourney (): void {
  let authorizeUrl: string
  group('POST test client /start', () => {
    const testClientRes = postTestClientStart()
    isStatusCode201(testClientRes)
    authorizeUrl = parseAuthorizeUrl(testClientRes)
  })

  group('GET /authorize', () => {
    const authorizeRes = http.get(authorizeUrl)
    isStatusCode200(authorizeRes)
    validatePageRedirect(authorizeRes, '/selectDevice')
  })
}

export function postSelectDevice (): void {
  group('POST /selectDevice', () => {
    const res = http.post(
      getFrontendUrl('/selectDevice'),
      { 'select-device-choice': 'smartphone' },
      { tags: { name: 'Select Device Page' } }
    )
    isStatusCode200(res)
    validatePageRedirect(res, '/selectSmartphone')
  })
}

export function postSelectSmartphone (): void {
  group('POST /selectSmartphone', () => {
    const res = http.post(
      getFrontendUrl('/selectSmartphone'),
      { 'smartphone-choice': 'iphone' },
      { tags: { name: 'Select Smartphone Page' } }
    )
    isStatusCode200(res)
    validatePageRedirect(res, '/validPassport')
  })
}

export function postValidPassport (): void {
  group('POST /validPassport', () => {
    const res = http.post(
      getFrontendUrl('/validPassport'),
      { 'select-option': 'yes' },
      { tags: { name: 'Select Valid Passport Page' } }
    )
    isStatusCode200(res)
    validatePageRedirect(res, '/biometricChip')
  })
}

export function postBiometricChip (): void {
  group('POST /biometricChip', () => {
    const res = http.post(
      getFrontendUrl('/biometricChip'),
      { 'select-option': 'yes' },
      { tags: { name: 'Select Biometric Chip Page' } }
    )
    isStatusCode200(res)
    validatePageRedirect(res, '/iphoneModel')
  })
}

export function postIphoneModel (): void {
  group('POST /iphoneModel', () => {
    const res = http.post(
      getFrontendUrl('/iphoneModel'),
      { 'select-option': 'iphone7OrNewer' },
      { tags: { name: 'Select Iphone Model Page' } }
    )
    isStatusCode200(res)
    validatePageRedirect(res, '/idCheckApp')
  })
}

export function postIdCheckApp (): void {
  group('POST /idCheckApp', () => {
    const res = http.post(
      getFrontendUrl('/idCheckApp'),
      {},
      { tags: { name: 'ID Check App Page' } }
    )
    isStatusCode200(res)
    validatePageRedirect(res, '/workingCamera')
  })
}

export function postWorkingCamera (): void {
  group('POST /workingCamera', () => {
    const res = http.post(
      getFrontendUrl('/workingCamera'),
      { 'working-camera-choice': 'yes' },
      { tags: { name: 'Select Working Camera' } }
    )
    isStatusCode200(res)
    validatePageRedirect(res, '/flashingWarning')
  })
}

export function postFlashingWarning (): void {
  group('POST /flashingWarning', () => {
    const res = http.post(
      getFrontendUrl('/flashingWarning'),
      { 'flashing-colours-choice': 'yes' },
      { tags: { name: 'Select Flashing Warning Page' } }
    )
    isStatusCode200(res)
    validatePageRedirect(res, '/downloadApp')
  })
}

export function getBiometricToken (): void {
  group('GET /biometricToken/v2', () => {
    const biometricTokenUrl = getBackendUrl('/biometricToken/v2', {
      authSessionId: getSessionIdFromCookieJar()
    })
    const res = http.get(biometricTokenUrl, {
      tags: { name: 'Get Biometric Token' }
    })
    isStatusCode200(res)
  })
}

export function postFinishBiometricSession (): void {
  group('POST /finishBiometricSession', () => {
    const finishBiometricSessionUrl = getBackendUrl('/finishBiometricSession', {
      authSessionId: getSessionIdFromCookieJar(),
      biometricSessionId: uuidv4()
    })
    const res = http.post(finishBiometricSessionUrl)
    isStatusCode200(res)
  })
}

export function getRedirect (): void {
  group('GET /redirect', () => {
    const redirectUrl = getFrontendUrl('/redirect', { sessionId: getSessionIdFromCookieJar() })
    const res = http.get(redirectUrl, {
      redirects: 0,
      tags: { name: 'Redirect Final Page' }
    })
    isStatusCode302(res)
    validateHeaderLocation(res)
    validateQueryParam(res.headers.Location, 'code')
  })
}

export function getAbortCommand (): void {
  group('GET /abortCommand', () => {
    const abortCommandUrl = getFrontendUrl('/abortCommand', { sessionId: getSessionIdFromCookieJar() })
    const res = http.get(abortCommandUrl, {
      redirects: 0,
      tags: { name: 'Abort Command' }
    })
    isStatusCode302(res)
    validateHeaderLocation(res)
    validateQueryParam(res.headers.Location, 'error')
  })
}
