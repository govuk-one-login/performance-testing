import http, { type Response } from 'k6/http'
import { check, group } from 'k6'
import { URL } from './k6/url'
import { uuidv4 } from './k6/k6-utils'
import {
  isStatusCode200,
  isStatusCode201, isStatusCode302,
  parseTestClientResponse,
  postTestClientStart
} from './common'
import { getBackendUrl, getFrontendUrl } from './url'

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

function getSessionIdFromCookieJar (): string {
  const jar = http.cookieJar()
  return jar.cookiesForURL(getFrontendUrl('')).sessionId.toString()
}

export function startJourney (): void {
  let authorizeUrl: string
  group('POST test client /start', () => {
    const testClientRes = postTestClientStart()
    isStatusCode201(testClientRes)
    authorizeUrl = parseTestClientResponse(testClientRes, 'WebLocation')
  })

  group('GET /authorize', () => {
    const authorizeRes = http.get(authorizeUrl)
    isStatusCode200(authorizeRes)
    validatePageRedirect(authorizeRes, '/selectDevice')
    validatePageContent(
      authorizeRes,
      'Are you on a computer or a tablet right now?'
    )
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
    validatePageContent(
      res,
      'Does your passport have this symbol on the cover?'
    )
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
    validatePageContent(
      res,
      'Use your passport and a GOV.UK app to confirm your identity'
    )
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
    validatePageContent(
      res,
      'The app uses flashing colours. Do you want to continue?'
    )
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
    const redirectUrl = getFrontendUrl('/redirect', {
      sessionId: getSessionIdFromCookieJar()
    })
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
    const abortCommandUrl = getFrontendUrl('/abortCommand', {
      sessionId: getSessionIdFromCookieJar()
    })
    const res = http.get(abortCommandUrl, {
      redirects: 0,
      tags: { name: 'Abort Command' }
    })
    isStatusCode302(res)
    validateHeaderLocation(res)
    validateQueryParam(res.headers.Location, 'error')
  })
}
