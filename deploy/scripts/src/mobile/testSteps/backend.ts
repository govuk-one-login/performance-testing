import http from 'k6/http'
import { fail, group } from 'k6'
import { uuidv4 } from '../../common/utils/jslib/index'
import { buildBackendUrl } from '../utils/url'
import {
  parseTestClientResponse,
  postTestClientStart
} from '../utils/test-client'
import { isStatusCode200, isStatusCode201 } from '../utils/assertions'
import { Trend } from 'k6/metrics'

const transactionDuration = new Trend('duration', true)

export function postVerifyAuthorizeRequest (): string {
  let verifyUrl: string
  group('POST test client /start', () => {
    const startTime = Date.now()
    const testClientRes = postTestClientStart()
    const endTime = Date.now()

    isStatusCode201(testClientRes)
      ? transactionDuration.add(endTime - startTime)
      : fail()

    verifyUrl = parseTestClientResponse(testClientRes, 'ApiLocation')
  })

  return group('POST /verifyAuthorizeRequest', () => {
    const startTime = Date.now()
    const verifyRes = http.post(verifyUrl, null, {
      tags: { name: 'POST /verifyAuthorizeRequest' }
    })
    const endTime = Date.now()

    isStatusCode200(verifyRes)
      ? transactionDuration.add(endTime - startTime)
      : fail()

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
    const documentGroupsUrl = buildBackendUrl(
      `/resourceOwner/documentGroups/${sessionId}`
    )

    const startTime = Date.now()
    const res = http.post(
      documentGroupsUrl,
      JSON.stringify(documentGroupsData),
      { tags: { name: 'POST /resourceOwner/documentGroups' } }
    )
    const endTime = Date.now()

    isStatusCode200(res)
      ? transactionDuration.add(endTime - startTime)
      : fail()
  })
}

export function getBiometricTokenV2 (sessionId: string): void {
  group('GET /biometricToken/v2', () => {
    const biometricTokenUrl = buildBackendUrl('/biometricToken/v2', {
      authSessionId: sessionId
    })

    const startTime = Date.now()
    const res = http.get(biometricTokenUrl, {
      tags: { name: 'GET /biometricToken/v2' }
    })
    const endTime = Date.now()

    isStatusCode200(res)
      ? transactionDuration.add(endTime - startTime)
      : fail()
  })
}

export function postFinishBiometricSession (sessionId: string): void {
  group('POST /finishBiometricSession', () => {
    const finishBiometricSessionUrl = buildBackendUrl(
      '/finishBiometricSession',
      {
        authSessionId: sessionId,
        biometricSessionId: uuidv4()
      }
    )

    const startTime = Date.now()
    const res = http.post(finishBiometricSessionUrl, null, {
      tags: { name: 'POST /finishBiometricSession' }
    })
    const endTime = Date.now()

    isStatusCode200(res)
      ? transactionDuration.add(endTime - startTime)
      : fail()
  })
}

export function getRedirect (sessionId: string): {
  authorizationCode: string
  redirectUri: string
} {
  return group('GET /redirect', () => {
    const redirectUrl = buildBackendUrl('/redirect', { sessionId })

    const startTime = Date.now()
    const redirectRes = http.get(redirectUrl, {
      tags: { name: 'GET /redirect' }
    })
    const endTime = Date.now()

    isStatusCode200(redirectRes)
      ? transactionDuration.add(endTime - startTime)
      : fail()

    return {
      authorizationCode: redirectRes.json('authorizationCode') as string,
      redirectUri: redirectRes.json('redirectUri') as string
    }
  })
}

export function postToken (
  authorizationCode: string,
  redirectUri: string
): string {
  return group('POST /token', () => {
    const tokenUrl = buildBackendUrl('/token')

    const startTime = Date.now()
    const tokenResponse = http.post(
      tokenUrl,
      {
        code: authorizationCode,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      },
      { tags: { name: 'POST /token' } }
    )
    const endTime = Date.now()

    isStatusCode200(tokenResponse)
      ? transactionDuration.add(endTime - startTime)
      : fail()

    return tokenResponse.json('access_token') as string
  })
}

export function postUserInfoV2 (accessToken: string): void {
  group('POST /userinfo/v2', () => {
    const userInfoV2Url = buildBackendUrl('/userinfo/v2')

    const startTime = Date.now()
    const res = http.post(userInfoV2Url, null, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken
      },
      tags: { name: 'POST /userinfo/v2' }
    })
    const endTime = Date.now()

    isStatusCode200(res)
      ? transactionDuration.add(endTime - startTime)
      : fail()
  })
}
