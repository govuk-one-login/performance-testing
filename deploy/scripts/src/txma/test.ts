import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { uuidv4 } from '../common/utils/jslib/index.js'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { getEnv } from '../common/utils/config/environment-variables'
import {
  generateAuthLogInSuccess,
  generateAuthCreateAccount,
  generateAuthAuthorisationInitiated,
  geenrateDcmawAbortWeb
} from './requestGenerator/txmaReqGen'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('sendSingleEvent', LoadProfile.smoke),
    ...createScenario('rpPairwiseMapping', LoadProfile.smoke),
    ...createScenario('clientEnrichmentFeature', LoadProfile.smoke)
  },
  load: {
    ...createScenario('sendSingleEvent', LoadProfile.full, 750, 3),
    ...createScenario('rpPairwiseMapping', LoadProfile.full, 750, 3),
    ...createScenario('clientEnrichmentFeature', LoadProfile.full, 750, 3)
  },
  stress: {
    ...createScenario('sendSingleEvent', LoadProfile.full, 7500, 3),
    ...createScenario('rpPairwiseMapping', LoadProfile.full, 7500, 3),
    ...createScenario('clientEnrichmentFeature', LoadProfile.full, 7500, 3)
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
  sqs_queue: getEnv('DATA_TXMA_SQS')
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})

const sqs = new SQSClient(awsConfig)

export function sendSingleEvent(): void {
  const userID = `perfUserSE${uuidv4()}`
  const emailID = `perfEmailSE${uuidv4()}@digital.cabinet-office.gov.uk`
  iterationsStarted.add(1)
  const authLogInSuccessPayload = JSON.stringify(generateAuthLogInSuccess(userID, emailID))
  sqs.sendMessage(env.sqs_queue, authLogInSuccessPayload)
  iterationsCompleted.add(1)
}

export function rpPairwiseMapping(): void {
  const userID = `perfUserPM${uuidv4()}`
  const emailID = `perfEmailPM${uuidv4()}@digital.cabinet-office.gov.uk`
  iterationsStarted.add(1)
  const authCreateAccPayload = JSON.stringify(generateAuthCreateAccount(userID, emailID))
  const authLogInSuccessPayload = JSON.stringify(generateAuthLogInSuccess(userID, emailID))
  sqs.sendMessage(env.sqs_queue, authCreateAccPayload)
  sleepBetween(0.5, 1)
  sqs.sendMessage(env.sqs_queue, authLogInSuccessPayload)
  iterationsCompleted.add(1)
}

export function clientEnrichmentFeature(): void {
  const userID = `perfUserCEF${uuidv4()}`
  const journeyID = `perfJourneyCEF${uuidv4()}`
  iterationsStarted.add(1)
  const authInitiatedPayload = JSON.stringify(generateAuthAuthorisationInitiated(journeyID))
  const dcmawAbortPayload = JSON.stringify(geenrateDcmawAbortWeb(userID, journeyID))
  sqs.sendMessage(env.sqs_queue, authInitiatedPayload)
  sleepBetween(0.5, 1)
  sqs.sendMessage(env.sqs_queue, dcmawAbortPayload)
  iterationsCompleted.add(1)
}
