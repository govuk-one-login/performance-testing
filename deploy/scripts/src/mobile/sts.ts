import {
  createI4PeakTestSignUpScenario,
  createScenario,
  describeProfile,
  LoadProfile,
  ProfileList,
  selectProfile
} from '../common/utils/config/load-profiles'
import { Options } from 'k6/options'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
import { generateCodeChallenge, generateKey } from './utils/crypto'
import {
  exchangeAccessToken,
  exchangeAuthorizationCode,
  exchangePreAuthorizedCode,
  getAuthorize,
  getCodeFromOrchestration,
  getRedirect,
  simulateCallToStsJwks
} from './sts/testSteps/backend'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { postGenerateClientAttestation } from './sts/utils/mockClient'
import { config } from './sts/utils/config'
import { getPreAuthorizedCode } from './sts/utils/mockIssuer'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('authentication', LoadProfile.smoke),
    ...createScenario('walletCredentialIssuance', LoadProfile.smoke)
  },
  perf006Iteration3PeakTest: {
    authentication: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 528,
      stages: [
        { target: 150, duration: '151s' },
        { target: 150, duration: '30m' }
      ],
      exec: 'authentication'
    }
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('authentication', 450, 30, 451)
  },
  walletPerfTestSTS: {
    authentication: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 240,
      maxVUs: 480,
      stages: [
        { target: 16, duration: '8s' },
        { target: 16, duration: '60m' }
      ],
      exec: 'authentication'
    },
    walletCredentialIssuance: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 741,
      maxVUs: 1428,
      stages: [
        { target: 38, duration: '18s' },
        { target: 38, duration: '55m' }
      ],
      exec: 'walletCredentialIssuance'
    }
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
    'AUTHENTICATION_06 POST /generate-client-attestation',
    'AUTHENTICATION_07 POST /token (authorization code exchange)',
    'AUTHENTICATION_08 POST /token (access token exchange)',
    'AUTHENTICATION_09 GET /.well-known/jwks.json (STS)'
  ],
  walletCredentialIssuance: [
    'WALLET_CREDENTIAL_ISSUANCE_01 GET /authorize (STS)',
    'WALLET_CREDENTIAL_ISSUANCE_02 GET /.well-known/jwks.json (STS)',
    'WALLET_CREDENTIAL_ISSUANCE_03 GET /authorize (Orchestration)',
    'WALLET_CREDENTIAL_ISSUANCE_04 GET /redirect',
    'WALLET_CREDENTIAL_ISSUANCE_05 GET /.well-known/jwks.json (STS)',
    'WALLET_CREDENTIAL_ISSUANCE_06 POST /generate-client-attestation',
    'WALLET_CREDENTIAL_ISSUANCE_07 POST /token (authorization code exchange)',
    'WALLET_CREDENTIAL_ISSUANCE_08 POST /token (access token exchange)',
    'WALLET_CREDENTIAL_ISSUANCE_09 GET /.well-known/jwks.json (STS)',
    'WALLET_CREDENTIAL_ISSUANCE_10 GET /generate-pre-auth-code',
    'WALLET_CREDENTIAL_ISSUANCE_11 POST /token (access token exchange)',
    'WALLET_CREDENTIAL_ISSUANCE_12 POST /token (pre-authorized code exchange)',
    'WALLET_CREDENTIAL_ISSUANCE_13 GET /.well-known/jwks.json (STS)'
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

export async function authentication(): Promise<void> {
  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const codeVerifier = crypto.randomUUID()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  iterationsStarted.add(1)
  const orchestrationAuthorizeUrl = getAuthorize(
    groupMap.authentication[0],
    config.mockClientId,
    config.redirectUri,
    codeChallenge
  )
  simulateCallToStsJwks(groupMap.authentication[1])
  sleepBetween(1, 2)
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(
    groupMap.authentication[2],
    orchestrationAuthorizeUrl
  )
  const stsAuthorizationCode = getRedirect(
    groupMap.authentication[3],
    state,
    orchestrationAuthorizationCode,
    config.redirectUri
  )
  simulateCallToStsJwks(groupMap.authentication[4])
  const clientAttestation = postGenerateClientAttestation(groupMap.authentication[5], publicKeyJwk)
  const { accessToken } = await exchangeAuthorizationCode(
    groupMap.authentication[6],
    stsAuthorizationCode,
    codeVerifier,
    config.mockClientId,
    config.redirectUri,
    clientAttestation,
    keyPair.privateKey
  )
  exchangeAccessToken(groupMap.authentication[7], accessToken, 'sts-test.hello-world.read')
  simulateCallToStsJwks(groupMap.authentication[8])
  iterationsCompleted.add(1)
}

export async function walletCredentialIssuance(): Promise<void> {
  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const codeVerifier = crypto.randomUUID()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  iterationsStarted.add(1)
  const orchestrationAuthorizeUrl = getAuthorize(
    groupMap.walletCredentialIssuance[0],
    config.mockClientId,
    config.redirectUri,
    codeChallenge
  )
  simulateCallToStsJwks(groupMap.walletCredentialIssuance[1])
  sleepBetween(1, 2)
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(
    groupMap.walletCredentialIssuance[2],
    orchestrationAuthorizeUrl
  )
  const stsAuthorizationCode = getRedirect(
    groupMap.walletCredentialIssuance[3],
    state,
    orchestrationAuthorizationCode,
    config.redirectUri
  )
  simulateCallToStsJwks(groupMap.walletCredentialIssuance[4])
  const clientAttestation = postGenerateClientAttestation(groupMap.walletCredentialIssuance[5], publicKeyJwk)
  const { accessToken } = await exchangeAuthorizationCode(
    groupMap.walletCredentialIssuance[6],
    stsAuthorizationCode,
    codeVerifier,
    config.mockClientId,
    config.redirectUri,
    clientAttestation,
    keyPair.privateKey
  )
  exchangeAccessToken(groupMap.walletCredentialIssuance[7], accessToken, 'sts-test.hello-world.read')
  simulateCallToStsJwks(groupMap.walletCredentialIssuance[8])
  const preAuthorizedCode = getPreAuthorizedCode(groupMap.walletCredentialIssuance[9])
  const preAuthorizedCodeExchangeServiceToken = exchangeAccessToken(
    groupMap.walletCredentialIssuance[10],
    accessToken,
    'sts.wallet.pre-auth-code'
  )
  exchangePreAuthorizedCode(
    groupMap.walletCredentialIssuance[11],
    preAuthorizedCode,
    preAuthorizedCodeExchangeServiceToken
  )
  simulateCallToStsJwks(groupMap.walletCredentialIssuance[12])
  iterationsCompleted.add(1)
}
