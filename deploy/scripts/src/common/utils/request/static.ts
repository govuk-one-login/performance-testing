import http, { type ObjectBatchRequest, type Response } from 'k6/http'
import { URL } from '../jslib/url'

// Resolves relative and absolute `src` and `href` paths
export function resolveUrl (source: string, url: string): string {
  if (source[0] !== '/') return source // Absolute paths do not start with a forward slash
  return new URL(url).origin + source // Includes origin with relative path
}

// Returns an array of all static resource URLs in the Response HTML body
function getResourceURLs (res: Response): string[] {
  const resources: string[] = []
  res.html('[src]:not(a)').each((_, el) => { // All elements with a `src` attribute excluding anchor elements
    resources.push(resolveUrl(el.attributes().src.value, res.url))
  })
  res.html('link[href]').each((_, el) => { // Link elements with a `href` attribute
    resources.push(resolveUrl(el.attributes().href.value, res.url))
  })
  return resources
}

// Calls a GET request for static resources defined in the HTML page of a response
export function getStaticResources (res: Response): Response[] {
  const urls = getResourceURLs(res)
  const requests: ObjectBatchRequest[] = urls.map(url => {
    return {
      method: 'GET',
      url,
      params: { responseType: 'none' }
    }
  })
  return http.batch(requests)
}
