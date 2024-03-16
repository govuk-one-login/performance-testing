import http from 'k6/http'
import { type Options } from 'k6/options'
import { group, sleep } from 'k6'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { timeRequest } from '../common/utils/request/timing'
import { getEnv } from '../common/utils/config/environment-variables'

const profiles: ProfileList = {
  smoke: {
    demoSamApp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1m',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 6, duration: '10s' }, // Ramps up to target load
        { target: 6, duration: '10s' } // Holds at target load
      ],
      exec: 'demoSamApp'
    },
    demoNodeApp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1m',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 6, duration: '10s' }, // Ramps up to target load
        { target: 6, duration: '10s' } // Holds at target load
      ],
      exec: 'demoNodeApp'
    }
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
  },
  stress: {
    demoNodeApp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 400,
      stages: [
        { target: 200, duration: '120s' }, // Ramps up to target load
        { target: 200, duration: '120s' } // Holds at target load
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
  FE_URL: getEnv('DEMO_NODE_ENDPOINT').replace(/\/$/, ''), // Output from demoNodeApp `CFN_HelloWorldApi`
  BE_URL: getEnv('DEMO_SAM_ENDPOINT').replace(/\/$/, '') // Output from demoSamApp `CFN_ApiGatewayEndpoint`
}

export function demoSamApp (): void {
  group('GET - {demoSamApp} /test', () =>
    timeRequest(() => http.get(env.BE_URL + '/test'),
      { isStatusCode200, 'verify page content': r => JSON.parse(r.body as string).code === 'success' }
    ))

  sleep(1)
}

export function demoNodeApp (): void {
  group('GET - {demoNodeApp} /toy', () =>
    timeRequest(() => http.get(env.FE_URL + '/toy'),
      { isStatusCode200, ...pageContentCheck('We need to ask you about your favourite toy') }
    )
  )
  sleep(1)
}
