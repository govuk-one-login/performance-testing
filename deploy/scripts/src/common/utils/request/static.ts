import http, { type ObjectBatchRequest, type Response } from 'k6/http';
import { URL } from '../jslib/url';

/**
 * Returns an array of all static resource URLs in the Response HTML body
 * @param {Response} res Response containing links to static resources
 * @returns {URL[]} Array of URLs of the static assets on the page
 */
function getResourceURLs(res: Response): URL[] {
  const resources: URL[] = [];
  res.html('[src]:not(a)').each((_, el) => {
    // All elements with a `src` attribute excluding anchor elements
    resources.push(new URL(el.attributes().src.value, res.url));
  });
  res.html('link[href]').each((_, el) => {
    // Link elements with a `href` attribute
    resources.push(new URL(el.attributes().href.value, res.url));
  });
  return resources.filter((url) => url.hostname.endsWith('.account.gov.uk')); // Only retrieve URLs accessible to the load injector
}

/**
 * Calls a GET request for static resources defined in the HTML page of a response
 * @param {Response} res Response containing links to static resources
 * @returns {Response[]} Response array returned from `http.batch` query of static assets
 * @example
 * const response: Response = http.get(url)
 * const staticResponses: Response[] = getStaticResources(response)
 */
export function getStaticResources(res: Response): Response[] {
  const urls = getResourceURLs(res);
  const requests: ObjectBatchRequest[] = urls.map((url) => {
    return {
      method: 'GET',
      url: url.href,
      params: { responseType: 'none' }
    };
  });
  return http.batch(requests);
}
