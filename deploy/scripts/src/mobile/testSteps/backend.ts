import http from 'k6/http'
import { group } from 'k6'
import { uuidv4 } from '../../common/utils/jslib/index'
import { buildBackendUrl } from '../utils/url'
import { parseTestClientResponse, postTestClientStart } from '../utils/test-client'
import { timeRequest } from '../../common/utils/request/timing'
import { isStatusCode200, isStatusCode201 } from '../../common/utils/checks/assertions'
import { getEnv } from '../../common/utils/config/environment-variables'
import { SignatureV4 } from '../../common/utils/jslib/aws-signature'

// Load AWS credentials and region from environment variables

const accessKeyId = getEnv('AWS_ACCESS_KEY_ID')
const secretAccessKey = getEnv('AWS_SECRET_ACCESS_KEY')
const region = getEnv('AWS_REGION')

// ENV object for parameter values
const ENV = {
  dcaMockReadIdUrl: getEnv('MOBILE_BUILD_DCAMOCK_READID_URL'),
  bodySignV4: getEnv('MOBILE_BUILD_BODY_SIGNV4')
}

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

    const res = http.post(txmaEventURL, JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' }
    })
    timeRequest(() => res, { isStatusCode200 })
  })
}

export function postFinishBiometricSession(sessionId: string): string {
  const biometricSessionId = uuidv4()
  group('POST /finishBiometricSession', () => {
    // Log the generated biometricSessionId
    console.log(`Generated Biometric Session ID: ${biometricSessionId}`)

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
    // Add console.log statements here
    console.log(`>>>>Token POST /token response status: ${tokenResponse.status}`)
    console.log(`>>>>Token POST /token response body: ${tokenResponse.body}`)
    //return tokenResponse.json('access_token') as string
    const accessToken = tokenResponse.json('access_token') as string // Capture access_token
    console.log(`Access Token: ${accessToken}`) // Log the access token

    return accessToken // Return the access token
  })
}

export function postUserInfoV2(biometricSessionId: string) {
  // Log the retrieved biometricSessionId inside the postUserInfoV2 function

  console.log(`>>>>>>>Biometric session id in PostUserInfoV2: ${biometricSessionId}`) //

  //Get the request body from the environment variable
  const requestBodyFromEnv = JSON.parse(ENV.bodySignV4)

  group('POST /userinfo/v2', () => {
    const url = `${ENV.dcaMockReadIdUrl}/v2/setupVendorResponse`
    console.log(`Request URL: ${url}`) //

    // Create a SignatureV4 signer for API Gateway
    const apiGatewaySigner = new SignatureV4({
      service: 'execute-api',
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
        sessionToken: '' // If using temporary credentials
      },
      uriEscapePath: false,
      applyChecksum: false
    })

    // Create a new request body object with the updated opaqueId
    const updatedRequestBody = { ...requestBodyFromEnv, opaqueId: biometricSessionId }

    // Update creation date
    updatedRequestBody.creationDate = new Date().toISOString()
    updatedRequestBody.consolidatedIdentityData.creationDate = updatedRequestBody.creationDate
    console.log(`Updated Request Body for /userinfo/v2: ${JSON.stringify(updatedRequestBody, null, 2)}`)

    // Sign the request
    const signedRequest = apiGatewaySigner.sign({
      method: 'POST',
      protocol: 'https',
      hostname: new URL(url).hostname,
      path: `/v2/setupVendorResponse/${biometricSessionId}`,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedRequestBody) // Use the updated request body for signing
    })

    // Log the signed request details
    console.log(`Signed Request URL: ${signedRequest.url}`)
    console.log(`Signed Request Headers: ${JSON.stringify(signedRequest.headers, null, 2)}`)
    // Note: It's generally not recommended to log the signed request body directly
    // as it might contain sensitive information. If you need to inspect it,
    // consider logging specific parts or using a debugging tool.

    timeRequest(
      () => {
        const res = http.post(signedRequest.url, JSON.stringify(updatedRequestBody), { headers: signedRequest.headers })
        //const res = http.post(signedRequest.url, signedRequest.body, { headers: signedRequest.headers })
        console.log(`Response status: ${res.status}`)
        console.log(`Response body: ${res.body}`)
        console.log(`url: ${res.url}`)
        
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
