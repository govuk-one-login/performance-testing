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
import { postGenerateClientAttestation } from './utils/mockClient'
import {
  exchangeAccessToken,
  exchangeAuthorizationCode,
  getAuthorize,
  getCodeFromOrchestration,
  getRedirect,
  simulateCallToStsJwks
} from './testSteps/backend'
import { generateCodeChallenge, generateKey } from './utils/crypto'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('getServiceAccessToken', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)
export const groupMap = {
  getServiceAccessToken: [
    'GET /authorize (STS)',
    'GET /.well-known/jwks.json',
    'GET /authorize (Orchestration)',
    'GET /redirect',
    'GET /.well-known/jwks.json',
    'POST /generate-client-attestation',
    'POST /token (authorization code exchange)',
    'GET /.well-known/jwks.json',
    'POST /token (access token exchange)',
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

export async function getServiceAccessToken(): Promise<void> {
  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const codeVerifier = crypto.randomUUID()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  iterationsStarted.add(1)
  const orchestrationAuthorizeUrl = getAuthorize(codeChallenge)
  simulateCallToStsJwks(groupMap.getServiceAccessToken[1])
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(orchestrationAuthorizeUrl)
  const stsAuthorizationCode = getRedirect(state, orchestrationAuthorizationCode)
  simulateCallToStsJwks(groupMap.getServiceAccessToken[4])
  const clientAttestation = postGenerateClientAttestation(publicKeyJwk)
  const accessToken = await exchangeAuthorizationCode(stsAuthorizationCode, codeVerifier, clientAttestation, keyPair)
  simulateCallToStsJwks(groupMap.getServiceAccessToken[7])
  exchangeAccessToken(accessToken, 'sts-test.hello-world.read')
  simulateCallToStsJwks(groupMap.getServiceAccessToken[9])
  iterationsCompleted.add(1)
}
