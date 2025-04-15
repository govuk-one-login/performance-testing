import {
  createScenario,
  describeProfile,
  LoadProfile,
  ProfileList,
  selectProfile
} from '../../common/utils/config/load-profiles'
import { Options } from 'k6/options'
import { getThresholds } from '../../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../../common/utils/custom_metric/counter'
import { timeGroup } from '../../common/utils/request/timing'
import { isStatusCode200, isStatusCode302 } from '../../common/utils/checks/assertions'
import http, { type Response } from 'k6/http'
import { URL } from '../../common/utils/jslib/url'
import { createHash } from 'k6/crypto'
import { b64encode } from 'k6/encoding'
import { algParamMap, JwtAlgorithm } from '../../common/utils/authentication/jwt'
import { getEnv } from '../../common/utils/config/environment-variables'
import { SignatureV4 } from '../../common/utils/jslib/aws-signature'
import { AssumeRoleOutput } from '../../common/utils/aws/types'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('getIdCheckAccessToken', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  getIdCheckAccessToken: [
    'GET /authorize (STS)',
    'GET /.well-known/jwks.json',
    'GET /authorize (Orchestration)',
    'GET /redirect',
    'POST /generate-client-attestation',
    'POST /token (authorization code exchange)',
    'GET /.well-known/jwks.json'
  ]
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
  describeProfile(loadProfile)
}

export async function getIdCheckAccessToken(): Promise<void> {
  iterationsStarted.add(1)
  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  const orchestrationAuthorizeUrl = getAuthorize()
  simulateOrchestrationCallToStsJwks()
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(orchestrationAuthorizeUrl)
  const stsAuthorizationCode = getRedirect(state, orchestrationAuthorizationCode)
  const clientAttestation = postGenerateClientAttestation(publicKeyJwk)
  const accessToken = await exchangeAuthorizationCode(stsAuthorizationCode, codeVerifier, clientAttestation, keyPair)
  simulateAppCallToStsJwks()
  iterationsCompleted.add(1)
}

// const stsBaseUrl = 'https://token.dev.account.gov.uk'
const stsBaseUrl = 'https://backend-api-jl.token.dev.account.gov.uk'
const stsMockClientBaseUrl = 'https://test-resources-jl-mock-client.token.dev.account.gov.uk'
// const stsMockClientBaseUrl = 'https://mock-client.token.dev.account.gov.uk'
const redirectUri = 'https://mobile.dev.account.gov.uk/redirect'
// const orchestrationBaseUrl = 'https://auth-stub.mobile.dev.account.gov.uk'
const orchestrationBaseUrl = 'https://auth-stub-jl.mobile.dev.account.gov.uk'
const codeVerifier = crypto.randomUUID()
const codeChallenge = generateCodeChallenge(codeVerifier)
const clientId = 'bCAOfDdDSwO4ug2ZNNU1EZrlGrg'

function generateCodeChallenge(codeVerifier: string): string {
  const hasher = createHash('sha256')
  hasher.update(codeVerifier)
  return hasher.digest('base64rawurl')
}

async function generateKey() {
  return await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

function strToBuf(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length)
  const bufView = new Uint8Array(buf)
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}

