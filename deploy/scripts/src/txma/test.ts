import { type Options } from 'k6/options'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { uuidv4 } from '../common/utils/jslib/index.js'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { type AssumeRoleOutput } from '../common/utils/aws/types'

const profiles: ProfileList = {
  smoke: {
    sendEventSmokeTest: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 2,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'sendEvent'
    }
  },
  load30: {
    sendEventScenario: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 300,
      stages: [
        { target: 30, duration: '10m' } // Ramp up to 30 iterations per second in 10 minutes
      ],
      exec: 'sendEvent'
    },
  },
  load100: {
    ssendEventScenario: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1000,
      stages: [
        { target: 100, duration: '10m' } // Ramp up to 100 iterations per second in 10 minutes
      ],
      exec: 'sendEvent'
    },
  },
  load500: {
    sendEventScenario: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1500,
      stages: [
        { target: 500, duration: '10m' } // Ramp up to 500 iterations per second in 10 minutes
      ],
      exec: 'sendEvent'
    },
  },
    load1000: {
      sendEventScenario: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 2000,
      stages: [
        { target: 1000, duration: '10m' } // Ramp up to 1000 iterations per second in 10 minutes
      ],
      exec: 'sendEvent'
    },
  },
    load1500: {
      sendEventScenario: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 3000,
      stages: [
        { target: 1500, duration: '10m' } // Ramp up to 1500 iterations per second in 10 minutes
      ],
      exec: 'sendEvent'
    },
  },
    load2000: {
      sendEventScenario: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 3000,
      stages: [
        { target: 2000, duration: '10m' } // Ramp up to 2000 iterations per second in 10 minutes
      ],
      exec: 'sendEvent'
    },
  },
    loadFull2000: {
      sendEventScenario: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 3000,
      stages: [
        { target: 2000, duration: '60m' } // Ramp up to 2000 iterations per second in 60 minutes
      ],
      exec: 'sendEvent'
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

const env = {
  sqs_queue: __ENV.DATA_TXMA_SQS
}

const credentials = (JSON.parse(__ENV.EXECUTION_CREDENTIALS) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: __ENV.AWS_REGION,
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})

const eventData = {
  payload: __ENV.DATA_TXMA_SQS_PAYLOAD
}

const sqs = new SQSClient(awsConfig)

export function sendEvent (): void {
  const messageBody = eventData.payload.replace(/UUID/g, () => uuidv4())
  sqs.sendMessage(env.sqs_queue, messageBody)
}
