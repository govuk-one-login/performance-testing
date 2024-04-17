import { sleep } from 'k6'

/**
 * Utility to `sleep` a VU for a random time between a given minimum and
 * maximum duration (inclusive)
 * @param {number} min Minimum time to sleep (in seconds)
 * @param {number} max Maximum time to sleep (in seconds)
 * @example
 * sleep(3, 5) // Sleeps for between 1 to 3 seconds
 * sleep(0.5, 1.5) // Sleeps for between half a second and 1.5 seconds
 */
export function sleepBetween(min: number, max: number): void {
  sleep(min + Math.random() * Math.abs(max - min))
}
