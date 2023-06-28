import http, { type Response } from 'k6/http'
import { buildUrl } from './url'
import { config } from './config'

export function postTestClientStart (): Response {
  return http.post(
    buildUrl('start', config.testClientExecuteUrl),
    JSON.stringify({ frontendUri: config.frontendUrl }),
    {
      tags: { name: 'Post request to authorize URL' },
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

export function parseTestClientResponse (response: Response, location: 'WebLocation' | 'ApiLocation'): string {
  const url = response.json(location)
  if (typeof url !== 'string') {
    throw new Error('Failed to parse URL from response')
  }

  return url
}
