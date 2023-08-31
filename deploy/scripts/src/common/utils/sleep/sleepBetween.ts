import { sleep } from 'k6'

export function sleepBetween (min: number, max: number): void {
  sleep(min + Math.random() * Math.abs(max - min))
}
