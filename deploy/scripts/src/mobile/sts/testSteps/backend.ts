import { URL } from '../../../common/utils/jslib/url'
import { config } from '../utils/config'
import { timeGroup } from '../../../common/utils/request/timing'
import http from 'k6/http'
import { isStatusCode200, isStatusCode302 } from '../../../common/utils/checks/assertions'
import { validateRedirect } from '../utils/assertions'
import { signJwt } from '../../utils/crypto'
import { validateJsonResponse } from '../../utils/assertions'
import { b64encode } from 'k6/encoding'

export function getAuthorize(
  groupName: string,
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  persistentSessionId?: string
): string {
  const url = new URL('authorize', config.stsBaseUrl)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', 'STATE')
  url.searchParams.set('nonce', 'NONCE')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid')
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  if (persistentSessionId) {
    url.searchParams.set('govuk_signin_session_id', persistentSessionId)
  }
  const authorizeRequestUrl = url.toString()
  const res = timeGroup(
    groupName,
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

export function getCodeFromOrchestration(
  groupName: string,
  orchestrationAuthorizeUrl: string,
  responseOverrides?: object
): {
  state: string
  orchestrationAuthorizationCode: string
} {
  const res = timeGroup(
    groupName,
    () =>
      http.get(orchestrationAuthorizeUrl, {
        headers: {
          'x-headless-mode-enabled': 'true',
          ...(responseOverrides && { 'x-response-overrides': b64encode(JSON.stringify(responseOverrides), 'rawurl') })
        }
      }),
    { isStatusCode200 }
  )
  return {
    state: res.json('state') as string,
    orchestrationAuthorizationCode: res.json('code') as string
  }
}

export function getRedirect(
  groupName: string,
  state: string,
  orchestrationAuthorizationCode: string,
  redirectUri: string
): string {
  const url = new URL('redirect', config.stsBaseUrl)
  url.searchParams.set('code', orchestrationAuthorizationCode)
  url.searchParams.set('state', state)
  const redirectRequestUrl = url.toString()
  const res = timeGroup(
    groupName,
    () => {
      return http.get(redirectRequestUrl, { redirects: 0 })
    },
    {
      isStatusCode302,
      ...validateRedirect(redirectUri, ['code', 'state'])
    }
  )
  return new URL(res.headers.Location).searchParams.get('code')!
}

type Keys = {
  privateKey: CryptoKey
  publicKey: JsonWebKey
}

export async function exchangeAuthorizationCode(
  groupName: string,
  authorizationCode: string,
  codeVerifier: string,
  redirectUri: string,
  clientId: string,
  clientAttestation: string,
  keys: Keys
): Promise<{ accessToken: string; idToken: string; refreshToken: string }> {
  const nowInSeconds = Math.floor(Date.now() / 1000)
  const proofOfPossession = await signJwt(
    'ES256',
    keys.privateKey,
    {
      iss: clientId,
      aud: config.stsBaseUrl,
      exp: nowInSeconds + 180,
      jti: crypto.randomUUID()
    },
    { typ: 'oauth-client-attestation-pop+jwt' }
  )

  const dpop = await signJwt(
    'ES256',
    keys.privateKey,
    {
      htm: 'POST',
      htu: config.stsBaseUrl + '/token',
      iat: nowInSeconds,
      jti: crypto.randomUUID()
    },
    { typ: 'dpop+jwt', jwk: keys.publicKey }
  )

  const res = timeGroup(
    groupName,
    () => {
      return http.post(
        `${config.stsBaseUrl}/token`,
        {
          grant_type: 'authorization_code',
          code: authorizationCode,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'OAuth-Client-Attestation': clientAttestation,
            'OAuth-Client-Attestation-PoP': proofOfPossession,
            DPoP: dpop
          }
        }
      )
    },
    {
      isStatusCode200,
      ...validateJsonResponse(['access_token', 'id_token', 'refresh_token'])
    }
  )
  return {
    accessToken: res.json('access_token') as string,
    idToken: res.json('id_token') as string,
    refreshToken: res.json('refresh_token') as string
  }
}

export async function refreshAccessToken(
  groupName: string,
  refreshToken: string,
  clientId: string,
  clientAttestation: string,
  privateKey: CryptoKey,
  publicKey: JsonWebKey
): Promise<{ accessToken: string }> {
  const nowInSeconds = Math.floor(Date.now() / 1000)
  const proofOfPossession = await signJwt(
    'ES256',
    privateKey,
    {
      iss: clientId,
      aud: config.stsBaseUrl,
      exp: nowInSeconds + 180,
      jti: crypto.randomUUID()
    },
    { typ: 'oauth-client-attestation-pop+jwt' }
  )

  const dpop = await signJwt(
    'ES256',
    privateKey,
    {
      htm: 'POST',
      htu: config.stsBaseUrl + '/token',
      iat: nowInSeconds,
      jti: crypto.randomUUID()
    },
    { typ: 'dpop+jwt', jwk: publicKey }
  )
  const res = timeGroup(
    groupName,
    () => {
      return http.post(
        `${config.stsBaseUrl}/token`,
        {
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'OAuth-Client-Attestation': clientAttestation,
            'OAuth-Client-Attestation-PoP': proofOfPossession,
            DPoP: dpop
          }
        }
      )
    },
    {
      isStatusCode200
    }
  )
  return {
    accessToken: res.json('access_token') as string
  }
}

export function exchangeAccessToken(groupName: string, accessToken: string, scope: string): string {
  const res = timeGroup(
    groupName,
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
      isStatusCode200
    }
  )
  return res.json('access_token') as string
}

export function exchangePreAuthorizedCode(groupName: string, preAuthorizedCode: string, accessToken: string) {
  timeGroup(
    groupName,
    () => {
      return http.post(
        `${config.stsBaseUrl}/token`,
        {
          grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
          client_id: config.mockClientId,
          'pre-authorized_code': preAuthorizedCode
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: ` Bearer ${accessToken}`
          }
        }
      )
    },
    {
      isStatusCode200
    }
  )
}

export function simulateCallToStsJwks(groupName: string): void {
  timeGroup(
    groupName,
    () => {
      return http.get(`${config.stsBaseUrl}/.well-known/jwks.json`)
    },
    {
      isStatusCode200
    }
  )
}
