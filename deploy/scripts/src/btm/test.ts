import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { uuidv4, randomIntBetween } from '../common/utils/jslib/index'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { getEnv } from '../common/utils/config/environment-variables'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('sendEventType1', LoadProfile.smoke),
    ...createScenario('sendEventType2', LoadProfile.smoke),
    ...createScenario('sendEventType3', LoadProfile.smoke),
    ...createScenario('sendEventType4', LoadProfile.smoke),
    ...createScenario('sendEventType5', LoadProfile.smoke),
    ...createScenario('sendEventType6', LoadProfile.smoke),
    ...createScenario('sendEventType7', LoadProfile.smoke)
  },
  load: {
    ...createScenario('sendEventType1', LoadProfile.full, 5),
    ...createScenario('sendEventType2', LoadProfile.full, 5),
    ...createScenario('sendEventType3', LoadProfile.full, 5),
    ...createScenario('sendEventType4', LoadProfile.full, 5),
    ...createScenario('sendEventType5', LoadProfile.full, 5),
    ...createScenario('sendEventType6', LoadProfile.full, 5),
    ...createScenario('sendEventType7', LoadProfile.full, 5)
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
  sqs_queue: getEnv('DATA_BTM_SQS')
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})
const sqs = new SQSClient(awsConfig)

const eventData = {
  payloadEventsString: getEnv('DATA_BTM_SQS_PAYLOAD_EVENTS'),
  payloadTimestamp: getEnv('DATA_BTM_SQS_PAYLOAD_TIMESTAMP')
}

const payloadEventsArray = JSON.parse(eventData.payloadEventsString)
console.log('1 payloadEventsArray[0] = ', payloadEventsArray[0])

const payloadTimestampArray = eventData.payloadTimestamp.split(',')
const payloadTimestampMin: number = Number(payloadTimestampArray[0])
const payloadTimestampMax: number = Number(payloadTimestampArray[1])

export function sendEventType1(): void {
  const messageBody: Record<string, unknown> = payloadEventsArray[0]
  sendSQSMessage(messageBody)
}

export function sendEventType2(): void {
  const messageBody: Record<string, unknown> = payloadEventsArray[1]
  sendSQSMessage(messageBody)
}

export function sendEventType3(): void {
  const messageBody: Record<string, unknown> = payloadEventsArray[2]
  sendSQSMessage(messageBody)
}

export function sendEventType4(): void {
  const messageBody: Record<string, unknown> = payloadEventsArray[3]
  sendSQSMessage(messageBody)
}

export function sendEventType5(): void {
  const messageBody: Record<string, unknown> = payloadEventsArray[4]
  sendSQSMessage(messageBody)
}

export function sendEventType6(): void {
  const messageBody: Record<string, unknown> = payloadEventsArray[5]
  sendSQSMessage(messageBody)
}

export function sendEventType7(): void {
  const messageBody: Record<string, unknown> = payloadEventsArray[6]
  sendSQSMessage(messageBody)
}

export function sendSQSMessage(messageBody: Record<string, unknown>): void {
  const randomTimestamp: number = randomIntBetween(payloadTimestampMin, payloadTimestampMax)
  const timestampFormatted: string = new Date(randomTimestamp * 1000).toISOString()
  iterationsStarted.add(1)
  messageBody.event_id = uuidv4()
  messageBody.timestamp = randomTimestamp
  messageBody.timestamp_formatted = timestampFormatted.replace('Z', '')
  sqs.sendMessage(env.sqs_queue, JSON.stringify(messageBody))
  iterationsCompleted.add(1)
}
