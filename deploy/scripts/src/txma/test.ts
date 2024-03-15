import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { uuidv4 } from '../common/utils/jslib/index.js'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { getEnv } from '../common/utils/config/environment-variables'

const profiles: ProfileList = {
  smoke: {
    sendEventSmokeTest: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'sendEvent'
    }
  },
  load: {
    sendEventScenario: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 2250,
      stages: [
        { target: 750, duration: '15m' }, // Ramp up to 750 iterations per second in 15 minutes
        { target: 750, duration: '30m' }, // Maintain steady state at 750 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total rap down in 5 minutes
      ],
      exec: 'sendEvent'
    }
  },
  stress: {
    sendEventScenario: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 22500,
      stages: [
        { target: 7500, duration: '15m' }, // Ramp up to 7500 iterations per second in 15 minutes
        { target: 7500, duration: '30m' }, // Maintain steady state at 7500 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
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
  sqs_queue: getEnv('DATA_TXMA_SQS')
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})

const eventData = {
  payload: getEnv('DATA_TXMA_SQS_PAYLOAD')
}

const sqs = new SQSClient(awsConfig)

export function sendEvent (): void {
  const messageBody = eventData.payload.replace(/UUID/g, () => uuidv4())
  iterationsStarted.add(1)
  sqs.sendMessage(env.sqs_queue, messageBody)
  iterationsCompleted.add(1)
}
