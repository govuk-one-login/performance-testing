import http, { type Response } from 'k6/http'
import { URL } from '../jslib/url'
import { check } from 'k6'

// Resolves relative and absolute `src` and `href` paths
function resolveUrl (source: string, url: string): string {
  if (source[0] !== '/') return source // Absolute paths do not start with a forward slash
  return new URL(url).origin + source // Includes origin with relative path
}

// Returns an array of all static resource URLs in the Response HTML body
function getResourceURLs (res: Response): string[] {
  const resources: string[] = []
  res.html('*[src]:not(a)').each((_, el) => { // All elements with a `src` value excluding anchor elements
    resources.push(resolveUrl(el.attributes().src.value, res.url))
  })
  res.html('*[href]:not(a)').each((_, el) => { // All elements with a `href` value excluding anchor elements
    resources.push(resolveUrl(el.attributes().href.value, res.url))
  })
  return resources
}

// Calls a GET request for static resources defined in the HTML page of a response
export function getStaticResources (res: Response): Response[] {
  const staticResponses = http.batch(getResourceURLs(res))
  staticResponses.forEach(res => {
    check(res, {
      'is status 200': (r) => r.status === 200
    })
  })
  return staticResponses
}
