import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { generateAuthRequest, generateF2FRequest, generateIPVRequest, generateDocumentUploadedRequest } from './requestGenerator/ipvrReqGen'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { uuidv4 } from '../common/utils/jslib/index'
import { getEnv } from '../common/utils/config/environment-variables'

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
    allEvents: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'allEvents'
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
    allEvents: {
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
      exec: 'allEvents'
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
    allEvents: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 12,
      stages: [
        { target: 12, duration: '15m' }, // Ramp up to 12 iterations/messages per second in 15 minutes
        { target: 12, duration: '30m' }, // Maintain a steady state of 12 messages per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'allEvents'
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
  sqs_queue: getEnv('IDENTITY_KIWI_STUB_SQS')
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})
const sqs = new SQSClient(awsConfig)

export function authEvent (): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const signinJourneyID = uuidv4()
  const authPayload = generateAuthRequest(userID, signinJourneyID)
  const authEventMessage = JSON.stringify(authPayload)
  iterationsStarted.add(1)
  sqs.sendMessage(env.sqs_queue, authEventMessage)
  iterationsCompleted.add(1)
}

export function allEvents (): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const signinJourneyID = uuidv4()
  const authPayload = generateAuthRequest(userID, signinJourneyID)
  const f2fPayload = generateF2FRequest(userID, signinJourneyID)
  const docUploadPayload = generateDocumentUploadedRequest(userID)
  const ipvPayload = generateIPVRequest(userID, signinJourneyID)
  iterationsStarted.add(1)
  sqs.sendMessage(env.sqs_queue, JSON.stringify(authPayload))
  sqs.sendMessage(env.sqs_queue, JSON.stringify(f2fPayload))
  sqs.sendMessage(env.sqs_queue, JSON.stringify(docUploadPayload))
  sqs.sendMessage(env.sqs_queue, JSON.stringify(ipvPayload))
  iterationsCompleted.add(1)
}
