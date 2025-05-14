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
    ...createScenario('signInSuccess', LoadProfile.smoke),
    ...createScenario('signUpSuccess', LoadProfile.smoke),
    ...createScenario('identityProvingSuccess', LoadProfile.smoke),
    ...createScenario('identityReuseSuccess', LoadProfile.smoke)
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
  sqs_queue: getEnv('TiCF_SQS_QUEUE'),
  authAPIURL: getEnv('TiCF_AUTH_URL'),
  ipvAPIURL: getEnv('TiCF_IPV_URL'),
  identityJWT1: getEnv('TiCF_IPV_JWT_1'),
  identityJWT2: getEnv('TiCF_IPV_JWT_2'),
  identityJWT3: getEnv('TiCF_IPV_JWT_3')
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})

const sqs = new SQSClient(awsConfig)

const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') // YYMMDDTHHmmss
const testID = `perfTestID${timestamp}`
const emailID = `perfEmail${uuidv4()}@digital.cabinet-office.gov.uk`
const eventID = `${testID}_${uuidv4()}`

export function signInSuccess(): void {
  const userID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestCommonSubjectId`
  const journeyID = `perfJourney${uuidv4()}`
  const authAuthorizationInitiatedPayload = JSON.stringify(generateAuthAuthorizationInitiated(journeyID))
  const authLogInSuccessPayload = JSON.stringify(generateAuthLogInSuccess(eventID, userID, emailID, journeyID))
  const authCodeVerifiedPayload = JSON.stringify(generateAuthCodeVerified(emailID, journeyID, userID))
  iterationsStarted.add(1)

  sqs.sendMessage(env.sqs_queue, authAuthorizationInitiatedPayload)
  sqs.sendMessage(env.sqs_queue, authLogInSuccessPayload)
  sqs.sendMessage(env.sqs_queue, authCodeVerifiedPayload)

  sleepBetween(1, 3)

  const authSignInPayload = {
    vtr: ['Cl'],
    sub: userID,
    govuk_signin_journey_id: journeyID,
    authenticated: 'Y'
  }

  const params = {
    headers: {
      'Content-Type': 'application/json'
    }
  }

  const res = http.post(env.authAPIURL, JSON.stringify(authSignInPayload), params)
  check(res, {
    'status is 202': r => r.status === 202
  })

  iterationsCompleted.add(1)
}

export function signUpSuccess(): void {
  const pairWiseID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestRpPairwiseId`
  const userID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestCommonSubjectId`
  const journeyID = `perfJourney${uuidv4()}`

  const authAuthorizationInitiatedPayload = JSON.stringify(generateAuthAuthorizationInitiated(journeyID))
  const authCreateAccPayload = JSON.stringify(generateAuthCreateAccount(testID, userID, emailID, pairWiseID, journeyID))
  const authCodeVerifiedPayload = JSON.stringify(generateAuthCodeVerified(emailID, journeyID, userID))
  const authUpdatePhonePayload = JSON.stringify(generateAuthUpdatePhone(emailID, journeyID, userID))
  iterationsStarted.add(1)

  sqs.sendMessage(env.sqs_queue, authAuthorizationInitiatedPayload)
  sqs.sendMessage(env.sqs_queue, authCreateAccPayload)
  sqs.sendMessage(env.sqs_queue, authCodeVerifiedPayload)
  sqs.sendMessage(env.sqs_queue, authUpdatePhonePayload)

  sleepBetween(1, 3)

  const authSignUpPayload = {
    vtr: ['Cl.Cm'],
    sub: userID,
    govuk_signin_journey_id: journeyID,
    authenticated: 'Y',
    initial_registration: 'Y',
    '2fa_method': ['SMS']
  }

  const params = {
    headers: {
      'Content-Type': 'application/json'
    }
  }

  const res = http.post(env.authAPIURL, JSON.stringify(authSignUpPayload), params)
  check(res, {
    'status is 202': r => r.status === 202
  })

  iterationsCompleted.add(1)
}

export function identityProvingSuccess(): void {
  const userID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestCommonSubjectId`
  const journeyID = `perfJourney${uuidv4()}`
  const ipvJourneyStartPayload = JSON.stringify(generateIPVJourneyStart(journeyID, userID))
  const ipvSubJourneyStartPayload = JSON.stringify(generateIPVSubJourneyStart(journeyID, userID))
  const ipvDLCRIVCIssuedPayload = JSON.stringify(generateIPVDLCRIVCIssued(userID, journeyID))
  const ipvAddressCRIVCIssuedPayload = JSON.stringify(generateIPVAddressCRIVCIssued(journeyID, userID))
  const ipvKBVCRIStartPayload = JSON.stringify(generateIPVKBVCRIStart(journeyID, userID))
  const ipvKBVCRIEndPayload = JSON.stringify(generateIPVKBVCRIEnd(journeyID, userID))

  iterationsStarted.add(1)

  sqs.sendMessage(env.sqs_queue, ipvJourneyStartPayload)
  sqs.sendMessage(env.sqs_queue, ipvSubJourneyStartPayload)
  sqs.sendMessage(env.sqs_queue, ipvDLCRIVCIssuedPayload)
  sqs.sendMessage(env.sqs_queue, ipvAddressCRIVCIssuedPayload)
  sqs.sendMessage(env.sqs_queue, ipvKBVCRIStartPayload)
  sqs.sendMessage(env.sqs_queue, ipvKBVCRIEndPayload)

  sleepBetween(1, 3)
  const identityProvingPayload = {
    vtr: ['P2'],
    vot: 'P2',
    vtm: 'https://oidc.account.gov.uk/trustmark',
    sub: userID,
    govuk_signin_journey_id: journeyID,
    'https://vocab.account.gov.uk/v1/credentialJWT': [env.identityJWT1, env.identityJWT2, env.identityJWT3]
  }

  const params = {
    headers: {
      'Content-Type': 'application/json'
    }
  }

  const res = http.post(env.authAPIURL, JSON.stringify(identityProvingPayload), params)
  check(res, {
    'status is 202': r => r.status === 202
  })
  iterationsCompleted.add(1)
}

export function identityReuseSuccess(): void {
  const userID = `${testID}_performanceTestClientId_perfUserID${uuidv4()}_performanceTestCommonSubjectId`
  const journeyID = `perfJourney${uuidv4()}`
  const ipvJourneyStartPayload = JSON.stringify(generateIPVJourneyStart(journeyID, userID))
  const ipvSubJourneyStartPayload = JSON.stringify(generateIPVSubJourneyStart(journeyID, userID))
  iterationsStarted.add(1)

  sqs.sendMessage(env.sqs_queue, ipvJourneyStartPayload)
  sqs.sendMessage(env.sqs_queue, ipvSubJourneyStartPayload)

  sleepBetween(1, 3)
  const identityReusePayload = {
    vtr: ['Cl.Cm.P2'],
    vot: 'P2',
    vtm: 'https://oidc.account.gov.uk/trustmark',
    sub: userID,
    govuk_signin_journey_id: journeyID,
    'https://vocab.account.gov.uk/v1/credentialJWT': []
  }

  const params = {
    headers: {
      'Content-Type': 'application/json'
    }
  }

  const res = http.post(env.authAPIURL, JSON.stringify(identityReusePayload), params)
  check(res, {
    'status is 202': r => r.status === 202
  })
  iterationsCompleted.add(1)
}
