import { Counter } from 'k6/metrics'

export const iterationsStarted = new Counter('iterations_started')
export const iterationsCompleted = new Counter('iterations_completed')
