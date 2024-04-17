import { URL } from '../../common/utils/jslib/url'
import { config } from './config'

const OAUTH_ROUTE = '/dca/oauth2'

export function buildUrl(path: string, base: string, query?: Record<string, string>): string {
  const url = new URL(path, base)

  if (query != null) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return url.toString()
}

export function buildFrontendUrl(path: string, query?: Record<string, string>): string {
  return buildUrl(OAUTH_ROUTE + path, config.frontendUrl, query)
}

export function buildBackendUrl(path: string, query?: Record<string, string>): string {
  return buildUrl(path, config.backendUrl, query)
}
