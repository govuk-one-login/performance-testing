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
import { postGenerateClientAttestation } from './sts/utils/mockClient'
import { exchangeAuthorizationCode, getAuthorize, getCodeFromOrchestration, getRedirect } from './sts/testSteps/backend'
import { generateCodeChallenge, generateKey } from './utils/crypto'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { b64decode } from 'k6/encoding'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('getServiceAccessToken', LoadProfile.smoke)
  },
  short: {
    ...createScenario('getServiceAccessToken', LoadProfile.short, 40)
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

export function teardown(): void {}

export async function getServiceAccessToken(): Promise<void> {
  const keyPair = await generateKey()
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const codeVerifier = crypto.randomUUID()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  const orchestrationAuthorizeUrl = getAuthorize(codeChallenge)
  sleepBetween(1, 2)
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(orchestrationAuthorizeUrl)
  const stsAuthorizationCode = getRedirect(state, orchestrationAuthorizationCode)
  const clientAttestation = postGenerateClientAttestation(publicKeyJwk)
  const { idToken } = await exchangeAuthorizationCode(
    stsAuthorizationCode,
    codeVerifier,
    clientAttestation,
    keyPair.privateKey
  )

  const idTokenPayload = idToken.split('.')[1]
  const decodedIdTokenPayload = JSON.parse(bufToString(b64decode(idTokenPayload, 'rawurl')))
  const persistentSessionId = decodedIdTokenPayload.persistent_id
  const sessionContext = {
    persistentSessionId,
    privateKeyJwk,
    publicKeyJwk
  }

  console.log(`${JSON.stringify(sessionContext)}`)
}

export function bufToString(buf: ArrayBuffer): string {
  let str = ''
  const bufView = new Uint8Array(buf)
  for (let i = 0, bufLen = bufView.length; i < bufLen; i++) {
    str += String.fromCharCode(bufView[i])
  }
  return str
}
