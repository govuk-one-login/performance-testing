import http from 'k6/http'
import { group } from 'k6'
import { uuidv4 } from '../../common/utils/jslib/index'
import { buildBackendUrl } from '../utils/url'
import { parseTestClientResponse, postTestClientStart } from '../utils/test-client'
import { timeRequest } from '../../common/utils/request/timing'
import { isStatusCode200 } from '../../common/utils/checks/assertions'

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

export function postTxmaEvent(sessionId: string): void {
  group('POST /txmaEvent', () => {
    const txmaEventURL = buildBackendUrl('/txmaEvent') //{
    // SessionId: sessionId
    //})
    const payload = { sessionId: sessionId, eventName: 'DCMAW_APP_HANDOFF_START' }

    // Logging the outgoing request
    console.log(`Sending POST request to: ${txmaEventURL}`)
    console.log(`Request body: ${JSON.stringify(payload)}`)

    const res = http.post(txmaEventURL, payload) // Making the request here

    // Now logging the response details
    console.log(`Response status: ${res.status}`)
    console.log(`Response body: ${res.body}`)

    // Then, performing  checks
    timeRequest(() => res, { isStatusCode200 })
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
}

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

export function getAppInfo(): void {
  group('GET /appInfo', () => {
    const getAppInfoUrl = buildBackendUrl('appInfo', {})

    timeRequest(() => http.get(getAppInfoUrl), { isStatusCode200 })
  })
}
