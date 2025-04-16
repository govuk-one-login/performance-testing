import { URL } from '../../../common/utils/jslib/url'
import { config } from '../utils/config'
import { timeGroup } from '../../../common/utils/request/timing'
import http from 'k6/http'
import { isStatusCode200, isStatusCode302 } from '../../../common/utils/checks/assertions'
import { groupMap } from '../getServiceAccessToken.test'
import { validateAccessTokenResponse, validateRedirect, validateTokenExchangeResponse } from '../utils/assertions'
import { signJwt } from '../utils/crypto'

export function getAuthorize(codeChallenge: string): string {
  const url = new URL('authorize', config.stsBaseUrl)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('state', 'STATE')
  url.searchParams.set('nonce', 'NONCE')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid')
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  const authorizeRequestUrl = url.toString()
  const res = timeGroup(
    groupMap.getServiceAccessToken[0],
    () => {
      return http.get(authorizeRequestUrl, { redirects: 0 })
    },
    {
      isStatusCode302,
      ...validateRedirect(`${config.orchestrationBaseUrl}/authorize`, [
        'client_id',
        'scope',
        'response_type',
        'request'
      ])
    }
  )
  return res.headers.Location
}

export function simulateOrchestrationCallToStsJwks(): void {
  timeGroup(
    groupMap.getServiceAccessToken[1],
    () => {
      return http.get(`${config.stsBaseUrl}/.well-known/jwks.json`)
    },
    {
      isStatusCode200
    }
  )
}

export function getCodeFromOrchestration(orchestrationAuthorizeUrl: string): {
  state: string
  orchestrationAuthorizationCode: string
} {
  const res = timeGroup(
    groupMap.getServiceAccessToken[2],
    () =>
      http.get(orchestrationAuthorizeUrl, {
        headers: { 'x-headless-mode-enabled': 'true' }
      }),
    { isStatusCode200 }
  )
  return {
    state: res.json('state') as string,
    orchestrationAuthorizationCode: res.json('code') as string
  }
}

export function getRedirect(state: string, orchestrationAuthorizationCode: string): string {
  const url = new URL('redirect', config.stsBaseUrl)
  url.searchParams.set('code', orchestrationAuthorizationCode)
  url.searchParams.set('state', state)
  const redirectRequestUrl = url.toString()
  const res = timeGroup(
    groupMap.getServiceAccessToken[3],
    () => {
      return http.get(redirectRequestUrl, { redirects: 0 })
    },
    {
      isStatusCode302,
      ...validateRedirect(config.redirectUri, ['code', 'state'])
    }
  )
  return new URL(res.headers.Location).searchParams.get('code')!
}

export async function exchangeAuthorizationCode(
  authorizationCode: string,
  codeVerifier: string,
  clientAttestation: string,
  keypair: CryptoKeyPair
): Promise<string> {
  const nowInSeconds = Math.floor(Date.now() / 1000)
  const proofOfPossession = await signJwt(
    'ES256',
    keypair.privateKey,
    {
      iss: config.clientId,
      aud: config.stsBaseUrl,
      exp: nowInSeconds + 180,
      jti: crypto.randomUUID()
    },
    { typ: 'oauth-client-attestation-pop+jwt' }
  )

  const res = timeGroup(
    groupMap.getServiceAccessToken[5],
    () => {
      return http.post(
        `${config.stsBaseUrl}/token`,
        {
          grant_type: 'authorization_code',
          code: authorizationCode,
          redirect_uri: config.redirectUri,
          code_verifier: codeVerifier
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'OAuth-Client-Attestation': clientAttestation,
            'OAuth-Client-Attestation-PoP': proofOfPossession
          }
        }
      )
    },
    {
      isStatusCode200,
      validateAccessTokenResponse
    }
  )
  return res.json('access_token') as string
}

export function simulateAppCallToStsJwks(): void {
  timeGroup(
    groupMap.getServiceAccessToken[6],
    () => {
      return http.get(`${config.stsBaseUrl}/.well-known/jwks.json`)
    },
    {
      isStatusCode200
    }
  )
}

export function exchangeAccessToken(accessToken: string, scope: string): string {
  const res = timeGroup(
    groupMap.getServiceAccessToken[7],
    () => {
      return http.post(
        `${config.stsBaseUrl}/token`,
        {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: accessToken,
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          scope
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      )
    },
    {
      isStatusCode200,
      validateTokenExchangeResponse
    }
  )
  return res.json('access_token') as string
}

export function simulateIdCheckCallToStsJwks(): void {
  timeGroup(
    groupMap.getServiceAccessToken[8],
    () => {
      return http.get(`${config.stsBaseUrl}/.well-known/jwks.json`)
    },
    {
      isStatusCode200
    }
  )
}
