import { Counter } from 'k6/metrics';

/**
 * `Counter` metric to track the number of iterations started.
 *  Used at the start of a test scenario function
 * @example
 * export function test (): void {
 *  iterationsStarted.add(1)
 *  ...
 * }
 */
export const iterationsStarted = new Counter('iterations_started');

/**
 * `Counter` metric to track the number of iterations completed.
 * Used at the end of a test scenario function
 * @example
 * export function test (): void {
 *  ...
 *  iterationsCompleted.add(1)
 * }
 */
export const iterationsCompleted = new Counter('iterations_completed');
