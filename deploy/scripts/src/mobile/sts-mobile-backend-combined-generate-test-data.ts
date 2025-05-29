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
import { config } from './mobile-backend/utils/config'

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
  generateTestData: [
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

export async function generateTestData(): Promise<void> {
  const group = groupMap.generateTestData

  const keyPair = await generateKey()
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey)
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const codeVerifier = crypto.randomUUID()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  const orchestrationAuthorizeUrl = getAuthorize(
    group[0],
    config.oneLoginAppStsClientId,
    config.oneLoginAppStsRedirectUri,
    codeChallenge
  )
  sleepBetween(1, 2)
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(group[1], orchestrationAuthorizeUrl)
  const stsAuthorizationCode = getRedirect(
    group[2],
    state,
    orchestrationAuthorizationCode,
    config.oneLoginAppStsRedirectUri
  )
  const clientAttestation = postGenerateClientAttestation(group[3], publicKeyJwk)
  const { idToken } = await exchangeAuthorizationCode(
    group[4],
    stsAuthorizationCode,
    codeVerifier,
    config.oneLoginAppStsClientId,
    config.oneLoginAppStsRedirectUri,
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
