import http from 'k6/http'
import { isStatusCode201 } from '../../common/utils/checks/assertions'
import { timeGroup } from '../../common/utils/request/timing'
import { apiSignaturev4Signer } from '../utils/apiSignatureV4Signer'
import { config } from '../utils/config'
import { useProxyApi } from '../utils/useProxyApi'
import { URL } from '../../common/utils/jslib/url'

interface PostCredentialConfig {
  accessToken: string
  sub: string
}

export function postCredential(groupName: string, postCredentialConfig: PostCredentialConfig): string {
  const { sub, accessToken } = postCredentialConfig
  if (useProxyApi()) {
    postCredentialProxyApi(groupName, { sub, accessToken })
  } else {
    postCredentialPrivateApi(groupName, { sub, accessToken })
  }
  return sub
}

function postCredentialProxyApi(groupName: string, postCredentialConfig: PostCredentialConfig): string {
  const { sub, accessToken } = postCredentialConfig
  const signedAsyncCredentialRequest = apiSignaturev4Signer.sign({
    method: 'POST',
    protocol: 'https',
    hostname: new URL(getProxyApiUrl()).hostname,
    path: getCredentialPath(),
    headers: getCredentialProxyApiXCustomAuthHeader(accessToken),
    body: getCredentialBody(sub)
  })

  const asyncCredentialResponse = timeGroup(
    groupName,
    () =>
      http.post(signedAsyncCredentialRequest.url, getCredentialBody(sub), {
        headers: { ...signedAsyncCredentialRequest.headers, ...getCredentialProxyApiXCustomAuthHeader(accessToken) }
      }),
    {
      isStatusCode201
    }
  )

  return asyncCredentialResponse.json('access_token') as string
}

function getProxyApiUrl(): string {
  return config.proxyApiUrl
}

function getCredentialPath() {
  return '/async/credential'
}

function getCredentialProxyApiXCustomAuthHeader(accessToken: string): Record<string, string> {
  const authHeader = `Bearer ${accessToken}`
  return {
    'X-Custom-Auth': authHeader
  }
}

function getCredentialBody(sub: string): string {
  return JSON.stringify({
    state: 'mockState',
    sub,
    client_id: config.clientId,
    govuk_signin_journey_id: 'performanceTest'
  })
}

function postCredentialPrivateApi(groupName: string, postCredentialConfig: PostCredentialConfig): string {
  const { sub, accessToken } = postCredentialConfig
  const ayncCredentialResponse = timeGroup(
    groupName,
    () =>
      http.post(`${getPrivateApiUrl()}${getCredentialPath()}`, getCredentialBody(sub), {
        headers: getCredentialPrivateApiAuthorizationHeader(accessToken)
      }),
    {
      isStatusCode201
    }
  )

  return ayncCredentialResponse.json('session_id') as string
}

function getPrivateApiUrl(): string {
  return config.privateApiUrl
}

function getCredentialPrivateApiAuthorizationHeader(accessToken: string): Record<string, string> {
  const authHeader = `Bearer ${accessToken}`
  return {
    Authorization: authHeader
  }
}
