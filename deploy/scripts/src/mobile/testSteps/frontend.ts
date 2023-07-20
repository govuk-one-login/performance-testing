import http from 'k6/http'
import { fail, group } from 'k6'
import { buildFrontendUrl } from '../utils/url'
import {
  isStatusCode200,
  isStatusCode201,
  isStatusCode302,
  validatePageRedirect,
  validatePageContent,
  validateLocationHeader,
  validateQueryParam
} from '../utils/assertions'
import {
  parseTestClientResponse,
  postTestClientStart
} from '../utils/test-client'
import { Trend } from 'k6/metrics'

const transactionDuration = new Trend('duration')

export function getSessionIdFromCookieJar (): string {
  const jar = http.cookieJar()
  return jar.cookiesForURL(buildFrontendUrl('')).sessionId.toString()
}

export function startJourney (): void {
  let authorizeUrl: string
  group('POST test client /start', () => {
    const startTime = Date.now()
    const testClientRes = postTestClientStart()
    const endTime = Date.now()

    isStatusCode201(testClientRes)
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    authorizeUrl = parseTestClientResponse(testClientRes, 'WebLocation')
  })

  group('GET /authorize', () => {
    const startTime = Date.now()
    const authorizeRes = http.get(authorizeUrl, {
      tags: { name: 'GET /authorize' }
    })
    const endTime = Date.now()

    isStatusCode200(authorizeRes) &&
    validatePageRedirect(authorizeRes, '/selectDevice') &&
    validatePageContent(
      authorizeRes,
      'Are you on a computer or a tablet right now?'
    )
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

export function postSelectDevice (): void {
  group('POST /selectDevice', () => {
    const startTime = Date.now()
    const res = http.post(
      buildFrontendUrl('/selectDevice'),
      { 'select-device-choice': 'smartphone' },
      { tags: { name: 'POST /selectDevice' } }
    )
    const endTime = Date.now()

    isStatusCode200(res) &&
    validatePageRedirect(res, '/selectSmartphone') &&
    validatePageContent(res, 'Which smartphone are you using?')
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

export function postSelectSmartphone (): void {
  group('POST /selectSmartphone', () => {
    const startTime = Date.now()
    const res = http.post(
      buildFrontendUrl('/selectSmartphone'),
      { 'smartphone-choice': 'iphone' },
      { tags: { name: 'POST /selectSmartphone' } }
    )
    const endTime = Date.now()

    isStatusCode200(res) &&
    validatePageRedirect(res, '/validPassport') &&
    validatePageContent(res, 'Do you have a valid passport?')
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

export function postValidPassport (): void {
  group('POST /validPassport', () => {
    const startTime = Date.now()
    const res = http.post(
      buildFrontendUrl('/validPassport'),
      { 'select-option': 'yes' },
      { tags: { name: 'POST /validPassport' } }
    )
    const endTime = Date.now()

    isStatusCode200(res) &&
    validatePageRedirect(res, '/biometricChip') &&
    validatePageContent(
      res,
      'Does your passport have this symbol on the cover?'
    )
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

export function postBiometricChip (): void {
  group('POST /biometricChip', () => {
    const startTime = Date.now()
    const res = http.post(
      buildFrontendUrl('/biometricChip'),
      { 'select-option': 'yes' },
      { tags: { name: 'POST /biometricChip' } }
    )
    const endTime = Date.now()

    isStatusCode200(res) &&
    validatePageRedirect(res, '/iphoneModel') &&
    validatePageContent(res, 'Which iPhone model do you have?')
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

export function postIphoneModel (): void {
  group('POST /iphoneModel', () => {
    const startTime = Date.now()
    const res = http.post(
      buildFrontendUrl('/iphoneModel'),
      { 'select-option': 'iphone7OrNewer' },
      { tags: { name: 'POST /iphoneModel' } }
    )
    const endTime = Date.now()

    isStatusCode200(res) &&
    validatePageRedirect(res, '/idCheckApp') &&
    validatePageContent(
      res,
      'Use your passport and a GOV.UK app to confirm your identity'
    )
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

export function postIdCheckApp (): void {
  group('POST /idCheckApp', () => {
    const startTime = Date.now()
    const res = http.post(
      buildFrontendUrl('/idCheckApp'),
      {},
      { tags: { name: 'POST /idCheckApp' } }
    )
    const endTime = Date.now()

    isStatusCode200(res) &&
    validatePageRedirect(res, '/workingCamera') &&
    validatePageContent(res, 'Does your smartphone have a working camera?')
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

export function postWorkingCamera (): void {
  group('POST /workingCamera', () => {
    const startTime = Date.now()
    const res = http.post(
      buildFrontendUrl('/workingCamera'),
      { 'working-camera-choice': 'yes' },
      { tags: { name: 'POST /workingCamera' } }
    )
    const endTime = Date.now()

    isStatusCode200(res) &&
    validatePageRedirect(res, '/flashingWarning') &&
    validatePageContent(
      res,
      'The app uses flashing colours. Do you want to continue?'
    )
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

export function postFlashingWarning (): void {
  group('POST /flashingWarning', () => {
    const startTime = Date.now()
    const res = http.post(
      buildFrontendUrl('/flashingWarning'),
      { 'flashing-colours-choice': 'yes' },
      { tags: { name: 'POST /flashingWarning' } }
    )
    const endTime = Date.now()

    isStatusCode200(res) &&
    validatePageRedirect(res, '/downloadApp') &&
    validatePageContent(res, 'Download the GOV.UK ID Check app')
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

export function getRedirect (): void {
  group('GET /redirect', () => {
    const redirectUrl = buildFrontendUrl('/redirect', {
      sessionId: getSessionIdFromCookieJar()
    })

    const startTime = Date.now()
    const res = http.get(redirectUrl, {
      redirects: 0,
      tags: { name: 'GET /redirect' }
    })
    const endTime = Date.now()

    isStatusCode302(res) &&
    validateLocationHeader(res) &&
    validateQueryParam(res.headers.Location, 'code')
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

export function getAbortCommand (): void {
  group('GET /abortCommand', () => {
    const abortCommandUrl = buildFrontendUrl('/abortCommand', {
      sessionId: getSessionIdFromCookieJar()
    })

    const startTime = Date.now()
    const res = http.get(abortCommandUrl, {
      redirects: 0,
      tags: { name: 'GET /abortCommand' }
    })
    const endTime = Date.now()

    isStatusCode302(res) &&
    validateLocationHeader(res) &&
    validateQueryParam(res.headers.Location, 'error')
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}
