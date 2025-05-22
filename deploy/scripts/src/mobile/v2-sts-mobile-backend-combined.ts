import {
  createScenario,
  describeProfile,
  LoadProfile,
  ProfileList,
  selectProfile
} from '../common/utils/config/load-profiles'
import { Options } from 'k6/options'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
// import { SharedArray } from 'k6/data'
import { getJourney } from './utils/journey'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('getServiceAccessToken', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)
export const groupMap = {
  authentication: [
    'AUTHENTICATION_01 GET /authorize (STS)',
    'AUTHENTICATION_02 GET /.well-known/jwks.json (STS)',
    'AUTHENTICATION_03 GET /authorize (Orchestration)',
    'AUTHENTICATION_04 GET /redirect',
    'AUTHENTICATION_05 GET /.well-known/jwks.json (STS)',
    'AUTHENTICATION_06 GET /app-check-token',
    'AUTHENTICATION_07 POST /client-attestation',
    'AUTHENTICATION_08 POST /token (authorization code exchange)',
    'AUTHENTICATION_09 POST /token (access token exchange)',
    'AUTHENTICATION_10 GET /.well-known/jwks.json (STS)'
  ],
  reauthentication: [
    'REAUTHENTICATION_01 GET /authorize (STS)',
    'REAUTHENTICATION_02 GET /.well-known/jwks.json (STS)',
    'REAUTHENTICATION_03 GET /authorize (Orchestration)',
    'REAUTHENTICATION_04 GET /redirect',
    'REAUTHENTICATION_05 GET /.well-known/jwks.json (STS)',
    'REAUTHENTICATION_06 GET /app-check-token',
    'REAUTHENTICATION_07 POST /client-attestation',
    'REAUTHENTICATION_08 POST /token (authorization code exchange)',
    'REAUTHENTICATION_09 POST /token (access token exchange)',
    'REAUTHENTICATION_10 GET /.well-known/jwks.json (STS)'
  ],
  walletCredentialIssuance: [
    'WALLET_CREDENTIAL_ISSUANCE_01 GET /authorize (STS)',
    'WALLET_CREDENTIAL_ISSUANCE_02 GET /.well-known/jwks.json (STS)',
    'WALLET_CREDENTIAL_ISSUANCE_03 GET /authorize (Orchestration)',
    'WALLET_CREDENTIAL_ISSUANCE_04 GET /redirect',
    'WALLET_CREDENTIAL_ISSUANCE_05 GET /.well-known/jwks.json (STS)',
    'WALLET_CREDENTIAL_ISSUANCE_06 GET /app-check-token',
    'WALLET_CREDENTIAL_ISSUANCE_07 POST /client-attestation',
    'WALLET_CREDENTIAL_ISSUANCE_08 POST /token (authorization code exchange)',
    'WALLET_CREDENTIAL_ISSUANCE_09 POST /token (access token exchange)',
    'WALLET_CREDENTIAL_ISSUANCE_10 GET /.well-known/jwks.json (STS)',
    'WALLET_CREDENTIAL_ISSUANCE_11 GET /generate-pre-auth-code',
    'WALLET_CREDENTIAL_ISSUANCE_12 POST /token (access token exchange)',
    'WALLET_CREDENTIAL_ISSUANCE_13 POST /token (access token exchange)',
    'WALLET_CREDENTIAL_ISSUANCE_14 POST /txma-event',
    'WALLET_CREDENTIAL_ISSUANCE_15 POST /token (pre-authorized code exchange)',
    'WALLET_CREDENTIAL_ISSUANCE_16 GET /.well-known/jwks.json (STS)',
    'WALLET_CREDENTIAL_ISSUANCE_17 POST /txma-event',
    'WALLET_CREDENTIAL_ISSUANCE_18 POST /txma-event'
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

// interface SessionContext {
//   persistentSessionId: string
//   privateKeyJwk: JsonWebKey
//   publicKeyJwk: JsonWebKey
// }
//
// const sessionContextData: SessionContext[] = new SharedArray('sessionContext', () => {
//   const lines = open('./data/v2-sts-mobile-backend-combined-data.txt').split('\n')
//   return lines.slice(3, -1).map(s => {
//     const [, sessionContext] = s.split(' ')
//     return JSON.parse(sessionContext)
//   })
// })

export async function combined(): Promise<void> {
  // const keyPair = await generateKey()
  // const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  iterationsStarted.add(1)
  const journey = getJourney()
  switch (journey) {
    case 'AUTHENTICATION':
      break
    case 'REAUTHENTICATION':
      break
    case 'WALLET_CREDENTIAL_ISSUANCE':
      break
  }
  iterationsCompleted.add(1)
}

export async function authenticationJourney(): Promise<void> {
  // const keyPair = await generateKey()
  // const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  //
  // const codeVerifier = crypto.randomUUID()
  // const codeChallenge = await generateCodeChallenge(codeVerifier)
  //
  // const orchestrationAuthorizeUrl = getAuthorize(codeChallenge)
  // simulateCallToStsJwks(groupMap.getServiceAccessToken[1])
  // sleepBetween(1, 2)
  // const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(orchestrationAuthorizeUrl)
  // const stsAuthorizationCode = getRedirect(state, orchestrationAuthorizationCode)
  // simulateCallToStsJwks(groupMap.getServiceAccessToken[4])
  // const clientAttestation = postGenerateClientAttestation(publicKeyJwk)
  // const { accessToken } = await exchangeAuthorizationCode(
  //   stsAuthorizationCode,
  //   codeVerifier,
  //   clientAttestation,
  //   keyPair.privateKey
  // )
  // simulateCallToStsJwks(groupMap.getServiceAccessToken[7])
  // exchangeAccessToken(accessToken, 'sts-test.hello-world.read')
  // simulateCallToStsJwks(groupMap.getServiceAccessToken[9])
}

export async function reauthenticationJourney(): Promise<void> {
  // const sessionContext = sessionContextData[__VU - 1]
  // const privateKey = await crypto.subtle.importKey(
  //   'jwk',
  //   sessionContext.privateKeyJwk,
  //   {
  //     name: 'ECDSA',
  //     namedCurve: 'P-256'
  //   },
  //   false,
  //   ['sign']
  // )
  //
  // const codeVerifier = crypto.randomUUID()
  // const codeChallenge = await generateCodeChallenge(codeVerifier)
  //
  // const orchestrationAuthorizeUrl = getAuthorize(codeChallenge, sessionContext.persistentSessionId)
  // simulateCallToStsJwks(groupMap.getServiceAccessToken[1])
  // sleepBetween(1, 2)
  // const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(orchestrationAuthorizeUrl)
  // const stsAuthorizationCode = getRedirect(state, orchestrationAuthorizationCode)
  // simulateCallToStsJwks(groupMap.getServiceAccessToken[4])
  // const clientAttestation = postGenerateClientAttestation(sessionContext.publicKeyJwk)
  // const { accessToken } = await exchangeAuthorizationCode(
  //   stsAuthorizationCode,
  //   codeVerifier,
  //   clientAttestation,
  //   privateKey
  // )
  // simulateCallToStsJwks(groupMap.getServiceAccessToken[7])
  // exchangeAccessToken(accessToken, 'sts-test.hello-world.read')
  // simulateCallToStsJwks(groupMap.getServiceAccessToken[9])
}

export async function walletCredentialIssuanceJourney(): Promise<void> {
  // const keyPair = await generateKey()
  // const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  //
  // const codeVerifier = crypto.randomUUID()
  // const codeChallenge = await generateCodeChallenge(codeVerifier)
  //
  // const orchestrationAuthorizeUrl = getAuthorize(codeChallenge)
  // simulateCallToStsJwks(groupMap.getServiceAccessToken[1])
  // sleepBetween(1, 2)
  // const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(orchestrationAuthorizeUrl)
  // const stsAuthorizationCode = getRedirect(state, orchestrationAuthorizationCode)
  // simulateCallToStsJwks(groupMap.getServiceAccessToken[4])
  // const clientAttestation = postGenerateClientAttestation(publicKeyJwk)
  // const { accessToken } = await exchangeAuthorizationCode(
  //   stsAuthorizationCode,
  //   codeVerifier,
  //   clientAttestation,
  //   keyPair.privateKey
  // )
  // simulateCallToStsJwks(groupMap.getServiceAccessToken[7])
  // exchangeAccessToken(accessToken, 'sts-test.hello-world.read')
  // simulateCallToStsJwks(groupMap.getServiceAccessToken[9])
}
