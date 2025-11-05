import http from 'k6/http'
import { group } from 'k6'
import { buildFrontendUrl } from '../utils/url'
import { validatePageRedirect, validateLocationHeader, validateQueryParam } from '../utils/assertions'
import { parseTestClientResponse, postTestClientStart } from '../utils/test-client'
import { timeRequest } from '../../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../../common/utils/checks/assertions'

export function getSessionIdFromCookieJar(): string {
  const jar = http.cookieJar()
  return jar.cookiesForURL(buildFrontendUrl('')).sessionId.toString()
}

export function startJourney(): void {
  const testClientRes = postTestClientStart()
  const authorizeUrl = parseTestClientResponse(testClientRes, 'WebLocation')

  group('GET /authorize', () =>
    timeRequest(() => http.get(authorizeUrl), {
      isStatusCode200,
      ...validatePageRedirect('/selectDevice'),
      ...pageContentCheck('Are you on a computer or a tablet right now?')
    })
  )
}

export function postSelectDevice(): void {
  group('POST /selectDevice', () =>
    timeRequest(() => http.post(buildFrontendUrl('/selectDevice'), { 'select-device-choice': 'smartphone' }), {
      isStatusCode200,
      ...validatePageRedirect('/selectSmartphone'),
      ...pageContentCheck('Which smartphone are you using?')
    })
  )
}

export function postSelectSmartphone(): void {
  group('POST /selectSmartphone', () =>
    timeRequest(() => http.post(buildFrontendUrl('/selectSmartphone'), { 'smartphone-choice': 'iphone' }), {
      isStatusCode200,
      ...validatePageRedirect('/validPassport'),
      ...pageContentCheck('Do you have a valid passport?')
    })
  )
}

export function postValidPassport(): void {
  group('POST /validPassport', () =>
    timeRequest(() => http.post(buildFrontendUrl('/validPassport'), { 'select-option': 'yes' }), {
      isStatusCode200,
      ...validatePageRedirect('/biometricChip'),
      ...pageContentCheck('Does your passport have this symbol on the cover?')
    })
  )
}

export function postBiometricChip(): void {
  group('POST /biometricChip', () =>
    timeRequest(() => http.post(buildFrontendUrl('/biometricChip'), { 'select-option': 'yes' }), {
      isStatusCode200,
      ...validatePageRedirect('/idCheckApp'),
      ...pageContentCheck('Use your passport and an app to prove your identity')
    })
  )
}

export function postIdCheckApp(): void {
  group('POST /idCheckApp', () =>
    timeRequest(() => http.post(buildFrontendUrl('/idCheckApp'), {}, { tags: { name: 'POST /idCheckApp' } }), {
      isStatusCode200,
      ...validatePageRedirect('/downloadApp'),
      ...pageContentCheck('Download or open the GOV.UK ID Check app')
    })
  )
}

export function getRedirect(): void {
  group('GET /redirect', () => {
    const redirectUrl = buildFrontendUrl('/redirect', {
      sessionId: getSessionIdFromCookieJar()
    })

    timeRequest(
      () =>
        http.get(redirectUrl, {
          redirects: 0
        }),
      {
        isStatusCode302,
        validateLocationHeader,
        ...validateQueryParam('code')
      }
    )
  })
}

export function getAbortCommand(): void {
  group('GET /abortCommand', () => {
    const abortCommandUrl = buildFrontendUrl('/abortCommand', {
      sessionId: getSessionIdFromCookieJar()
    })

    timeRequest(
      () =>
        http.get(abortCommandUrl, {
          redirects: 0
        }),
      {
        isStatusCode302,
        validateLocationHeader,
        ...validateQueryParam('error')
      }
    )
  })
}
