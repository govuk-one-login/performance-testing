import { type Options } from 'k6/options'
import { selectProfile, type ProfileList, createScenario, LoadProfile } from '../common/utils/config/load-profiles'
import { getEnv } from '../common/utils/config/environment-variables'
import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import {
  generateAuthAuthorizationInitiated,
  generateAuthCodeVerified,
  generateAuthCreateAccount,
  generateAuthLogInSuccess,
  generateAuthUpdatePhone,
  generateCICCRIVCIssued,
  generateIPVAddressCRIVCIssued,
  generateIPVDLCRIVCIssued,
  generateIPVJourneyStart,
  generateIPVSubJourneyStart
} from '../common/requestGenerator/txmaReqGen'
import { uuidv4 } from '../common/utils/jslib/index'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('ticfDataMigration', LoadProfile.smoke)
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
  sqs_queue: getEnv('TiCF_SQS_QUEUE') // Need to change this and implement the actual SQS Queue.
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})

const sqs = new SQSClient(awsConfig)

export function signInSuccess(): void {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') // YYMMDDTHHmmss
  const testID = `perfTestID${timestamp}`
  const journeyID = `perfJourney${uuidv4()}`
  const userID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestCommonSubjectId`
  const emailID = `perfEmail${uuidv4()}@digital.cabinet-office.gov.uk`
  const eventID = `${testID}_${uuidv4()}`

  const authAuthorizationInitiatedPayload = JSON.stringify(generateAuthAuthorizationInitiated(journeyID))
  const authLogInSuccessPayload = JSON.stringify(generateAuthLogInSuccess(eventID, userID, emailID))
  const authCodeVerifiedPayload = JSON.stringify(generateAuthCodeVerified(emailID, journeyID, userID))

  sqs.sendMessage(env.sqs_queue, authAuthorizationInitiatedPayload)
  sqs.sendMessage(env.sqs_queue, authLogInSuccessPayload)
  sqs.sendMessage(env.sqs_queue, authCodeVerifiedPayload)
}

export function signUpSuccess(): void {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') // YYMMDDTHHmmss
  const testID = `perfTestID${timestamp}`
  const journeyID = `perfJourney${uuidv4()}`
  const userID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestCommonSubjectId`
  const emailID = `perfEmail${uuidv4()}@digital.cabinet-office.gov.uk`
  const pairWiseID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestRpPairwiseId`

  const authAuthorizationInitiatedPayload = JSON.stringify(generateAuthAuthorizationInitiated(journeyID))
  const authCreateAccPayload = JSON.stringify(generateAuthCreateAccount(testID, userID, emailID, pairWiseID))
  const authCodeVerifiedPayload = JSON.stringify(generateAuthCodeVerified(emailID, journeyID, userID))
  const authUpdatePhonePayload = JSON.stringify(generateAuthUpdatePhone(emailID, journeyID, userID))

  sqs.sendMessage(env.sqs_queue, authAuthorizationInitiatedPayload)
  sqs.sendMessage(env.sqs_queue, authCreateAccPayload)
  sqs.sendMessage(env.sqs_queue, authCodeVerifiedPayload)
  sqs.sendMessage(env.sqs_queue, authUpdatePhonePayload)
}

export function identityReuseSuccess(): void {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') // YYMMDDTHHmmss
  const testID = `perfTestID${timestamp}`
  const journeyID = `perfJourney${uuidv4()}`
  const userID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestCommonSubjectId`

  const ipvJourneyStartPayload = JSON.stringify(generateIPVJourneyStart(journeyID, userID))
  const ipvSubJourneyStartPayload = JSON.stringify(generateIPVSubJourneyStart(journeyID, userID))
  const ipvDLCRIVCIssuedPayload = JSON.stringify(generateIPVDLCRIVCIssued(userID, journeyID))
  const ipvAddressCRIVCIssuedPayload = JSON.stringify(generateIPVAddressCRIVCIssued(journeyID, userID))
  const ipvCICCRIVCIssuedPAyload = JSON.stringify(generateCICCRIVCIssued(journeyID, userID))

  sqs.sendMessage(env.sqs_queue, ipvJourneyStartPayload)
  sqs.sendMessage(env.sqs_queue, ipvSubJourneyStartPayload)
  sqs.sendMessage(env.sqs_queue, ipvDLCRIVCIssuedPayload)
  sqs.sendMessage(env.sqs_queue, ipvAddressCRIVCIssuedPayload)
  sqs.sendMessage(env.sqs_queue, ipvCICCRIVCIssuedPAyload)
}

export function ticfDataMigration(): void {
  iterationsStarted.add(1)

  signInSuccess()
  signUpSuccess()
  identityReuseSuccess()

  iterationsCompleted.add(1)
}

//We need to change the permisisons of the TiCF SQS queue and Perf Testing CF Template.
//There are still a few values of the payloads i am unsure on whether to include/the value of them e.g. ci in generateIPVDLCRIVCIssued.
