import { type Options } from 'k6/options'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { generateAuthRequest, generateF2FRequest, generateIPVRequest } from './requestGenerator/ipvrReqGen'
import { type AssumeRoleOutput } from '../common/utils/aws/types'

const profiles: ProfileList = {
  smoke: {
    authEvent: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'authEvent'
    },
    f2fEvent: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'authEvent'
    },
    ipvEvent: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'authEvent'
    }
  },
  lowVolumeTest: {
    authEvent: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 60,
      stages: [
        { target: 30, duration: '5m' }, // Ramp up to 30 iterations/messages per second in 5 minutes
        { target: 30, duration: '15m' }, // Maintain a steady state of 5 messages per second for 15 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'authEvent'
    },
    f2fEvent: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 6,
      stages: [
        { target: 3, duration: '2m' }, // Ramp up to 3 iterations/messages per second in 2 minutes
        { target: 3, duration: '15m' }, // Maintain a steady state of 3 messages per second for 15 minutes
        { target: 0, duration: '3m' } // Total ramp down in 3 minutes
      ],
      exec: 'authEvent'
    },
    ipvEvent: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 6,
      stages: [
        { target: 3, duration: '2m' }, // Ramp up to 3 iterations/messages per second in 2 minutes
        { target: 3, duration: '15m' }, // Maintain a steady state of 3 messages per second for 15 minutes
        { target: 0, duration: '3m' } // Total ramp down in 3 minutes
      ],
      exec: 'authEvent'
    }
  },
  stress: {
    authEvent: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 4000,
      stages: [
        { target: 2000, duration: '15m' }, // Ramp up to 2000 iterations/messages per second in 15 minutes
        { target: 2000, duration: '30m' }, // Maintain a steady state of 2000 messages per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'authEvent'
    },
    f2fEvent: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 12,
      stages: [
        { target: 6, duration: '15m' }, // Ramp up to 6 iterations/messages per second in 15 minutes
        { target: 6, duration: '30m' }, // Maintain a steady state of 6 messages per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'authEvent'
    },
    ipvEvent: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 12,
      stages: [
        { target: 6, duration: '15m' }, // Ramp up to 6 iterations/messages per second in 15 minutes
        { target: 6, duration: '30m' }, // Maintain a steady state of 6 messages per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'authEvent'
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
  sqs_queue: __ENV.IDENTITY_KIWI_STUB_SQS
}

const credentials = (JSON.parse(__ENV.EXECUTION_CREDENTIALS) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: __ENV.AWS_REGION,
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})
const sqs = new SQSClient(awsConfig)

export function authEvent (): void {
  const payload = generateAuthRequest()

  const authEventMessage = {
    messageBody: JSON.stringify(payload)
  }

  sqs.sendMessage(env.sqs_queue, authEventMessage.messageBody)
}

export function f2fEvent (): void {
  const payload = generateF2FRequest()

  const f2fEventMessage = {
    messageBody: JSON.stringify(payload)
  }

  sqs.sendMessage(env.sqs_queue, f2fEventMessage.messageBody)
}

export function ipvEvent (): void {
  const payload = generateIPVRequest()

  const ipvEventMessage = {
    messageBody: JSON.stringify(payload)
  }

  sqs.sendMessage(env.sqs_queue, ipvEventMessage.messageBody)
}
