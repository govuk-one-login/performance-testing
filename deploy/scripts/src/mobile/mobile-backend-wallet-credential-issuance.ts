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
import {
  exchangeAccessToken,
  exchangeAuthorizationCode,
  getAuthorize,
  getCodeFromOrchestration,
  getRedirect
} from './sts/testSteps/backend'
import { generateCodeChallenge, generateKey } from './utils/crypto'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { config } from './mobile-backend/utils/config'
import { getAppCheckToken } from './mobile-backend/utils/appCheckToken'
import { postClientAttestation, postTxmaEvent } from './mobile-backend/testSteps/backend'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('walletCredentialIssuance', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)
export const groupMap = {
  walletCredentialIssuance: [
    '01 GET /authorize (STS)',
    '02 GET /authorize (Orchestration)',
    '03 GET /redirect',
    '04 GET /app-check-token',
    '05 POST /client-attestation',
    '06 POST /token (authorization code exchange)',
    '07 POST /token (access token exchange - TxMA event service token)',
    '08 POST /txma-event (WALLET_CREDENTIAL_ADD_ATTEMPT event)',
    '09 POST /txma-event (WALLET_CREDENTIAL_CONSENT_GIVEN event)',
    '10 POST /txma-event (WALLET_CREDENTIAL_ADDED event)'
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
    keyPair.privateKey
  )
  const txmaEventServiceToken = exchangeAccessToken(
    groupMap.walletCredentialIssuance[6],
    accessToken,
    'mobile.txma-event.write'
  )
  postTxmaEvent(groupMap.walletCredentialIssuance[7], 'WALLET_CREDENTIAL_ADD_ATTEMPT', txmaEventServiceToken)
  postTxmaEvent(groupMap.walletCredentialIssuance[8], 'WALLET_CREDENTIAL_CONSENT_GIVEN', txmaEventServiceToken)
  postTxmaEvent(groupMap.walletCredentialIssuance[9], 'WALLET_CREDENTIAL_ADDED', txmaEventServiceToken)
  iterationsCompleted.add(1)
}
