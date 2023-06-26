import http, { type Response } from 'k6/http'
import { group, sleep } from 'k6'
import { uuidv4 } from './k6/k6-utils'
import { isStatusCode200, isStatusCode201, parseTestClientResponse, postTestClientStart } from './common'
import { getBackendUrl } from './url'

export function backendJourneyTestSteps (): void {
  let verifyUrl: string
  group('POST test client /start', () => {
    const testClientRes = postTestClientStart()
    isStatusCode201(testClientRes)
    verifyUrl = parseTestClientResponse(testClientRes, 'ApiLocation')
  })

  let sessionId: string
  group('POST /verifyAuthorizeRequest', () => {
    const verifyRes = http.post(verifyUrl)
    isStatusCode200(verifyRes)
    sessionId = verifyRes.json('sessionId') as string
  })

  sleep(1)

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
    const documentGroupsUrl = getBackendUrl(
      `/resourceOwner/documentGroups/${sessionId}`
    )
    const res = http.post(documentGroupsUrl, JSON.stringify(documentGroupsData))
    isStatusCode200(res)
  })

  sleep(1)

  group('GET /biometricToken/v2', () => {
    const biometricTokenUrl = getBackendUrl('/biometricToken/v2', { authSessionId: sessionId })
    const res = http.get(biometricTokenUrl, {
      tags: { name: 'Get Biometric Token' }
    })
    isStatusCode200(res)
  })

  sleep(1)

  group('POST /finishBiometricSession', () => {
    const finishBiometricSessionUrl = getBackendUrl('/finishBiometricSession', {
      authSessionId: sessionId,
      biometricSessionId: uuidv4()
    })
    const res = http.post(finishBiometricSessionUrl)
    isStatusCode200(res)
  })

  sleep(1)

  let redirectRes: Response
  group('GET /redirect (BE)', () => {
    const redirectUrl = getBackendUrl('/redirect', { sessionId })
    redirectRes = http.get(redirectUrl, {
      tags: { name: 'Redirect BE' }
    })
    isStatusCode200(redirectRes)
  })

  sleep(1)

  let accessTokenResponse: Response
  group('POST /token', () => {
    const accessTokenUrl = getBackendUrl('/token')
    const authorizationCode = redirectRes.json('authorizationCode') as string
    const redirectUri = redirectRes.json('redirectUri') as string
    accessTokenResponse = http.post(accessTokenUrl, {
      code: authorizationCode,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })
    isStatusCode200(accessTokenResponse)
  })

  sleep(1)

  group('POST /userinfo/v2', () => {
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
