import http, { type Response } from 'k6/http'
import { buildBackendUrl, buildUrl } from './url'
import { config } from './config'

export function postTestClientStart (): Response {
  return http.post(
    buildUrl('start', config.testClientExecuteUrl),
    JSON.stringify({
      target: config.backendUrl,
      frontendUri: config.frontendUrl
    }),
    {
      tags: { name: 'Post request to authorize URL' },
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

export function parseTestClientResponse (
  response: Response,
  location: 'WebLocation' | 'ApiLocation'
): string {
  const url = response.json(location)
  if (typeof url !== 'string') {
    throw new Error('Failed to parse URL from response')
  }
  if (location === 'ApiLocation') {
    return parseApiLocation(url)
  } else {
    return url
  }
}

function parseApiLocation (apiLocation: string): string {
  const requestJwt = parseQueryParams(apiLocation, 'request')
  const clientId = parseQueryParams(apiLocation, 'client_id')

  return buildBackendUrl('verifyAuthorizeRequest', {
    client_id: clientId,
    response_type: 'code',
    request: requestJwt
  })
}

function parseQueryParams (location: string, parameterName: string): string {
  return location.split('?')[1].split('&').filter((value) => value.startsWith(parameterName))[0].split('=')[1]
}
