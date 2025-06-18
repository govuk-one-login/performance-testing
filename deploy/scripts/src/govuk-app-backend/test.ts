import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import http, { type Response } from 'k6/http'
import { type Options } from 'k6/options'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'
import encoding from 'k6/encoding'
import { findBetween, uuidv4 } from '../common/utils/jslib'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('govUkAppBackend', LoadProfile.smoke)
  },
  smokePerVUIterations: {
    govUkAppBackend: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '30s',
      exec: 'govUkAppBackend'
    }
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  govUkAppBackend: [
    'B01_GovUKAppBackend_01_Authorize',
    'B01_GovUKAppBackend_02_TokenGenerationCall',
    'B01_GovUKAppBackend_03_TokenExchangeCall',
    'B01_GovUKAppBackend_04_TokenRefreshCall', // pragma: allowlist secret
    'B01_GovUKAppBackend_05_RevokeToken'
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

const env = {
  authURL: getEnv('GOVUKAPP_COGNITO_URL'),
  tokenGenURL: getEnv('GOVUKAPP_TOKEN_GEN_URL'),
  tokenExchangeURL: getEnv('GOVUKAPP_TOKEN_EXCHANGE_URL'),
  clientID: getEnv('GOVUKAPP_CLIENT_ID'),
  redirectURI: getEnv('GOVUKAPP_REDIRECT_URI')
}

export function govUkAppBackend(): void {
  const groups = groupMap.govUkAppBackend
  let res: Response
  const codeVerifierString = uuidv4()
  const codeChallenge = encoding.b64encode(codeVerifierString)
  const encodedRedirectURI = encodeURIComponent(env.redirectURI)
  const scope = 'openid email'
  const encodedScope = encodeURIComponent(scope)

  iterationsStarted.add(1)
  // B01_GovUKAppBackend_01_Authorize
  res = timeGroup(
    groups[0],
    () =>
      http.get(
        env.authURL +
          `/oauth2/authorize?client_id=${env.clientID}&response_type=code&redirect_uri=${encodedRedirectURI}&scope=${encodedScope}&code_challenge=${codeChallenge}&code_challenge_method=S256&state=debug123`
      ),
    { isStatusCode200, ...pageContentCheck('Successfully signed in') }
  )

  sleepBetween(3, 5)
  const codeFromOL = findBetween(res.url, 'code=', '&state=').toString()
  console.log(codeFromOL)

  // B01_GovUKAppBackend_02_TokenGenerationCall
  const tokenGenHeaders = {
    headers: {
      'Content-Type': 'application/json'
    }
  }
  res = timeGroup(
    groups[1],
    () =>
      http.post(
        env.tokenGenURL + '/dev/token',
        JSON.stringify({
          length: '1'
        }),
        tokenGenHeaders
      ),
    { isStatusCode200, ...pageContentCheck('tokens') }
  )
  sleepBetween(3, 5)
  console.log(res.body)
  const token = res.json('tokens') as string
  console.log(`The attestation token value is ${token}`)

  const tokenExchangeHeaders = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Attestation-Token': token
    }
  }
  // B01_GovUKAppBackend_03_TokenExchangeCall
  res = timeGroup(
    groups[2],
    () =>
      http.post(
        env.tokenExchangeURL + '/dev/oauth2/token',
        JSON.stringify({
          grant_type: 'authorization_code',
          client_id: env.clientID,
          code: codeFromOL,
          code_verifier: codeVerifierString,
          redirect_uri: env.redirectURI,
          scope: scope
        }),
        tokenExchangeHeaders
      ),
    { isStatusCode200, ...pageContentCheck('refresh_token') }
  )
  sleepBetween(3, 5)
  console.log(res.body)

  const refreshToken = res.json('refresh_token') as string
  console.log(`The refresh token value is ${refreshToken}`)

  // B01_GovUKAppBackend_04_TokenRefreshCall
  res = timeGroup(
    groups[3],
    () =>
      http.post(
        env.tokenExchangeURL + '/dev/oauth2/token',
        JSON.stringify({
          grant_type: 'refresh_token',
          client_id: env.clientID,
          refresh_token: refreshToken
        }),
        tokenExchangeHeaders
      ),
    { isStatusCode200, ...pageContentCheck('expires_in') }
  )
  sleepBetween(3, 5)
  console.log(res.body)

  const revokeTokenHeaders = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }

  // B01_GovUKAppBackend_05_RevokeToken
  res = timeGroup(
    groups[4],
    () =>
      http.post(
        env.authURL + '/oauth2/revoke',
        JSON.stringify({
          token: refreshToken,
          client_id: env.clientID
        }),
        revokeTokenHeaders
      ),
    { isStatusCode200 }
  )
  console.log(res.body)

  iterationsCompleted.add(1)
}
