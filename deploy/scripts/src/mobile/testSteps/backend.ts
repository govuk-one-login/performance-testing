import http from 'k6/http'
import { group } from 'k6'
import { uuidv4 } from '../../common/utils/jslib/index'
import { buildBackendUrl } from '../utils/url'
import { parseTestClientResponse, postTestClientStart } from '../utils/test-client'
import { timeRequest } from '../../common/utils/request/timing'
import { isStatusCode200, isStatusCode201 } from '../../common/utils/checks/assertions'
import { getEnv } from '../../common/utils/config/environment-variables'
import { SignatureV4 } from '../../common/utils/jslib/aws-signature'
import { type AssumeRoleOutput } from '../../common/utils/aws/types'
import { config } from '../utils/config'

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
    const txmaEventURL = buildBackendUrl('/txmaEvent')
    const payload = { sessionId: sessionId, eventName: 'DCMAW_APP_HANDOFF_START' }

    timeRequest(
      () => {
        const res = http.post(txmaEventURL, JSON.stringify(payload), {
          headers: { 'Content-Type': 'application/json' }
        })
        return res
      },
      { isStatusCode200 }
    )
  })
}

export function postFinishBiometricSession(sessionId: string): string {
  const biometricSessionId = uuidv4()

  group('POST /finishBiometricSession', () => {
    const finishBiometricSessionUrl = buildBackendUrl('/finishBiometricSession', {
      authSessionId: sessionId,
      biometricSessionId: biometricSessionId
    })

    timeRequest(() => http.post(finishBiometricSessionUrl), { isStatusCode200 })
  })
  return biometricSessionId
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
    const accessToken = tokenResponse.json('access_token') as string
    return accessToken
  })
}

export function setupVendorResponse(biometricSessionId: string) {
  const requestBodyFromEnv = JSON.parse(config.requestBody)

  group('POST /v2/setupVendorResponse/', () => {
    const url = `${config.dcaMockReadIdUrl}/v2/setupVendorResponse`
    const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
    // Create a SignatureV4 signer for API Gateway
    const apiGatewaySigner = new SignatureV4({
      service: 'execute-api',
      region: getEnv('AWS_REGION'),
      credentials: {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken
      },
      uriEscapePath: false,
      applyChecksum: false
    })

    // Create a new request body with the updated opaqueId
    const updatedRequestBody = { ...requestBodyFromEnv, opaqueId: biometricSessionId }

    // Create a new request body with the Updated creation date
    updatedRequestBody.creationDate = new Date().toISOString()
    updatedRequestBody.consolidatedIdentityData.creationDate = updatedRequestBody.creationDate

    // Sign the request
    const signedRequest = apiGatewaySigner.sign({
      method: 'POST',
      protocol: 'https',
      hostname: new URL(url).hostname,
      path: `/v2/setupVendorResponse/${biometricSessionId}`,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedRequestBody)
    })

    timeRequest(
      () => {
        const res = http.post(signedRequest.url, JSON.stringify(updatedRequestBody), { headers: signedRequest.headers })
        return res
      },
      { isStatusCode201 }
    )
  })
}

export function getAppInfo(): void {
  group('GET /appInfo', () => {
    const getAppInfoUrl = buildBackendUrl('appInfo', {})

    timeRequest(() => http.get(getAppInfoUrl), { isStatusCode200 })
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
