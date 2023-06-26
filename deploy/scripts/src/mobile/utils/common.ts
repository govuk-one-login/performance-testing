import http, { type Response } from 'k6/http'
import { check } from 'k6'
import { getUrl } from './url'

export const env = {
  testClientExecuteUrl: __ENV.MOBILE_TEST_CLIENT_EXECUTE_URL,
  backendUrl: __ENV.MOBILE_BACKEND_URL,
  frontendUrl: __ENV.MOBILE_FRONTEND_URL
}

export const OAUTH_ROUTE = '/dca/oauth2'

export function isStatusCode200 (res: Response): boolean {
  return check(res, {
    'is status 200': (r) => r.status === 200
  })
}

export function isStatusCode201 (res: Response): boolean {
  return check(res, {
    'is status 201': (r) => r.status === 201
  })
}

export function isStatusCode302 (res: Response): boolean {
  return check(res, {
    'is status 302': (r) => r.status === 302
  })
}

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
  const authorizeUrl = response.json(location)
  if (typeof authorizeUrl !== 'string') {
    throw new Error('Failed to parse authorize URL from response')
  }

  return authorizeUrl
}
