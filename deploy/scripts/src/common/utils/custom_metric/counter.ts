import { Counter } from 'k6/metrics'

export const iterationsStarted = new Counter('Iterations_Started')
export const iterationsCompleted = new Counter('Iterations_Completed')
