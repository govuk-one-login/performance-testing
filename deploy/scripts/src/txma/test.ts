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
  generateAuthReqParsed,
  generateDcmawAbortWeb
} from '../common/requestGenerator/txmaReqGen'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('sendSingleEvent', LoadProfile.smoke),
    ...createScenario('sendRegularEvent', LoadProfile.smoke),
    ...createScenario('pairwiseMappingClientEnrichment', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('sendSingleEvent', LoadProfile.short, 30, 2),
    ...createScenario('sendRegularEvent', LoadProfile.short, 30, 2),
    ...createScenario('pairwiseMappingClientEnrichment', LoadProfile.short, 30, 4)
  },
  load: {
    ...createScenario('sendRegularEvent', LoadProfile.full, 2000, 2),
    ...createScenario('sendSingleEvent', LoadProfile.full, 750, 2),
    ...createScenario('pairwiseMappingClientEnrichment', LoadProfile.full, 100, 4)
  },
  stress: {
    ...createScenario('sendSingleEvent', LoadProfile.full, 7500, 2),
    ...createScenario('pairwiseMappingClientEnrichment', LoadProfile.full, 7500, 4)
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

export function setup(): string {
  describeProfile(loadProfile)
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') // YYMMDDTHHmmss
  const testID = `perfTestID${timestamp}`
  const userID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestCommonSubjectId`
  const pairWiseID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestRpPairwiseId`
  const emailID = `perfEmail${uuidv4()}@digital.cabinet-office.gov.uk`
  const authCreateAccPayload = JSON.stringify(generateAuthCreateAccount(testID, userID, emailID, pairWiseID))
  console.log('Sending primer event')
  sqs.sendMessage(env.sqs_queue, authCreateAccPayload)
  console.log('Primer event sent')
  return authCreateAccPayload
}

export function sendRegularEvent(authCreateAccPayload: string): void {
  iterationsStarted.add(1)
  const authCreatePayload = JSON.parse(authCreateAccPayload)
  const testID = JSON.stringify(authCreatePayload.event_id).substring(1, 26)
  const eventID = `${testID}_${uuidv4()}`
  const authLogInSuccessPayload = JSON.stringify(
    generateAuthLogInSuccess(eventID, `${authCreatePayload.user.user_id}`, `${authCreatePayload.user.email}`)
  )
  sqs.sendMessage(env.sqs_queue, authLogInSuccessPayload)
  iterationsCompleted.add(1)
}

export function sendSingleEvent(): void {
  const journeyID = `perfJourney${uuidv4()}`
  iterationsStarted.add(1)
  const authReqParsedPayload = JSON.stringify(generateAuthReqParsed(journeyID))
  sqs.sendMessage(env.sqs_queue, authReqParsedPayload)
  iterationsCompleted.add(1)
}

export function pairwiseMappingClientEnrichment(): void {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') // YYMMDDTHHmmss
  const testID = `perfTestID${timestamp}`
  const userID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestCommonSubjectId`
  const pairWiseID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestRpPairwiseId`
  const emailID = `perfEmail${uuidv4()}@digital.cabinet-office.gov.uk`
  const eventID = `${testID}_${uuidv4()}`
  const journeyID = `perfJourney${uuidv4()}`
  iterationsStarted.add(1)
  const authCreateAccPayload = JSON.stringify(generateAuthCreateAccount(testID, userID, emailID, pairWiseID))
  const authLogInSuccessPayload = JSON.stringify(generateAuthLogInSuccess(eventID, userID, emailID))
  const authInitiatedPayload = JSON.stringify(generateAuthReqParsed(journeyID))
  const dcmawAbortPayload = JSON.stringify(generateDcmawAbortWeb(userID, journeyID, emailID))
  sqs.sendMessage(env.sqs_queue, authCreateAccPayload)
  sleepBetween(0.5, 1)
  sqs.sendMessage(env.sqs_queue, authLogInSuccessPayload)
  sleepBetween(0.5, 1)
  sqs.sendMessage(env.sqs_queue, authInitiatedPayload)
  sleepBetween(0.5, 1)
  sqs.sendMessage(env.sqs_queue, dcmawAbortPayload)
  iterationsCompleted.add(1)
}
