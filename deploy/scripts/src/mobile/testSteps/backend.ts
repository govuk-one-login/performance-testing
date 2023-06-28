import http from 'k6/http'
import { group } from 'k6'
import { uuidv4 } from '../utils/k6/k6-utils'
import { buildBackendUrl } from '../utils/url'
import { parseTestClientResponse, postTestClientStart } from '../utils/test-client'
import { isStatusCode200, isStatusCode201 } from '../utils/assertions'

export function postVerifyAuthorizeRequest (): string {
  let verifyUrl: string
  group('POST test client /start', () => {
    const testClientRes = postTestClientStart()
    isStatusCode201(testClientRes)
    verifyUrl = parseTestClientResponse(testClientRes, 'ApiLocation')
  })

  return group('POST /verifyAuthorizeRequest', () => {
    const verifyRes = http.post(verifyUrl)
    isStatusCode200(verifyRes)
    return verifyRes.json('sessionId') as string
  })
}

export function postResourceOwnerDocumentGroups (sessionId: string): void {
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
    const res = http.post(documentGroupsUrl, JSON.stringify(documentGroupsData))
    isStatusCode200(res)
  })
}

export function getBiometricTokenV2 (sessionId: string): void {
  group('GET /biometricToken/v2', () => {
    const biometricTokenUrl = buildBackendUrl('/biometricToken/v2', { authSessionId: sessionId })
    const res = http.get(biometricTokenUrl, {
      tags: { name: 'Get Biometric Token' }
    })
    isStatusCode200(res)
  })
}

export function postFinishBiometricSession (sessionId: string): void {
  group('POST /finishBiometricSession', () => {
    const finishBiometricSessionUrl = buildBackendUrl('/finishBiometricSession', {
      authSessionId: sessionId,
      biometricSessionId: uuidv4()
    })
    const res = http.post(finishBiometricSessionUrl)
    isStatusCode200(res)
  })
}

interface RedirectResponse {
  authorizationCode: string
  redirectUri: string
}

export function getRedirect (sessionId: string): RedirectResponse {
  return group('GET /redirect', () => {
    const redirectUrl = buildBackendUrl('/redirect', { sessionId })
    const redirectRes = http.get(redirectUrl, {
      tags: { name: 'Redirect BE' }
    })

    isStatusCode200(redirectRes)
    return {
      authorizationCode: redirectRes.json('authorizationCode') as string,
      redirectUri: redirectRes.json('redirectUri') as string
    }
  })
}

export function postToken (redirectResponse: RedirectResponse): string {
  return group('POST /token', () => {
    const accessTokenUrl = buildBackendUrl('/token')
    const accessTokenResponse = http.post(accessTokenUrl, {
      code: redirectResponse.authorizationCode,
      grant_type: 'authorization_code',
      redirect_uri: redirectResponse.redirectUri
    })
    isStatusCode200(accessTokenResponse)
    return accessTokenResponse.json('access_token') as string
  })
}

export function postUserInfoV2 (accessToken: string): void {
  group('POST /userinfo/v2', () => {
    const userInfoV2Url = buildBackendUrl('/userinfo/v2')
    const res = http.post(userInfoV2Url, '', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken
      }
    })
    isStatusCode200(res)
  })
}
