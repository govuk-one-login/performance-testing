import http from 'k6/http'
import { group } from 'k6'
import { uuidv4 } from '../../common/utils/jslib/index'
import { buildBackendUrl } from '../utils/url'
import { parseTestClientResponse, postTestClientStart } from '../utils/test-client'
import { timeRequest } from '../../common/utils/request/timing'
import { buildFrontendUrl } from '../utils/url'
import { validatePageRedirect, validateLocationHeader, validateQueryParam } from '../utils/assertions'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../../common/utils/checks/assertions'

/****************************************Functions from the Frontend teststeps**********************************/

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
      ...validatePageRedirect('/iphoneModel'),
      ...pageContentCheck('Which iPhone model do you have?')
    })
  )
}

export function postIphoneModel(): void {
  group('POST /iphoneModel', () =>
    timeRequest(() => http.post(buildFrontendUrl('/iphoneModel'), { 'select-option': 'iphone7OrNewer' }), {
      isStatusCode200,
      ...validatePageRedirect('/idCheckApp'),
      ...pageContentCheck('Use your passport and a GOV.UK app to confirm your identity')
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
// GET /appInfo'

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

/****************************************functions from backend teststeps**************************************/

export function postVerifyAuthorizeRequest(): string {
  const testClientRes = postTestClientStart()
  const verifyUrl = parseTestClientResponse(testClientRes, 'ApiLocation')

  const verifyRes = group('POST /verifyAuthorizeRequest', () =>
    timeRequest(() => http.post(verifyUrl), { isStatusCode200 })
  )
  return verifyRes.json('sessionId') as string
}

export function postResourceOwnerDocumentGroups(sessionId: string): void {
  group('POST /resourceOwner/documentGroups', () => {
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
    const documentGroupsUrl = buildBackendUrl(`/resourceOwner/documentGroups/${sessionId}`)

    timeRequest(() => http.post(documentGroupsUrl, JSON.stringify(documentGroupsData)), { isStatusCode200 })
  })
}

export function getBiometricTokenV2(sessionId: string): void {
  group('GET /biometricToken/v2', () => {
    const biometricTokenUrl = buildBackendUrl('/biometricToken/v2', {
      authSessionId: sessionId
    })

    timeRequest(() => http.get(biometricTokenUrl), { isStatusCode200 })
  })
}

export function postFinishBiometricSession(sessionId: string): void {
  group('POST /finishBiometricSession', () => {
    const finishBiometricSessionUrl = buildBackendUrl('/finishBiometricSession', {
      authSessionId: sessionId,
      biometricSessionId: uuidv4()
    })

    timeRequest(() => http.post(finishBiometricSessionUrl), { isStatusCode200 })
  })
}

/* Not required in the new combined journey
export function getRedirect(sessionId: string): {
  authorizationCode: string
  redirectUri: string
} {
  return group('GET /redirect', () => {
    const redirectUrl = buildBackendUrl('/redirect', { sessionId })

    const redirectRes = timeRequest(() => http.get(redirectUrl), { isStatusCode200 })

    return {
      authorizationCode: redirectRes.json('authorizationCode') as string,
      redirectUri: redirectRes.json('redirectUri') as string
    }
  })
}*/

export function postToken(authorizationCode: string, redirectUri: string): string {
  return group('POST /token', () => {
    const tokenUrl = buildBackendUrl('/token')

    const tokenResponse = timeRequest(
      () =>
        http.post(tokenUrl, {
          code: authorizationCode,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        }),
      { isStatusCode200 }
    )
    return tokenResponse.json('access_token') as string
  })
}

export function postUserInfoV2(accessToken: string): void {
  group('POST /userinfo/v2', () => {
    const userInfoV2Url = buildBackendUrl('/userinfo/v2')

    timeRequest(
      () =>
        http.post(userInfoV2Url, null, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + accessToken
          }
        }),
      { isStatusCode200 }
    )
  })
}
