import {
  createI4PeakTestSignUpScenario,
  createScenario,
  describeProfile,
  LoadProfile,
  ProfileList,
  selectProfile,
  createI3SpikeSignUpScenario,
  createI4PeakTestSignInScenario
} from '../common/utils/config/load-profiles'
import { Options } from 'k6/options'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
import { generateCodeChallenge, generateKey } from './utils/crypto'
import {
  getAppInfo,
  postClientAttestation,
  postTxmaEvent,
  simulateCallToMobileBackendJwks
} from './mobile-backend/testSteps/backend'
import { getAppCheckToken } from './mobile-backend/utils/appCheckToken'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { uuidv4 } from '../common/utils/jslib'
import {
  exchangeAccessToken,
  exchangeAuthorizationCode,
  getAuthorize,
  getCodeFromOrchestration,
  getRedirect
} from './sts/testSteps/backend'
import { config } from './mobile-backend/utils/config'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('getClientAttestation', LoadProfile.smoke),
    ...createScenario('walletCredentialIssuance', LoadProfile.smoke)
  },
  perf006Iteration3PeakTest: {
    getClientAttestation: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 528,
      stages: [
        { target: 150, duration: '151s' },
        { target: 150, duration: '30m' }
      ],
      exec: 'getClientAttestation'
    }
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('getClientAttestation', 450, 12, 451)
  },
  walletPerfTestBackend: {
    getClientAttestation: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 144,
      maxVUs: 288,
      stages: [
        { target: 24, duration: '12s' },
        { target: 24, duration: '55m' }
      ],
      exec: 'getClientAttestation'
    },
    walletCredentialIssuance: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 513,
      maxVUs: 1026,
      stages: [
        { target: 38, duration: '18s' },
        { target: 38, duration: '55m' }
      ],
      exec: 'walletCredentialIssuance'
    }
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignUpScenario('getClientAttestation', 540, 12, 541)
  },
  perf006Iteration5SpikeTest: {
    ...createI3SpikeSignUpScenario('getClientAttestation', 1074, 12, 1075)
  },
  perf006Iteration6RegressionTest: {
    ...createI4PeakTestSignUpScenario('getClientAttestation', 540, 12, 541),
    ...createI4PeakTestSignInScenario('walletCredentialIssuance', 38, 27, 18)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('getClientAttestation', 170, 12, 171),
    ...createI4PeakTestSignInScenario('walletCredentialIssuance', 38, 27, 18)
  },
  perf006Iteration8PeakTest: {
    getClientAttestation: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 540,
      maxVUs: 1080,
      stages: [
        { target: 400, duration: '401s' },
        { target: 400, duration: '55m' }
      ],
      exec: 'getClientAttestation'
    },
    walletCredentialIssuance: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 741,
      maxVUs: 1482,
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
  getClientAttestation: [
    '01_GET_/appInfo',
    '02_GET_/app-check-token',
    '03_POST_/client-attestation',
    '04_GET_/.well-known/jwks.json'
  ],
  walletCredentialIssuance: [
    '01 GET /authorize (STS)',
    '02 GET /authorize (Orchestration)',
    '03 GET /redirect',
    '04 GET /app-check-token',
    '05 POST /client-attestation',
    '06 POST /token (authorization code exchange)',
    '07 POST /token (access token exchange - TxMA event service token)',
    '08 POST /txma-event (WALLET_CREDENTIAL_ADD_ATTEMPT event)',
    '09 POST /txma-event (WALLET_CREDENTIAL_ADDED event)'
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

export async function getClientAttestation(): Promise<void> {
  const group = groupMap.getClientAttestation

  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  iterationsStarted.add(1)
  getAppInfo(group[0])
  sleepBetween(1, 2)
  const appCheckToken = getAppCheckToken(group[1])
  postClientAttestation(group[2], publicKeyJwk, appCheckToken)
  simulateCallToMobileBackendJwks(group[3])
  iterationsCompleted.add(1)
}

export async function walletCredentialIssuance(): Promise<void> {
  const keyPair = await generateKey()
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)

  const codeVerifier = crypto.randomUUID()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  const credentialId = uuidv4()

  iterationsStarted.add(1)
  const orchestrationAuthorizeUrl = getAuthorize(
    groupMap.walletCredentialIssuance[0],
    config.oneLoginAppStsClientId,
    config.oneLoginAppStsRedirectUri,
    codeChallenge
  )
  sleepBetween(1, 2)
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(
    groupMap.walletCredentialIssuance[1],
    orchestrationAuthorizeUrl
  )
  const stsAuthorizationCode = getRedirect(
    groupMap.walletCredentialIssuance[2],
    state,
    orchestrationAuthorizationCode,
    config.oneLoginAppStsRedirectUri
  )
  const appCheckToken = getAppCheckToken(groupMap.walletCredentialIssuance[3])
  const clientAttestation = postClientAttestation(groupMap.walletCredentialIssuance[4], publicKeyJwk, appCheckToken)
  const { accessToken } = await exchangeAuthorizationCode(
    groupMap.walletCredentialIssuance[5],
    stsAuthorizationCode,
    codeVerifier,
    config.oneLoginAppStsClientId,
    config.oneLoginAppStsRedirectUri,
    clientAttestation,
    { privateKey: keyPair.privateKey, publicKey: publicKeyJwk }
  )
  const txmaEventServiceToken = exchangeAccessToken(
    groupMap.walletCredentialIssuance[6],
    accessToken,
    'mobile.txma-event.write'
  )
  postTxmaEvent(groupMap.walletCredentialIssuance[7], 'WALLET_CREDENTIAL_ADD_ATTEMPT', txmaEventServiceToken)
  sleepBetween(1, 2)
  postTxmaEvent(groupMap.walletCredentialIssuance[8], 'WALLET_CREDENTIAL_ADDED', txmaEventServiceToken, credentialId)
  iterationsCompleted.add(1)
}
