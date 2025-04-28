import http from "k6/http"
import { timeGroup } from "../../common/utils/request/timing"
import { groupMap } from "../test"
import { SignatureV4 } from "../../common/utils/jslib/aws-signature"
import { config } from "../utils/config"
import { b64encode } from "k6/encoding"
import { isStatusCode200, isStatusCode201 } from "../../common/utils/checks/assertions"
import { sleepBetween } from "../../common/utils/sleep/sleepBetween"

import { URL } from "../../common/utils/jslib/url"
import { uuidv4 } from "../../common/utils/jslib"

export function createSession(): { sessionId: string } {
  const credentials = JSON.parse(config.awsExecutionCredentials)
  const apiGatewaySigner = new SignatureV4({
    service: 'execute-api',
    region: "eu-west-2",
    credentials: {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    },
    uriEscapePath: false,
    applyChecksum: false
  })
  const asyncTokenRequestBody = "grant_type=client_credentials"
  const signedAsyncTokenRequest = apiGatewaySigner.sign({
    method: 'POST',
    protocol: 'https',
    hostname: new URL(getUrl()).hostname,
    path: "/async/token",
    headers: getTokenRequestHeader(),
    body: asyncTokenRequestBody
  })

  const asyncTokenResponse = timeGroup(groupMap.idCheckAsync[0], () => http.post(signedAsyncTokenRequest.url, asyncTokenRequestBody, { headers: { ...signedAsyncTokenRequest.headers, ...getTokenRequestHeader() } }), {
    isStatusCode200
  })

  sleepBetween(0.5, 1)

  const asyncCredentialRequestBody = {
    "state": "mockState",
    "sub": uuidv4(),
    "client_id": config.clientId,
    "govuk_signin_journey_id": "performanceTest"
  }

  const accessToken = asyncTokenResponse.json('access_token') as string

  const signedAsyncCredentialRequest = apiGatewaySigner.sign({
    method: 'POST',
    protocol: 'https',
    hostname: new URL(getUrl()).hostname,
    path: "/async/credential",
    headers: getCredentialRequestHeader(accessToken),
    body: JSON.stringify(asyncCredentialRequestBody)
  })

  timeGroup(groupMap.idCheckAsync[1], () => http.post(signedAsyncCredentialRequest.url, JSON.stringify(asyncCredentialRequestBody), { headers: { ...signedAsyncCredentialRequest.headers, ...getCredentialRequestHeader(accessToken) } }), {
    isStatusCode201
  })
  throw Error("STS mock + active session")
  return { sessionId: "" }
}

function getUrl(): string {
  if (useProxyApi()) {
    return config.proxyApiUrl
  }
  return config.privateApiUrl
}

function useProxyApi(): boolean {
  return config.useProxyApi === "true"
}

function getTokenRequestHeader(): Record<string, string> {
  const encodedClientCredentials = b64encode(`${config.clientId}:${config.clientSecret}`)
  if (useProxyApi()) {
    return {
      "X-Custom-Auth": `Basic ${encodedClientCredentials}`
    }
  }
  return { Authorization: `Basic ${encodedClientCredentials}` }
}

function getCredentialRequestHeader(accessToken: string): Record<string, string> {
  const authHeader = `Bearer ${accessToken}`
  if (useProxyApi()) {
    return {
      "X-Custom-Auth": authHeader
    }
  }
  return { Authorization: authHeader }
}
