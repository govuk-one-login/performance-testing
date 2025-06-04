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
import { SharedArray } from 'k6/data'
import { bufToString, generateCodeChallenge, generateKey } from './utils/crypto'
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
import exec from 'k6/execution'
import { b64decode } from 'k6/encoding'
import { getEnv } from '../common/utils/config/environment-variables'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('authentication', LoadProfile.smoke),
    ...createScenario('reauthentication', LoadProfile.smoke),
    ...createScenario('walletCredentialIssuance', LoadProfile.smoke),
    ...createScenario('generateReauthenticationTestData', LoadProfile.smoke)
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
        { target: 38, duration: '60m' }
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
  reauthentication: [
    'REAUTHENTICATION_01 GET /authorize (STS)',
    'REAUTHENTICATION_02 GET /.well-known/jwks.json (STS)',
    'REAUTHENTICATION_03 GET /authorize (Orchestration)',
    'REAUTHENTICATION_04 GET /redirect',
    'REAUTHENTICATION_05 GET /.well-known/jwks.json (STS)',
    'REAUTHENTICATION_06 POST /generate-client-attestation',
    'REAUTHENTICATION_07 POST /token (authorization code exchange)',
    'REAUTHENTICATION_08 POST /token (access token exchange)',
    'REAUTHENTICATION_09 GET /.well-known/jwks.json (STS)'
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
  ],
  generateReauthenticationTestData: [
    '01 GET /authorize (STS)',
    '02 GET /authorize (Orchestration)',
    '03 GET /redirect',
    '04 POST /generate-client-attestation',
    '05 POST /token (authorization code exchange)'
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

interface ReauthenticationContext {
  persistentSessionId: string
}

const reauthenticationContextData: ReauthenticationContext[] = new SharedArray('reauthenticationContext', () => {
  const reauthenticationDataFile = `./data/sts-reauthentication-test-data-${getEnv('ENVIRONMENT')}.json`
  try {
    const reauthenticationContextData = open(reauthenticationDataFile)
    return JSON.parse(reauthenticationContextData)
  } catch (err: unknown) {
    console.warn(
      `Failed to open file with reauthentication data at ${reauthenticationDataFile}. Attempts to run reauthentication scenario may fail. Error: ${err}`
    )
    return []
  }
})

export async function authentication(): Promise<void> {
  const group = groupMap.authentication

  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const codeVerifier = crypto.randomUUID()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  iterationsStarted.add(1)
  const orchestrationAuthorizeUrl = getAuthorize(group[0], config.mockClientId, config.redirectUri, codeChallenge)
  simulateCallToStsJwks(group[1])
  sleepBetween(1, 2)
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(group[2], orchestrationAuthorizeUrl)
  const stsAuthorizationCode = getRedirect(group[3], state, orchestrationAuthorizationCode, config.redirectUri)
  simulateCallToStsJwks(group[4])
  const clientAttestation = postGenerateClientAttestation(group[5], publicKeyJwk)
  const { accessToken } = await exchangeAuthorizationCode(
    group[6],
    stsAuthorizationCode,
    codeVerifier,
    config.mockClientId,
    config.redirectUri,
    clientAttestation,
    keyPair.privateKey
  )
  exchangeAccessToken(group[7], accessToken, 'sts-test.hello-world.read')
  simulateCallToStsJwks(group[8])
  iterationsCompleted.add(1)
}

export async function reauthentication(): Promise<void> {
  const group = groupMap.reauthentication

  const reauthenticationContext = reauthenticationContextData[exec.scenario.iterationInTest]

  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const codeVerifier = crypto.randomUUID()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  iterationsStarted.add(1)
  const orchestrationAuthorizeUrl = getAuthorize(
    group[0],
    config.mockClientId,
    config.redirectUri,
    codeChallenge,
    reauthenticationContext.persistentSessionId
  )
  simulateCallToStsJwks(group[1])
  sleepBetween(1, 2)
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(group[2], orchestrationAuthorizeUrl)
  const stsAuthorizationCode = getRedirect(group[3], state, orchestrationAuthorizationCode, config.redirectUri)
  simulateCallToStsJwks(group[4])
  const clientAttestation = postGenerateClientAttestation(group[5], publicKeyJwk)
  const { accessToken } = await exchangeAuthorizationCode(
    group[6],
    stsAuthorizationCode,
    codeVerifier,
    config.mockClientId,
    config.redirectUri,
    clientAttestation,
    keyPair.privateKey
  )
  exchangeAccessToken(group[7], accessToken, 'sts-test.hello-world.read')
  simulateCallToStsJwks(group[8])
  iterationsCompleted.add(1)
}

export async function walletCredentialIssuance(): Promise<void> {
  const group = groupMap.walletCredentialIssuance

  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const codeVerifier = crypto.randomUUID()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  iterationsStarted.add(1)
  const orchestrationAuthorizeUrl = getAuthorize(group[0], config.mockClientId, config.redirectUri, codeChallenge)
  simulateCallToStsJwks(group[1])
  sleepBetween(1, 2)
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(group[2], orchestrationAuthorizeUrl)
  const stsAuthorizationCode = getRedirect(group[3], state, orchestrationAuthorizationCode, config.redirectUri)
  simulateCallToStsJwks(group[4])
  const clientAttestation = postGenerateClientAttestation(group[5], publicKeyJwk)
  const { accessToken } = await exchangeAuthorizationCode(
    group[6],
    stsAuthorizationCode,
    codeVerifier,
    config.mockClientId,
    config.redirectUri,
    clientAttestation,
    keyPair.privateKey
  )
  exchangeAccessToken(group[7], accessToken, 'sts-test.hello-world.read')
  simulateCallToStsJwks(group[8])
  const preAuthorizedCode = getPreAuthorizedCode(group[9])
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

export async function generateReauthenticationTestData(): Promise<void> {
  const group = groupMap.generateReauthenticationTestData

  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const codeVerifier = crypto.randomUUID()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  const orchestrationAuthorizeUrl = getAuthorize(group[0], config.mockClientId, config.redirectUri, codeChallenge)
  sleepBetween(1, 2)
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(group[1], orchestrationAuthorizeUrl)
  const stsAuthorizationCode = getRedirect(group[2], state, orchestrationAuthorizationCode, config.redirectUri)
  const clientAttestation = postGenerateClientAttestation(group[3], publicKeyJwk)
  const { idToken } = await exchangeAuthorizationCode(
    group[4],
    stsAuthorizationCode,
    codeVerifier,
    config.mockClientId,
    config.redirectUri,
    clientAttestation,
    keyPair.privateKey
  )

  const idTokenPayload = idToken.split('.')[1]
  const decodedIdTokenPayload = JSON.parse(bufToString(b64decode(idTokenPayload, 'rawurl')))
  const persistentSessionId = decodedIdTokenPayload.persistent_id
  const reauthenticationContext: ReauthenticationContext = {
    persistentSessionId
  }

  console.log(reauthenticationContext)
}
