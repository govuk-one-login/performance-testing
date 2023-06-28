import { type Options } from 'k6/options'

import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'

import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'
import { AWSConfig, SQSClient } from 'https://jslib.k6.io/aws/0.7.2/sqs.js'

const profiles: ProfileList = {
  smoke: {
    sendEventSmokeTest1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 2,
      stages: [
        { target: 1, duration: '5s' } // Ramps up to target load
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
  sqs_queue: __ENV.TXMA_AWS_SQS_QUEUE
}

const awsConfig = new AWSConfig({
  region: __ENV.TXMA_AWS_REGION,
  accessKeyId: __ENV.TXMA_AWS_ACCESS_KEY_ID,
  secretAccessKey: __ENV.TXMA_AWS_SECRET_ACCESS_KEY,
  sessionToken: __ENV.TXMA_AWS_SESSION_TOKEN
})

const eventData = {
  payload: __ENV.TXMA_DATA_001
  // payload: __ENV.BTM_DATA_001
}

const sqs = new SQSClient(awsConfig)

export function sendEvent (): void {
  const messageBody = eventData.payload.replace(/UUID/g, () => uuidv4())

  sqs.sendMessage(env.sqs_queue, messageBody)

  console.log('3 === debug === messageBody', messageBody)
}

