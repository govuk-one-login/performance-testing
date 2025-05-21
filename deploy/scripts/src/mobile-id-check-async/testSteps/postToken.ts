import http from 'k6/http'
import { timeGroup } from '../../common/utils/request/timing'
import { groupMap } from '../test'
import { apiSignaturev4Signer } from '../utils/apiSignatureV4Signer'
import { config } from '../utils/config'
import { b64encode } from 'k6/encoding'
import { isStatusCode200 } from '../../common/utils/checks/assertions'
import { useProxyApi } from '../utils/useProxyApi'
import { URL } from '../../common/utils/jslib/url'

export function postToken(): string {
  if (useProxyApi()) {
    return postTokenProxyApi()
  } else {
    return postTokenPrivateApi()
  }
}
function postTokenProxyApi(): string {
  const signedAsyncTokenRequest = apiSignaturev4Signer.sign({
    method: 'POST',
    protocol: 'https',
    hostname: new URL(getProxyApiUrl()).hostname,
    path: getTokenPath(),
    headers: getTokenProxyApiXCustomAuthHeader(),
    body: getTokenBody()
  })

  const asyncTokenResponse = timeGroup(
    groupMap.idCheckAsync[0],
    () =>
      http.post(signedAsyncTokenRequest.url, getTokenBody(), {
        headers: { ...signedAsyncTokenRequest.headers, ...getTokenProxyApiXCustomAuthHeader() }
      }),
    {
      isStatusCode200
    }
  )

  return asyncTokenResponse.json('access_token') as string
}

function getProxyApiUrl(): string {
  return config.proxyApiUrl
}

function getTokenPath() {
  return '/async/token'
}

function getTokenBody() {
  return 'grant_type=client_credentials'
}

function getTokenProxyApiXCustomAuthHeader() {
  return {
    'X-Custom-Auth': `Basic ${getEncodedClientCredentials()}`
  }
}

function getEncodedClientCredentials(): string {
  return b64encode(`${config.clientId}:${config.clientSecret}`)
}

function postTokenPrivateApi(): string {
  const asyncTokenResponse = timeGroup(
    groupMap.idCheckAsync[0],
    () =>
      http.post(`${getPrivateApiUrl()}${getTokenPath()}`, getTokenBody(), {
        headers: getTokenApiPrivateApiAuthorizationHeader()
      }),
    {
      isStatusCode200
    }
  )

  return asyncTokenResponse.json('access_token') as string
}

function getPrivateApiUrl(): string {
  return config.privateApiUrl
}

function getTokenApiPrivateApiAuthorizationHeader() {
  return { Authorization: `Basic ${getEncodedClientCredentials()}` }
}
