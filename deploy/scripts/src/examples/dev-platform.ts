import http from 'k6/http'
import { type Options } from 'k6/options'
import { group, sleep } from 'k6'
import { selectProfile, type ProfileList, describeProfile, createScenario, LoadProfile } from '../common/utils/config/load-profiles'
import { isStatusCode200 } from '../common/utils/checks/assertions'
import { timeRequest } from '../common/utils/request/timing'
import { getEnv } from '../common/utils/config/environment-variables'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('demoSamApp', LoadProfile.smoke),
    ...createScenario('demoNodeApp', LoadProfile.smoke)
  },
  load: {
    demoSamApp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1m',
      preAllocatedVUs: 1,
      maxVUs: 50,
      stages: [
        { target: 60, duration: '120s' }, // Ramps up to target load
        { target: 60, duration: '120s' } // Holds at target load
      ],
      exec: 'demoSamApp'
    },
    demoNodeApp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1m',
      preAllocatedVUs: 1,
      maxVUs: 50,
      stages: [
        { target: 60, duration: '120s' }, // Ramps up to target load
        { target: 60, duration: '120s' } // Holds at target load
      ],
      exec: 'demoNodeApp'
    }
  }
}
const loadProfile = selectProfile(profiles)

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95th percntile response time <1000ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
}

export function setup (): void {
  describeProfile(loadProfile)
}

const env = {
  FE_URL: getEnv('CFN_HelloWorldApi').replace(/\/$/, ''), // Output from demoNodeApp
  BE_URL: getEnv('CFN_ApiGatewayEndpoint').replace(/\/$/, '') // Output from demoNodeApp
}

export function demoSamApp (): void {
  group('GET - {demoSamApp} /test', () =>
    timeRequest(() => http.get(env.BE_URL + '/test'),
      { isStatusCode200, 'verify page content': r => JSON.parse(r.body as string).code === 'success' }
    ))

  sleep(1)
}

export function demoNodeApp (): void {
  group('GET - {demoNodeApp}', () =>
    timeRequest(() => http.get(env.FE_URL),
      { isStatusCode200, 'verify page content': r => JSON.parse(r.body as string).message === 'hello world' }
    ))

  sleep(1)
}
