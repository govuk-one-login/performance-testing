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
import { postGenerateClientAttestation } from './sts/utils/mockClient'
import {
  exchangeAccessToken,
  exchangeAuthorizationCode,
  exchangePreAuthorizedCode,
  getAuthorize,
  getCodeFromOrchestration,
  getRedirect,
  simulateCallToStsJwks
} from './sts/testSteps/backend'
import { generateCodeChallenge, generateKey } from './utils/crypto'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getPreAuthorizedCode } from './sts/utils/mockIssuer'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('walletCredentialIssuance', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)
export const groupMap = {
  walletCredentialIssuance: [
    '01 GET /authorize (STS)',
    '02 GET /.well-known/jwks.json (STS)',
    '03 GET /authorize (Orchestration)',
    '04 GET /redirect',
    '05 GET /.well-known/jwks.json (STS)',
    '06 POST /generate-client-attestation',
    '07 POST /token (authorization code exchange)',
    '08 GET /generate-pre-auth-code',
    '09 POST /token (access token exchange)',
    '10 POST /token (pre-authorized code exchange)',
    '11 GET /.well-known/jwks.json (STS)'
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

export async function walletCredentialIssuance(): Promise<void> {
  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const codeVerifier = crypto.randomUUID()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  iterationsStarted.add(1)
  const orchestrationAuthorizeUrl = getAuthorize(groupMap.walletCredentialIssuance[0], codeChallenge)
  simulateCallToStsJwks(groupMap.walletCredentialIssuance[1])
  sleepBetween(1, 2)
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(
    groupMap.walletCredentialIssuance[2],
    orchestrationAuthorizeUrl
  )
  const stsAuthorizationCode = getRedirect(groupMap.walletCredentialIssuance[3], state, orchestrationAuthorizationCode)
  simulateCallToStsJwks(groupMap.walletCredentialIssuance[4])
  const clientAttestation = postGenerateClientAttestation(groupMap.walletCredentialIssuance[5], publicKeyJwk)
  const { accessToken } = await exchangeAuthorizationCode(
    groupMap.walletCredentialIssuance[6],
    stsAuthorizationCode,
    codeVerifier,
    clientAttestation,
    keyPair.privateKey
  )
  const preAuthorizedCode = getPreAuthorizedCode(groupMap.walletCredentialIssuance[7])
  const preAuthorizedCodeExchangeServiceToken = exchangeAccessToken(
    groupMap.walletCredentialIssuance[8],
    accessToken,
    'sts.wallet.pre-auth-code'
  )
  exchangePreAuthorizedCode(
    groupMap.walletCredentialIssuance[9],
    preAuthorizedCode,
    preAuthorizedCodeExchangeServiceToken
  )
  simulateCallToStsJwks(groupMap.walletCredentialIssuance[10])
  iterationsCompleted.add(1)
}
