import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import { selectProfile, type ProfileList, describeProfile, createScenario, LoadProfile } from '../common/utils/config/load-profiles'
import { uuidv4 } from '../common/utils/jslib/index.js'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { getEnv } from '../common/utils/config/environment-variables'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('sendEvent', LoadProfile.smoke)
  },
  load: {
    ...createScenario('sendEvent', LoadProfile.full, 750, 3)
  },
  stress: {
    ...createScenario('sendEvent', LoadProfile.full, 7500, 3)
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
