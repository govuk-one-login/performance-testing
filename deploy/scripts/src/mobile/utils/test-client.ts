import http, { type Response } from 'k6/http'
import { getUrl } from './url'
import { env } from './config'

export function postTestClientStart (): Response {
  return http.post(
    getUrl('start', env.testClientExecuteUrl),
    JSON.stringify({ frontendUri: env.frontendUrl }),
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
