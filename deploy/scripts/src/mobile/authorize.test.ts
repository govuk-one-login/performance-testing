import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile
} from '../common/utils/config/load-profiles'
import {
  startJourney
} from './testSteps/frontend'

const profiles: ProfileList = {
  smoke: {
    startJourney: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 5, duration: '30s' }, // linear increase from 1 iteration per second to 5 iterations per second for 30 seconds
        { target: 5, duration: '30s' } // maintain 5 iterations per second for 30 seconds
      ],
      exec: 'authorize'
    }
  },
  load: {
    startJourney: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 50, // Calculation: 100 journeys / second * 0.5 seconds average journey time
      maxVUs: 200, // Calculation: 100 journeys / second * 2 seconds maximum journey time
      stages: [
        { target: 100, duration: '15m' }, // linear increase from 0 iteration per second to 100 iterations per second for 15 min -> 0.11 t/s/s
        { target: 100, duration: '30m' } // maintain 100 iterations per second for 30 min
      ],
      exec: 'authorize'
    }
  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'], // 95th percentile response time <=1000ms, 99th percentile response time <=2500ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
}

export function setup (): void {
  describeProfile(loadProfile)
}

export function authorize (): void {
  startJourney()
}
