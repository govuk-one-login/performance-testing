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
import { postGenerateClientAttestation } from './sts/utils/mockClient'
import {
  exchangeAccessToken,
  exchangeAuthorizationCode,
  getAuthorize,
  getCodeFromOrchestration,
  getRedirect,
  simulateCallToStsJwks
} from './sts/testSteps/backend'
import { generateCodeChallenge, generateKey } from './utils/crypto'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { config } from './sts/utils/config'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('getServiceAccessToken', LoadProfile.smoke)
  },
  perf006Iteration3PeakTest: {
    getServiceAccessToken: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 528,
      stages: [
        { target: 150, duration: '151s' },
        { target: 150, duration: '30m' }
      ],
      exec: 'getServiceAccessToken'
    }
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('getServiceAccessToken', 450, 30, 451)
  }
}

const loadProfile = selectProfile(profiles)
export const groupMap = {
  getServiceAccessToken: [
    '01 GET /authorize (STS)',
    '02 GET /.well-known/jwks.json',
    '03 GET /authorize (Orchestration)',
    '04 GET /redirect',
    '05 GET /.well-known/jwks.json',
    '06 POST /generate-client-attestation',
    '07 POST /token (authorization code exchange)',
    '08 GET /.well-known/jwks.json',
    '09 POST /token (access token exchange)',
    '10 GET /.well-known/jwks.json'
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
  const orchestrationAuthorizeUrl = getAuthorize(
    groupMap.getServiceAccessToken[0],
    config.mockClientId,
    config.redirectUri,
    codeChallenge
  )
  simulateCallToStsJwks(groupMap.getServiceAccessToken[1])
  sleepBetween(1, 2)
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(
    groupMap.getServiceAccessToken[2],
    orchestrationAuthorizeUrl
  )
  const stsAuthorizationCode = getRedirect(
    groupMap.getServiceAccessToken[3],
    state,
    orchestrationAuthorizationCode,
    config.redirectUri
  )
  simulateCallToStsJwks(groupMap.getServiceAccessToken[4])
  const clientAttestation = postGenerateClientAttestation(groupMap.getServiceAccessToken[5], publicKeyJwk)
  const { accessToken } = await exchangeAuthorizationCode(
    groupMap.getServiceAccessToken[6],
    stsAuthorizationCode,
    codeVerifier,
    config.redirectUri,
    clientAttestation,
    keyPair.privateKey
  )
  simulateCallToStsJwks(groupMap.getServiceAccessToken[7])
  exchangeAccessToken(groupMap.getServiceAccessToken[8], accessToken, 'sts-test.hello-world.read')
  simulateCallToStsJwks(groupMap.getServiceAccessToken[9])
  iterationsCompleted.add(1)
}
