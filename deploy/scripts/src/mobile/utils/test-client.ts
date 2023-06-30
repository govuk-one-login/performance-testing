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
  const queryParams = apiLocation.split('?')[1].split('&')
  const requestJwt = queryParams
    .filter((value) => value.startsWith('request'))[0]
    .split('=')[1]
  const clientId = queryParams
    .filter((value) => value.startsWith('client_id'))[0]
    .split('=')[1]

  return buildBackendUrl('verifyAuthorizeRequest', {
    client_id: clientId,
    response_type: 'code',
    request: requestJwt
  })
}
