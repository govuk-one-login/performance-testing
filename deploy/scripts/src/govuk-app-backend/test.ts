import { URL } from '../common/utils/jslib/url'
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
import { uuidv4 } from '../common/utils/jslib'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('govUkAppBackend', LoadProfile.smoke)
  },
  peakTest: {
    govUkAppBackend: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 78,
      maxVUs: 156,
      stages: [
        { target: 3, duration: '2s' },
        { target: 3, duration: '30m' }
      ],
      exec: 'govUkAppBackend'
    }
  },
  stressTest: {
    govUkAppBackend: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 728,
      maxVUs: 1456,
      stages: [
        { target: 5, duration: '3s' },
        { target: 5, duration: '5m' },
        { target: 10, duration: '3s' },
        { target: 10, duration: '5m' },
        { target: 15, duration: '3s' },
        { target: 15, duration: '5m' },
        { target: 20, duration: '3s' },
        { target: 20, duration: '5m' },
        { target: 28, duration: '5s' },
        { target: 28, duration: '5m' }
      ],
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
  redirectURI: getEnv('GOVUKAPP_REDIRECT_URI'),
  clientSecret: getEnv('GOVUKAPP_CLIENT_SECRET')
}

export function govUkAppBackend(): void {
  const groups = groupMap.govUkAppBackend
  let res: Response
  const codeVerifierString = uuidv4()
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
          `/oauth2/authorize?client_id=${env.clientID}&response_type=code&redirect_uri=${encodedRedirectURI}&scope=${encodedScope}&state=debug123`
      ),
    { isStatusCode200, ...pageContentCheck('Successfully signed in') }
  )

  sleepBetween(0.5, 1)

  const redirectURL = new URL(res.url)
  const codeFromOL = redirectURL.searchParams.get('code') as string

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
          length: 1
        }),
        tokenGenHeaders
      ),
    { isStatusCode200, ...pageContentCheck('tokens') }
  )
  sleepBetween(0.5, 1)
  const token = res.json('tokens') as string

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
        {
          grant_type: 'authorization_code',
          client_id: env.clientID,
          code: codeFromOL,
          code_verifier: codeVerifierString,
          redirect_uri: env.redirectURI,
          scope: scope
        },
        tokenExchangeHeaders
      ),
    { isStatusCode200, ...pageContentCheck('refresh_token') }
  )
  sleepBetween(0.5, 1)

  const refreshToken = res.json('refresh_token') as string

  // B01_GovUKAppBackend_04_TokenRefreshCall
  timeGroup(
    groups[3],
    () =>
      http.post(
        env.tokenExchangeURL + '/dev/oauth2/token',
        {
          grant_type: 'refresh_token',
          client_id: env.clientID,
          refresh_token: refreshToken
        },
        tokenExchangeHeaders
      ),
    { isStatusCode200, ...pageContentCheck('expires_in') }
  )
  sleepBetween(0.5, 1)

  const revokeTokenHeaders = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${encoding.b64encode(env.clientID + ':' + env.clientSecret)}`
    }
  }

  if (Math.random() <= 0.67) {
    // B01_GovUKAppBackend_05_RevokeToken
    timeGroup(
      groups[4],
      () =>
        http.post(
          env.authURL + '/oauth2/revoke',
          {
            token: refreshToken
          },
          revokeTokenHeaders
        ),
      { isStatusCode200 }
    )
  }

  iterationsCompleted.add(1)
}
