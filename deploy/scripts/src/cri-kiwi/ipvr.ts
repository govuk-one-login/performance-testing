import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
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
  sqs.sendMessage(env.sqs_queue, JSON.stringify(f2fPayload))
  sqs.sendMessage(env.sqs_queue, JSON.stringify(docUploadPayload))
  sqs.sendMessage(env.sqs_queue, JSON.stringify(ipvPayload))
  iterationsCompleted.add(1)
}
