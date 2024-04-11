import { type Checkers, check, fail } from 'k6';
import { Trend } from 'k6/metrics';

/**
 * Trend to store all recorded durations
 */
const durations = new Trend('duration', true);

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
  const start = Date.now();
  const res = fn();
  const end = Date.now();
  return [res, end - start];
}

/**
 * Executes a code block and response checks.
 * If the checks are succesful: the duration is added to the trend.
 * If the checks fail: the iteration is aborted.
 * @param fn - Code to be executed and timed
 * @returns Returns the return value from calling `fn`
 * @example
 * const res = timeRequest(
 *   () => http.get(''),
 *   { 'status is 200': (r) => r.status === 200 }
 * )
 */
export function timeRequest<T>(fn: () => T, checks: Checkers<T>): T {
  const [res, duration] = timeFunction(fn);
  check(res, checks)
    ? durations.add(duration)
    : fail('Response validation failed');
  return res;
}
