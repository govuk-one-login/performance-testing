import { type Options } from 'k6/options'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { uuidv4 } from '../common/utils/jslib/index.js'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { type AssumeRoleOutput } from '../common/utils/aws/types'

const profiles: ProfileList = {
  smoke: {
    sendEventSmokeTest1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 2,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'sendEvent'
    },
    sendEventSmokeTest2: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 2,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'sendEventDebug'
    }
  },
  load: {
    sendEventLoadTest1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 350,
      stages: [
        { target: 10, duration: '10m' } // Ramp up to 10 iterations per second in 10 minutes
      ],
      exec: 'sendEvent'
    },
    sendEventLoadTest2: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 700,
      stages: [
        { target: 20, duration: '10m' } // Ramp up to 20 iterations per second in 10 minutes
      ],
      exec: 'sendEvent'
    },
    sendEventLoadTest3: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1500,
      stages: [
        { target: 30, duration: '10m' } // Ramp up to 30 iterations per second in 10 minutes
      ],
      exec: 'sendEvent'
    },
    sendEventLoadTest4: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1500,
      stages: [
        { target: 30, duration: '60m' } // Ramp up to 30 iterations per second in 60 minutes
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

export async function sendEvent (): Promise<void> {
  const messageBody = eventData.payload.replace(/UUID/g, () => uuidv4())
  await sqs.sendMessage(env.sqs_queue, messageBody)
}

export async function sendEventDebug (): Promise<void> {
  const messageBody = eventData.payload.replace('UUID', uuidv4())
  await sqs.sendMessage(env.sqs_queue, messageBody)
  console.log('1 === debug === env.sqs_queue', env.sqs_queue)
  console.log('2 === debug === awsConfig', awsConfig)
  console.log('3 === debug === payload', eventData.payload)
  console.log('4 === debug === messageBody', messageBody)
}
