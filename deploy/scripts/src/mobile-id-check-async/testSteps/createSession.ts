import http from 'k6/http'
import { timeGroup } from '../../common/utils/request/timing'
import { groupMap } from '../test'
import { config } from '../utils/config'
import { b64encode } from 'k6/encoding'
import { isStatusCode200, isStatusCode201 } from '../../common/utils/checks/assertions'
import { sleepBetween } from '../../common/utils/sleep/sleepBetween'

import { URL } from '../../common/utils/jslib/url'
import { uuidv4 } from '../../common/utils/jslib'
import { apiSignaturev4Signer } from '../utils/apiSignatureV4Signer'

export function createSession(): string {
  const asyncTokenRequestBody = 'grant_type=client_credentials'
  const signedAsyncTokenRequest = apiSignaturev4Signer.sign({
    method: 'POST',
    protocol: 'https',
    hostname: new URL(getUrl()).hostname,
    path: '/async/token',
    headers: getTokenRequestHeader(),
    body: asyncTokenRequestBody
  })

  const asyncTokenResponse = timeGroup(
    groupMap.idCheckAsync[0],
    () =>
      http.post(signedAsyncTokenRequest.url, asyncTokenRequestBody, {
        headers: { ...signedAsyncTokenRequest.headers, ...getTokenRequestHeader() }
      }),
    {
      isStatusCode200
    }
  )

  sleepBetween(0.5, 1)

  const sub = uuidv4()

  const asyncCredentialRequestBody = {
    state: 'mockState',
    sub,
    client_id: config.clientId,
    govuk_signin_journey_id: 'performanceTest'
  }

  const accessToken = asyncTokenResponse.json('access_token') as string

  const signedAsyncCredentialRequest = apiSignaturev4Signer.sign({
    method: 'POST',
    protocol: 'https',
    hostname: new URL(getUrl()).hostname,
    path: '/async/credential',
    headers: getAsyncCredentialRequestHeader(accessToken),
    body: JSON.stringify(asyncCredentialRequestBody)
  })

  timeGroup(
    groupMap.idCheckAsync[1],
    () =>
      http.post(signedAsyncCredentialRequest.url, JSON.stringify(asyncCredentialRequestBody), {
        headers: { ...signedAsyncCredentialRequest.headers, ...getAsyncCredentialRequestHeader(accessToken) }
      }),
    {
      isStatusCode201
    }
  )
  return sub
}

function getUrl(): string {
  if (useProxyApi()) {
    return config.proxyApiUrl
  }
  return config.privateApiUrl
}

function useProxyApi(): boolean {
  return config.useProxyApi === 'true'
}

function getTokenRequestHeader(): Record<string, string> {
  const encodedClientCredentials = b64encode(`${config.clientId}:${config.clientSecret}`)
  if (useProxyApi()) {
    return {
      'X-Custom-Auth': `Basic ${encodedClientCredentials}`
    }
  }
  return { Authorization: `Basic ${encodedClientCredentials}` }
}

function getAsyncCredentialRequestHeader(accessToken: string): Record<string, string> {
  const authHeader = `Bearer ${accessToken}`
  if (useProxyApi()) {
    return {
      'X-Custom-Auth': authHeader
    }
  }
  return { Authorization: authHeader }
}
