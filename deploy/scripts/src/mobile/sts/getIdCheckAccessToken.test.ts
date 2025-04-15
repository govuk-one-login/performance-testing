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
import { timeGroup } from '../../common/utils/request/timing'
import { isStatusCode200, isStatusCode302 } from '../../common/utils/checks/assertions'
import http, { type Response } from 'k6/http'
import { URL } from '../../common/utils/jslib/url'
import { createHash } from 'k6/crypto'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('getIdCheckAccessToken', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  getIdCheckAccessToken: [
    'GET /authorize (STS)',
    'GET /.well-known/jwks.json',
    'GET /authorize (Orchestration)',
    'GET /redirect'
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

export function getIdCheckAccessToken(): void {
  iterationsStarted.add(1)
  const orchestrationAuthorizeUrl = getAuthorize()
  simulateOrchestrationCallToStsJwks()
  const { state, orchestrationAuthorizationCode } = getCodeFromOrchestration(orchestrationAuthorizeUrl)
  const stsAuthorizationCode = getRedirect(state, orchestrationAuthorizationCode)
  iterationsCompleted.add(1)
}

// const stsBaseUrl = 'https://token.dev.account.gov.uk'
const stsBaseUrl = 'https://backend-api-jl.token.dev.account.gov.uk'
const redirectUrl = 'https://mobile.dev.account.gov.uk/redirect'
// const orchestrationBaseUrl = 'https://auth-stub.mobile.dev.account.gov.uk'
const orchestrationBaseUrl = 'https://auth-stub-jl.mobile.dev.account.gov.uk'
const codeVerifier = '98116f16-5a63-43ae-bc6d-563fbbd8b6d8'
const codeChallenge = generateCodeChallenge(codeVerifier)

function generateCodeChallenge(codeVerifier: string): string {
  const hasher = createHash('sha256')
  hasher.update(codeVerifier)
  return hasher.digest('base64url')
}

export function getAuthorize(): string {
  const res = timeGroup(
    groupMap.getIdCheckAccessToken[0],
    () => {
      const url = new URL('authorize', stsBaseUrl)
      url.searchParams.set('client_id', 'bCAOfDdDSwO4ug2ZNNU1EZrlGrg')
      url.searchParams.set('redirect_uri', redirectUrl)
      url.searchParams.set('state', 'STATE')
      url.searchParams.set('nonce', 'NONCE')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('scope', 'openid')
      url.searchParams.set('code_challenge', codeChallenge)
      url.searchParams.set('code_challenge_method', 'S256')
      return http.get(url.toString(), { redirects: 0 })
    },
    {
      isStatusCode302,
      validateOrchestrationRedirect
    }
  )
  return res.headers.Location
}

function simulateOrchestrationCallToStsJwks(): void {
  timeGroup(
    groupMap.getIdCheckAccessToken[1],
    () => {
      return http.get(`${stsBaseUrl}/.well-known/jwks.json`)
    },
    {
      isStatusCode200
    }
  )
}

function getCodeFromOrchestration(orchestrationAuthorizeUrl: string): {
  state: string
  orchestrationAuthorizationCode: string
} {
  const res = timeGroup(
    groupMap.getIdCheckAccessToken[2],
    () =>
      http.get(orchestrationAuthorizeUrl, {
        headers: { 'x-headless-mode-enabled': 'true' }
        // redirects: 0
      })
    // {
    //   v: (res: Response) => {
    //     return res.json('code') !== undefined
    //   }
    // }
  )
  // Question - how to handle responses from mocks where it might be inefficient to add checks
  return {
    state: res.json('state') as string,
    orchestrationAuthorizationCode: res.json('code') as string
  }
  return {
    state: '',
    orchestrationAuthorizationCode: ''
  }
}

export function getRedirect(state: string, orchestrationAuthorizationCode: string): string {
  const res = timeGroup(
    groupMap.getIdCheckAccessToken[3],
    () => {
      const url = new URL('redirect', stsBaseUrl)
      url.searchParams.set('code', orchestrationAuthorizationCode)
      url.searchParams.set('state', state)
      return http.get(url.toString(), { redirects: 0 })
    },
    {
      isStatusCode302,
      validateAuthorizationResponse
    }
  )
  return new URL(res.headers.Location).searchParams.get('code')!
}

// assertions - move these later
export function validateOrchestrationRedirect(res: Response): boolean {
  const url = new URL(res.headers.Location)
  if (url.origin !== orchestrationBaseUrl) return false
  if (url.pathname !== '/authorize') return false
  const queryParams = url.searchParams
  const requiredQueryParams = ['client_id', 'scope', 'response_type', 'request']
  if (requiredQueryParams.some(paramName => !queryParams.has(paramName))) return false
  return true
}

export function validateAuthorizationResponse(res: Response): boolean {
  const url = new URL(res.headers.Location)
  if (`${url.origin}${url.pathname}` !== redirectUrl) return false
  const queryParams = url.searchParams
  const requiredQueryParams = ['code', 'state']
  if (requiredQueryParams.some(paramName => !queryParams.has(paramName))) return false
  if (queryParams.get('state') !== 'STATE') return false
  return true
}
