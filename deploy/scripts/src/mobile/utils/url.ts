import { URL } from './k6/url'
import { env } from './env'

const OAUTH_ROUTE = '/dca/oauth2'

export function getUrl (
  path: string,
  base: string,
  query?: Record<string, string>
): string {
  const url = new URL(path, base)

  if (query != null) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return url.toString()
}

export function getFrontendUrl (path: string, query?: Record<string, string>): string {
  return getUrl(OAUTH_ROUTE + path, env.frontendUrl, query)
}

export function getBackendUrl (path: string, query?: Record<string, string>): string {
  return getUrl(path, env.backendUrl, query)
}
