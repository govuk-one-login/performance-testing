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
  generateIPVAddressCRIVCIssued,
  generateIPVDLCRIVCIssued,
  generateIPVJourneyStart,
  generateIPVSubJourneyStart,
  generateIPVKBVCRIEnd,
  generateIPVKBVCRIStart
} from '../common/requestGenerator/txmaReqGen'
import { uuidv4 } from '../common/utils/jslib/index'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import http from 'k6/http'
import { check } from 'k6'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('ticf', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'],
    http_req_failed: ['rate<0.05']
  }
}

const env = {
  sqs_queue: getEnv('TiCF_SQS_QUEUE'), // Need to change this and implement the actual SQS Queue.
  authAPIID: getEnv('TiCF_AUTH_API_ID'),
  authResourcePath: getEnv('TiCF_AUTH_RESOURCE_PATH')
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
}) //This means to run a smoke test we will need to assume the perf tester role locally (due to permissions)

const sqs = new SQSClient(awsConfig)

const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') // YYMMDDTHHmmss
const testID = `perfTestID${timestamp}`
const journeyID = `perfJourney${uuidv4()}`
const emailID = `perfEmail${uuidv4()}@digital.cabinet-office.gov.uk`
const eventID = `${testID}_${uuidv4()}`

export function signInSuccess(userID: string): void {
  const authAuthorizationInitiatedPayload = JSON.stringify(generateAuthAuthorizationInitiated(journeyID))
  const authLogInSuccessPayload = JSON.stringify(generateAuthLogInSuccess(eventID, userID, emailID))
  const authCodeVerifiedPayload = JSON.stringify(generateAuthCodeVerified(emailID, journeyID, userID))

  sqs.sendMessage(env.sqs_queue, authAuthorizationInitiatedPayload)
  sqs.sendMessage(env.sqs_queue, authLogInSuccessPayload)
  sqs.sendMessage(env.sqs_queue, authCodeVerifiedPayload)
}

export function signUpSuccess(userID: string): void {
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

export function identityProvingSuccess(userID: string): void {
  const ipvJourneyStartPayload = JSON.stringify(generateIPVJourneyStart(journeyID, userID))
  const ipvSubJourneyStartPayload = JSON.stringify(generateIPVSubJourneyStart(journeyID, userID))
  const ipvDLCRIVCIssuedPayload = JSON.stringify(generateIPVDLCRIVCIssued(userID, journeyID))
  const ipvAddressCRIVCIssuedPayload = JSON.stringify(generateIPVAddressCRIVCIssued(journeyID, userID))
  const ipvKBVCRIStartPayload = JSON.stringify(generateIPVKBVCRIStart(journeyID, userID))
  const ipvKBVCRIEndPayload = JSON.stringify(generateIPVKBVCRIEnd(journeyID, userID))

  sqs.sendMessage(env.sqs_queue, ipvJourneyStartPayload)
  sqs.sendMessage(env.sqs_queue, ipvSubJourneyStartPayload)
  sqs.sendMessage(env.sqs_queue, ipvDLCRIVCIssuedPayload)
  sqs.sendMessage(env.sqs_queue, ipvAddressCRIVCIssuedPayload)
  sqs.sendMessage(env.sqs_queue, ipvKBVCRIStartPayload)
  sqs.sendMessage(env.sqs_queue, ipvKBVCRIEndPayload)
}

export function identityReuseSuccess(userID: string): void {
  const ipvJourneyStartPayload = JSON.stringify(generateIPVJourneyStart(journeyID, userID))
  const ipvSubJourneyStartPayload = JSON.stringify(generateIPVSubJourneyStart(journeyID, userID))

  sqs.sendMessage(env.sqs_queue, ipvJourneyStartPayload)
  sqs.sendMessage(env.sqs_queue, ipvSubJourneyStartPayload)
}

export function authSignInAPICall() {
  //This should be a POST request to the API and then a 202 response validation
  const authAPIID = env.authAPIID
  const authResourcePath = env.authResourcePath
  const authAPIURL = `https://${authAPIID}.execute-api.<eu-west-2>.amazonaws.com/dev${authResourcePath}`

  const authSignInPayload = {
    vtr: ['Cl'],
    sub: 'urn:fdc:gov.uk:EC941A39-46E4-4A7C-B4AA-BF69A334C9BE',
    govuk_signin_journey_id: '8CAC19F3-73E6-4D34-BF52-2D9BDFC4775F',
    authenticated: 'Y'
  }

  const params = {
    headers: {
      'Content-Type': 'application/json'
    }
  }

  const res = http.post(authAPIURL, JSON.stringify(authSignInPayload), params)
  check(res, {
    'status is 202': r => r.status === 202
  })
}

export function authSignUpAPICall() {}

export function identityReuseAPICall() {}

export function identityProvingAPICall() {}

export function ticf(): void {
  const userID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestCommonSubjectId`
  iterationsStarted.add(1)

  signInSuccess(userID)
  sleepBetween(1, 3)
  authSignInAPICall()
  sleepBetween(1, 3)

  //For Auth signUp we are sending the TxMA events to the SQS queue, waiting, and then making the API call
  signUpSuccess(userID)
  sleepBetween(1, 3)
  authSignUpAPICall()
  sleepBetween(1, 3)

  //For Identity Reuse we are sending the TxMA events to the SQS queue, waiting, and then making the API call
  identityReuseSuccess(userID)
  sleepBetween(1, 3)
  identityReuseAPICall()
  sleepBetween(1, 3)

  //For Identity Proving we are sending the TxMA events to the SQS queue, waiting, and then making the API call
  identityProvingSuccess(userID)
  sleepBetween(1, 3)
  identityProvingAPICall()
  sleepBetween(1, 3)

  iterationsCompleted.add(1)
}

//Also need to update permissions in the CF template to allow us to push to the queue
//Double check payoad values
