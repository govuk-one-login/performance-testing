import { type Response } from 'k6/http'
import { type Checkers } from 'k6'

/**
 * Function to check that a `Response` has status code 200
 * @param response - `Response` to check that status code of
 * @returns `true` if status code is `200`, `false` otherwise
 * @example
 * const res = timeRequest(
 *   () => http.get(url),
 *   { isStatusCode200 }
 * )
 */
export function isStatusCode200 (response: Response): boolean {
  return response.status === 200
}

/**
 * Function to check that a `Response` has status code 302
 * @param response - `Response` to check that status code of
 * @returns `true` if status code is `302`, `false` otherwise
 * @example
 * const res = timeRequest(
 *   () => http.get(url),
 *   { isStatusCode302 }
 * )
 */
export function isStatusCode302 (response: Response): boolean {
  return response.status === 302
}

/**
 * Generates a `Checkers<Response>` Object to validate the content of a page
 * includes the given string
 * @param content - String that the page is expected to contain
 * @returns `Checkers<Response>` object containing one named `Checker<Response`
 * function
 * @example
 * const res = timeRequest(
 *   () => http.get(url),
 *   { ...pageContentCheck('Enter your email address') }
 * )
 */
export function pageContentCheck (content: string): Checkers<Response> {
  return {
    validatePageContent: r => (r.body as string).includes(content)
  }
}
