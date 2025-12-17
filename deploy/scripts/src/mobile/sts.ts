import {
  createI3SpikeSignUpScenario,
  createI4PeakTestSignUpScenario,
  createI4PeakTestSignInScenario,
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
import { bufToString, generateCodeChallenge, generateKey, getPublicKeyJwkForPrivateKey } from './utils/crypto'
import {
  exchangeAccessToken,
  exchangeAuthorizationCode,
  exchangePreAuthorizedCode,
  getAuthorize,
  getCodeFromOrchestration,
  getRedirect,
  refreshAccessToken,
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
    ...createScenario('exchangeRefreshToken', LoadProfile.smoke),
    ...createScenario('generateReauthenticationTestData', LoadProfile.smoke),
    ...createScenario('generateRefreshTokenTestData', LoadProfile.smoke)
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
      preAllocatedVUs: 216,
      maxVUs: 432,
      stages: [
        { target: 16, duration: '8s' },
        { target: 16, duration: '55m' }
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
    },
    reauthentication: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 108,
      maxVUs: 216,
      stages: [
        { target: 8, duration: '5s' },
        { target: 8, duration: '55m' }
      ],
      exec: 'reauthentication'
    }
  },
  dataCreationForReAuthentication: {
    generateReauthenticationTestData: {
      executor: 'per-vu-iterations',
      vus: 250,
      iterations: 300,
      maxDuration: '120m',
      exec: 'generateReauthenticationTestData'
    }
  },
  reauthenticationPerfTest: {
    reauthentication: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 216,
      maxVUs: 432,
      stages: [
        { target: 16, duration: '9s' },
        { target: 16, duration: '55m' }
      ],
      exec: 'reauthentication'
    }
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignUpScenario('authentication', 540, 30, 541)
  },
  perf006Iteration5SpikeTest: {
    ...createI3SpikeSignUpScenario('authentication', 1074, 30, 1075)
  },
  perf006Iteration6PeakTest: {
    ...createI4PeakTestSignUpScenario('authentication', 190, 27, 191),
    ...createI4PeakTestSignInScenario('reauthentication', 16, 27, 8),
    ...createI4PeakTestSignInScenario('walletCredentialIssuance', 38, 39, 18)
  }
}

