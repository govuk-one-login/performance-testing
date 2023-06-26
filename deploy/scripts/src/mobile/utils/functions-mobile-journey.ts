import { check, group, sleep } from 'k6'
import http, { type Response } from 'k6/http'
import { URL } from './k6/url'
import { uuidv4 } from './k6/k6-utils'

const env = {
  testClientExecuteUrl: __ENV.MOBILE_TEST_CLIENT_EXECUTE_URL,
  backendUrl: __ENV.MOBILE_BACKEND_URL,
  frontendUrl: __ENV.MOBILE_FRONTEND_URL
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

function validatePageContent (res: Response, pageContent: string): boolean {
  return check(res, {
    'validate page content': (r) => (r.body as string).includes(pageContent)
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
    JSON.stringify({ target: env.backendUrl, frontendUri: env.frontendUrl }),
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
  return getUrl(OAUTH_ROUTE + path, env.frontendUrl, query)
}

function getBackendUrl (path: string, query?: Record<string, string>): string {
  return getUrl(path, env.backendUrl, query)
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
    validatePageContent(authorizeRes, 'Are you on a computer or a tablet right now?')
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
    validatePageContent(res, 'Which smartphone are you using?')
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
    validatePageContent(res, 'Do you have a valid passport?')
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
    validatePageContent(res, 'Does your passport have this symbol on the cover?')
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
    validatePageContent(res, 'Which iPhone model do you have?')
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
    validatePageContent(res, 'Use your passport and a GOV.UK app to confirm your identity')
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
    validatePageContent(res, 'Does your smartphone have a working camera?')
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
    validatePageContent(res, 'The app uses flashing colours. Do you want to continue?')
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
    validatePageContent(res, 'Download the GOV.UK ID Check app')
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

export function postDocumentGroups (): void {
  const documentGroupsData = {
    resourceOwner: {
      documentGroups: [
        {
          groupName: 'Photo Identity Document',
          allowableDocuments: ['NFC_PASSPORT']
        }
      ]
    }
  }
  group('Post Document Groups BE Request', () => {
    const documentGroupsUrl = getBackendUrl(
      `/resourceOwner/documentGroups/${getSessionIdFromCookieJar()}`
    )
    const res = http.post(
      documentGroupsUrl,
      JSON.stringify(documentGroupsData)
    )
    isStatusCode200(res)
  })
}

export function checkRedirectBackendAndAccessToken (): void {
  let redirectRes: Response
  let accessTokenResponse: Response
  group('GET Redirect BE Page /redirect', () => {
    const redirectUrl = getBackendUrl('/redirect', {
      sessionId: getSessionIdFromCookieJar()
    })
    redirectRes = http.get(redirectUrl, {
      redirects: 0,
      tags: { name: 'Redirect Final Page' }
    })
    isStatusCode200(redirectRes)
  })

  sleep(1)

  group('Post Access Token BE Request', () => {
    const accessTokenUrl = getBackendUrl('/token')
    const authorizationCode = redirectRes.json('authorizationCode') as string
    const redirectUri = redirectRes.json('redirectUri') as string
    accessTokenResponse = http.post(accessTokenUrl, {
      code: authorizationCode,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })
    console.log(accessTokenResponse.body)
    isStatusCode200(accessTokenResponse)
  })

  sleep(1)

  group('Post User Info v2 BE Request', () => {
    const accessToken = accessTokenResponse.json('access_token') as string
    const userInfoV2Url = getBackendUrl('/userinfo/v2')
    const res = http.post(userInfoV2Url, '', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken
      }
    })

    isStatusCode200(res)
  })
}
