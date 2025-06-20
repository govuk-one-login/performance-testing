import { type Response } from 'k6/http'
import { type Checkers } from 'k6'

/**
 * Function to check that a `Response` has status code 200/OK
 * @param {Response} response `Response` to check that status code of
 * @returns {boolean} `true` if status code is `200`, `false` otherwise
 * @example
 * const res = timeRequest(
 *   () => http.get(url),
 *   { isStatusCode200 }
 * )
 */
export function isStatusCode200(response: Response): boolean {
  return response.status === 200
}

/**
 * Function to check that a `Response` has status code 201/Created
 * @param {Response} response `Response` to check that status code of
 * @returns {boolean} `true` if status code is `201`, `false` otherwise
 * @example
 * const res = timeRequest(
 *   () => http.get(url),
 *   { isStatusCode201 }
 * )
 */
export function isStatusCode201(response: Response): boolean {
  return response.status === 201
}

/**
 * Function to check that a `Response` has status code 202/Accepted
 * @param {Response} response `Response` to check that status code of
 * @returns {boolean} `true` if status code is `202`, `false` otherwise
 * @example
 * const res = timeRequest(
 *   () => http.get(url),
 *   { isStatusCode202 }
 * )
 */
export function isStatusCode202(response: Response): boolean {
  return response.status === 202
}

/**
 * Function to check that a `Response` has status code 302/Found
 * @param {Response} response `Response` to check that status code of
 * @returns {boolean} `true` if status code is `302`, `false` otherwise
 * @example
 * const res = timeRequest(
 *   () => http.get(url),
 *   { isStatusCode302 }
 * )
 */
export function isStatusCode302(response: Response): boolean {
  return response.status === 302
}

/**
 * Generates a `Checkers<Response>` Object to validate the content of a page
 * includes the given string
 * @param {string} content String that the page is expected to contain
 * @returns {Checkers<Response>} `Checkers<Response>` object containing one
 * named `Checker<Response` function
 * @example
 * const res = timeRequest(
 *   () => http.get(url),
 *   { ...pageContentCheck('Enter your email address') }
 * )
 */
export function pageContentCheck(content: string): Checkers<Response> {
  return {
    validatePageContent: r => (r.body as string).includes(content)
  }
}

/**
 * Generates a k6 check function for a specific HTTP status code.
 * @param {number} expectedStatus The status code to check for.
 * @returns {Checkers<Response>} An object containing a named check function.
 */

export function isSpecificStatusCode(expectedStatus: number): Checkers<Response> {
  return {
    [`isStatusCode${expectedStatus}`]: (res: Response) => res.status === expectedStatus
  }
}