async function signJwt(
  type: JwtAlgorithm,
  key: CryptoKey,
  payload: object,
  additionalHeaderParameters: object
): Promise<string> {
  const encodedHeader = b64encode(JSON.stringify({ alg: type, typ: 'JWT', ...additionalHeaderParameters }), 'rawurl')
  const encodedPayload = b64encode(JSON.stringify(payload), 'rawurl')
  const buf = strToBuf(`${encodedHeader}.${encodedPayload}`)
  const sigBuf = await crypto.subtle.sign(algParamMap[type], key, buf)
  const signature = b64encode(sigBuf, 'rawurl')
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

async function createJwt(key: CryptoKey, payload: object, additionalHeaderParameters: object): Promise<string> {
  return signJwt('ES256', key, payload, additionalHeaderParameters)
}

// steps
export function getAuthorize(): string {
  const url = new URL('authorize', stsBaseUrl)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', 'STATE')
  url.searchParams.set('nonce', 'NONCE')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid')
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  const authorizeRequestUrl = url.toString()
  const res = timeGroup(
    groupMap.getIdCheckAccessToken[0],
    () => {
      return http.get(authorizeRequestUrl, { redirects: 0 })
    },
    {
      isStatusCode302,
      validateOrchestrationRedirect
    }
  )
  return res.headers.Location
}

function simulateOrchestrationCallToStsJwks(): void {
  timeGroup(
    groupMap.getIdCheckAccessToken[1],
    () => {
      return http.get(`${stsBaseUrl}/.well-known/jwks.json`)
    },
    {
      isStatusCode200
    }
  )
}

function getCodeFromOrchestration(orchestrationAuthorizeUrl: string): {
  state: string
  orchestrationAuthorizationCode: string
} {
  const res = timeGroup(groupMap.getIdCheckAccessToken[2], () =>
    http.get(orchestrationAuthorizeUrl, {
      headers: { 'x-headless-mode-enabled': 'true' }
    })
  )
  // Question - how to handle responses from mocks where it might be inefficient to add checks
  return {
    state: res.json('state') as string,
    orchestrationAuthorizationCode: res.json('code') as string
  }
}

export function getRedirect(state: string, orchestrationAuthorizationCode: string): string {
  const url = new URL('redirect', stsBaseUrl)
  url.searchParams.set('code', orchestrationAuthorizationCode)
  url.searchParams.set('state', state)
  const redirectRequestUrl = url.toString()
  const res = timeGroup(
    groupMap.getIdCheckAccessToken[3],
    () => {
      return http.get(redirectRequestUrl, { redirects: 0 })
    },
    {
      isStatusCode302,
      validateAuthorizationResponse
    }
  )
  return new URL(res.headers.Location).searchParams.get('code')!
}

export function postGenerateClientAttestation(publicKeyJwk: JsonWebKey): string {
  const requestBody = {
    jwk: {
      kty: publicKeyJwk.kty,
      use: 'sig',
      crv: publicKeyJwk.crv,
      x: publicKeyJwk.x,
      y: publicKeyJwk.y
    }
  }

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
  const signedRequest = apiGatewaySigner.sign({
    method: 'POST',
    protocol: 'https',
    hostname: stsMockClientBaseUrl.split('https://')[1],
    path: '/generate-client-attestation',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  const res = timeGroup(
    groupMap.getIdCheckAccessToken[4],
    () => {
      return http.post(signedRequest.url, JSON.stringify(requestBody), { headers: signedRequest.headers })
    },
    {
      isStatusCode200,
      validateGenerateClientAttestationResponse
    }
  )
  return res.json('client_attestation') as string
}

export async function exchangeAuthorizationCode(
  authorizationCode: string,
  codeVerifier: string,
  clientAttestation: string,
  keypair: CryptoKeyPair
): Promise<string> {
  const nowInSeconds = Math.floor(Date.now() / 1000)
  const proofOfPossession = await createJwt(
    keypair.privateKey,
    {
      iss: clientId,
      aud: stsBaseUrl,
      exp: nowInSeconds + 180,
      jti: crypto.randomUUID()
    },
    { typ: 'oauth-client-attestation-pop+jwt' }
  )

  const res = timeGroup(
    groupMap.getIdCheckAccessToken[5],
    () => {
      return http.post(
        `${stsBaseUrl}/token`,
        {
          grant_type: 'authorization_code',
          code: authorizationCode,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'OAuth-Client-Attestation': clientAttestation,
            'OAuth-Client-Attestation-PoP': proofOfPossession
          }
        }
      )
    },
    {
      isStatusCode200,
      validateAccessTokenResponse
    }
  )
  return res.json('access_token') as string
}

function simulateAppCallToStsJwks(): void {
  timeGroup(
    groupMap.getIdCheckAccessToken[6],
    () => {
      return http.get(`${stsBaseUrl}/.well-known/jwks.json`)
    },
    {
      isStatusCode200
    }
  )
}

// assertions - move these later
export function validateOrchestrationRedirect(res: Response): boolean {
  const url = new URL(res.headers.Location)
  if (url.origin !== orchestrationBaseUrl) return false
  if (url.pathname !== '/authorize') return false
  const queryParams = url.searchParams
  const requiredQueryParams = ['client_id', 'scope', 'response_type', 'request']
  if (requiredQueryParams.some(paramName => !queryParams.has(paramName))) return false
  return true
}

export function validateAuthorizationResponse(res: Response): boolean {
  const url = new URL(res.headers.Location)
  if (`${url.origin}${url.pathname}` !== redirectUri) return false
  const queryParams = url.searchParams
  const requiredQueryParams = ['code', 'state']
  if (requiredQueryParams.some(paramName => !queryParams.has(paramName))) return false
  if (queryParams.get('state') !== 'STATE') return false
  return true
}

export function validateGenerateClientAttestationResponse(res: Response): boolean {
  return res.json('client_attestation') !== undefined
}

export function validateAccessTokenResponse(res: Response): boolean {
  return res.json('access_token') !== undefined && res.json('id_token') !== undefined
}
