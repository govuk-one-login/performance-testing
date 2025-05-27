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
  const group = groupMap.walletCredentialIssuance

  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const codeVerifier = crypto.randomUUID()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  iterationsStarted.add(1)
  const orchestrationAuthorizeUrl = getAuthorize(group[0], codeChallenge)
  simulateCallToStsJwks(group[1])
  sleepBetween(1, 2)
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(group[2], orchestrationAuthorizeUrl)
  const stsAuthorizationCode = getRedirect(group[3], state, orchestrationAuthorizationCode)
  simulateCallToStsJwks(group[4])
  const clientAttestation = postGenerateClientAttestation(group[5], publicKeyJwk)
  const { accessToken } = await exchangeAuthorizationCode(
    group[6],
    stsAuthorizationCode,
    codeVerifier,
    clientAttestation,
    keyPair.privateKey
  )
  const preAuthorizedCode = getPreAuthorizedCode(group[7])
  const preAuthorizedCodeExchangeServiceToken = exchangeAccessToken(group[8], accessToken, 'sts.wallet.pre-auth-code')
  exchangePreAuthorizedCode(group[9], preAuthorizedCode, preAuthorizedCodeExchangeServiceToken)
  simulateCallToStsJwks(group[10])
  iterationsCompleted.add(1)
}
