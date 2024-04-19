import { type Checkers, check, fail, group } from 'k6'
import { Trend } from 'k6/metrics'

/**
 * Trend to store all recorded durations
 */
const durations = new Trend('duration', true)

/**
 * Run a code block and return the duration
 * @param fn - Code to be executed and timed
 * @returns Returns a tuple with the first value the result of the function parameter.
 * The second value is the duration, in milliseconds, of the code execution
 * @example
 * const [result, duration]: [T, number] = timeFunction(function() {
 *  ..
 * })
 */
export function timeFunction<T>(fn: () => T): [T, number] {
  const start = Date.now()
  const res = fn()
  const end = Date.now()
  return [res, end - start]
}

/**
 * Executes a code block and response checks.
 * If the checks are succesful: the duration is added to the trend.
 * If the checks fail: the iteration is aborted.
 * @param {() => T} fn - Code to be executed and timed
 * @param {Checkers<T>} [checks] Set of checker functions to use as assertions, defaults to none
 * @returns Returns the return value from calling `fn`
 * @example
 * const res = timeRequest(
 *   () => http.get(''),
 *   { 'status is 200': (r) => r.status === 200 }
 * )
 */
export function timeRequest<T>(fn: () => T, checks: Checkers<T> = {}): T {
  const [res, duration] = timeFunction(fn)
  check(res, checks) ? durations.add(duration) : fail('Response validation failed')
  return res
}

/**
 * Creates a k6 `group` and runs `timeRequest` within it
 * @param {string} name Group name to be used as a `group` tag
 * @param {() => T} fn - Code to be executed and timed
 * @param {Checkers<T>} [checks] Checkers object to assert against the response of `fn`, defaults to empty object
 * @returns Returns the return value from calling `fn`
 * @example
 * const res = timeGroup(
 *   'GET /path',
 *   () => http.get(''),
 *   { 'status is 200': (r) => r.status === 200 }
 * )
 */
export function timeGroup<T>(name: string, fn: () => T, checks: Checkers<T> = {}): T {
  return group(name, () => timeRequest(fn, checks))
}
