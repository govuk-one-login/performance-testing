import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI3SpikeSignUpScenario,
  createI3SpikeSignInScenario,
  createI4PeakTestSignUpScenario,
  createI4PeakTestSignInScenario
} from '../common/utils/config/load-profiles'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import {
  generateAuthRequest,
  generateF2FRequest,
  generateIPVRequest,
  generateDocumentUploadedRequest
} from './requestGenerator/ipvrReqGen'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { uuidv4 } from '../common/utils/jslib/index'
import { getEnv } from '../common/utils/config/environment-variables'
import { sleep } from 'k6'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('authEvent', LoadProfile.smoke),
    ...createScenario('allEvents', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('authEvent', LoadProfile.short, 30, 2),
    ...createScenario('allEvents', LoadProfile.short, 3, 2)
  },
  stress: {
    ...createScenario('authEvent', LoadProfile.full, 2000, 2),
    ...createScenario('allEvents', LoadProfile.full, 12, 2)
  },
  perf006Iteration2PeakTest: {
    authEvent: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 11, duration: '6s' },
        { target: 11, duration: '30m' }
      ],
      exec: 'authEvent'
    },
    allEvents: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 3, duration: '4s' },
        { target: 3, duration: '30m' }
      ],
      exec: 'allEvents'
    }
  },
  spikeI2HighTraffic: {
    ...createScenario('authEvent', LoadProfile.spikeI2HighTraffic, 32),
    ...createScenario('allEvents', LoadProfile.spikeI2HighTraffic, 1)
  },
  perf006Iteration3PeakTest: {
    authEvent: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 24, duration: '12s' },
        { target: 24, duration: '30m' }
      ],
      exec: 'authEvent'
    },
    allEvents: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 4, duration: '5s' },
        { target: 4, duration: '30m' }
      ],
      exec: 'allEvents'
    }
  },
  perf006Iteration3SpikeTest: {
    ...createI3SpikeSignUpScenario('allEvents', 12, 20, 13),
    ...createI3SpikeSignInScenario('authEvent', 71, 5, 7)
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('allEvents', 12, 20, 13),
    ...createI4PeakTestSignInScenario('authEvent', 43, 5, 21)
  },
  perf006Iteration5SpikeTest: {
    ...createI3SpikeSignUpScenario('allEvents', 28, 20, 29),
    ...createI3SpikeSignInScenario('authEvent', 162, 5, 74)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('allEvents', 5, 20, 6),
    ...createI4PeakTestSignInScenario('authEvent', 71, 5, 33)
  },
  perf006Iteration8PeakTest: {
    ...createI4PeakTestSignUpScenario('allEvents', 4, 20, 5),
    ...createI4PeakTestSignInScenario('authEvent', 126, 5, 58)
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

export function setup(): void {
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

export function authEvent(): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const signinJourneyID = uuidv4()
  const authPayload = generateAuthRequest(userID, signinJourneyID)
  const authEventMessage = JSON.stringify(authPayload)
  iterationsStarted.add(1)
  sqs.sendMessage(env.sqs_queue, authEventMessage)
  iterationsCompleted.add(1)
}

export function allEvents(): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const signinJourneyID = uuidv4()
  const authPayload = generateAuthRequest(userID, signinJourneyID)
  const f2fPayload = generateF2FRequest(userID, signinJourneyID)
  const docUploadPayload = generateDocumentUploadedRequest(userID)
  const ipvPayload = generateIPVRequest(userID, signinJourneyID)
  iterationsStarted.add(1)
  sqs.sendMessage(env.sqs_queue, JSON.stringify(authPayload))
  sleep(10)
  sqs.sendMessage(env.sqs_queue, JSON.stringify(f2fPayload))
  sleep(10)
  sqs.sendMessage(env.sqs_queue, JSON.stringify(docUploadPayload))
  sleep(10)
  sqs.sendMessage(env.sqs_queue, JSON.stringify(ipvPayload))
  iterationsCompleted.add(1)
}