const loadProfile = selectProfile(profiles)
export const groupMap = {
  authentication: [
    'B01_AUTHENTICATION_01 GET /authorize (STS)',
    'B01_AUTHENTICATION_02 GET /.well-known/jwks.json (STS)',
    'B01_AUTHENTICATION_03 GET /authorize (Orchestration)',
    'B01_AUTHENTICATION_04 GET /redirect',
    'B01_AUTHENTICATION_05 GET /.well-known/jwks.json (STS)',
    'B01_AUTHENTICATION_06 POST /generate-client-attestation',
    'B01_AUTHENTICATION_07 POST /token (authorization code exchange)',
    'B01_AUTHENTICATION_08 POST /token (access token exchange)',
    'B01_AUTHENTICATION_09 GET /.well-known/jwks.json (STS)',
    'B01_EXCHANGE_REFRESH_TOKEN_10 POST /token (refresh token exchange)',
    'B01_EXCHANGE_REFRESH_TOKEN_11 POST /token (access token exchange)',
    'B01_EXCHANGE_REFRESH_TOKEN_12 GET /.well-known/jwks.json (STS)'
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
  exchangeRefreshToken: [
    'EXCHANGE_REFRESH_TOKEN_01 POST /generate-client-attestation',
    'EXCHANGE_REFRESH_TOKEN_02 POST /token (refresh token exchange)',
    'EXCHANGE_REFRESH_TOKEN_03 POST /token (access token exchange)',
    'EXCHANGE_REFRESH_TOKEN_04 GET /.well-known/jwks.json (STS)'
  ],
  generateReauthenticationTestData: [
    '01 GET /authorize (STS)',
    '02 GET /authorize (Orchestration)',
    '03 GET /redirect',
    '04 POST /generate-client-attestation',
    '05 POST /token (authorization code exchange)'
  ],
  generateRefreshTokenTestData: [
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

  const responseOverrides = {
    idToken: {
      subjectId: '7c5c7479-6ebe-490e-a4b0-a6b3c9cb2ec6' // Specific subject ID used to guarantee a refresh token will be returned in test while phased release is ongoing
    }
  }
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(
    groupMap.authentication[2],
    orchestrationAuthorizeUrl,
    responseOverrides
  )
  const stsAuthorizationCode = getRedirect(
    groupMap.authentication[3],
    state,
    orchestrationAuthorizationCode,
    config.redirectUri
  )
  simulateCallToStsJwks(groupMap.authentication[4])
  const clientAttestation = postGenerateClientAttestation(groupMap.authentication[5], publicKeyJwk)
  const { accessToken: accessTokenExchange, refreshToken: refreshTokenExchange } = await exchangeAuthorizationCode(
    groupMap.authentication[6],
    stsAuthorizationCode,
    codeVerifier,
    config.mockClientId,
    config.redirectUri,
    clientAttestation,
    { privateKey: keyPair.privateKey, publicKey: publicKeyJwk }
  )
  exchangeAccessToken(groupMap.authentication[7], accessTokenExchange, 'sts-test.hello-world.read')
  simulateCallToStsJwks(groupMap.authentication[8])

  const { accessToken: accessTokenRefresh } = await refreshAccessToken(
    groupMap.authentication[9],
    refreshTokenExchange,
    config.mockClientId,
    clientAttestation,
    keyPair.privateKey,
    publicKeyJwk
  )
  exchangeAccessToken(groupMap.authentication[10], accessTokenRefresh, 'sts-test.hello-world.read')

  simulateCallToStsJwks(groupMap.authentication[11])

  iterationsCompleted.add(1)
}

export async function reauthentication(): Promise<void> {
  const reauthenticationContext = reauthenticationContextData[exec.scenario.iterationInTest]

  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const codeVerifier = crypto.randomUUID()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  iterationsStarted.add(1)
  const orchestrationAuthorizeUrl = getAuthorize(
    groupMap.reauthentication[0],
    config.mockClientId,
    config.redirectUri,
    codeChallenge,
    reauthenticationContext.persistentSessionId
  )
  simulateCallToStsJwks(groupMap.reauthentication[1])
  sleepBetween(1, 2)
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(
    groupMap.reauthentication[2],
    orchestrationAuthorizeUrl
  )
  const stsAuthorizationCode = getRedirect(
    groupMap.reauthentication[3],
    state,
    orchestrationAuthorizationCode,
    config.redirectUri
  )
  simulateCallToStsJwks(groupMap.reauthentication[4])
  const clientAttestation = postGenerateClientAttestation(groupMap.reauthentication[5], publicKeyJwk)
  const { accessToken } = await exchangeAuthorizationCode(
    groupMap.reauthentication[6],
    stsAuthorizationCode,
    codeVerifier,
    config.mockClientId,
    config.redirectUri,
    clientAttestation,
    { privateKey: keyPair.privateKey, publicKey: publicKeyJwk }
  )
  exchangeAccessToken(groupMap.reauthentication[7], accessToken, 'sts-test.hello-world.read')
  simulateCallToStsJwks(groupMap.reauthentication[8])
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
    { privateKey: keyPair.privateKey, publicKey: publicKeyJwk }
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

export async function generateReauthenticationTestData(): Promise<void> {
  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const codeVerifier = crypto.randomUUID()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  const orchestrationAuthorizeUrl = getAuthorize(
    groupMap.generateReauthenticationTestData[0],
    config.mockClientId,
    config.redirectUri,
    codeChallenge
  )
  sleepBetween(1, 2)
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(
    groupMap.generateReauthenticationTestData[1],
    orchestrationAuthorizeUrl
  )
  const stsAuthorizationCode = getRedirect(
    groupMap.generateReauthenticationTestData[2],
    state,
    orchestrationAuthorizationCode,
    config.redirectUri
  )
  const clientAttestation = postGenerateClientAttestation(groupMap.generateReauthenticationTestData[3], publicKeyJwk)
  const { idToken } = await exchangeAuthorizationCode(
    groupMap.generateReauthenticationTestData[4],
    stsAuthorizationCode,
    codeVerifier,
    config.mockClientId,
    config.redirectUri,
    clientAttestation,
    { privateKey: keyPair.privateKey, publicKey: publicKeyJwk }
  )

  const idTokenPayload = idToken.split('.')[1]
  const decodedIdTokenPayload = JSON.parse(bufToString(b64decode(idTokenPayload, 'rawurl')))
  const persistentSessionId = decodedIdTokenPayload.persistent_id
  const reauthenticationContext: ReauthenticationContext = {
    persistentSessionId
  }

  console.log(reauthenticationContext)
}
