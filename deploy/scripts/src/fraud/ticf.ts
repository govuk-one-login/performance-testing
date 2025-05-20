import { type Options } from 'k6/options'
import { selectProfile, type ProfileList, createScenario, LoadProfile } from '../common/utils/config/load-profiles'
import { getEnv } from '../common/utils/config/environment-variables'
import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import {
  generateAuthCodeVerified,
  generateAuthCreateAccount,
  generateAuthLogInSuccess,
  generateAuthUpdatePhone,
  generateIPVAddressCRIVCIssued,
  generateIPVDLCRIVCIssued,
  generateIPVJourneyStart,
  generateIPVSubJourneyStart,
  generateIPVKBVCRIEnd,
  generateIPVKBVCRIStart,
  generateAuthAuthorisationInitiated
} from '../common/requestGenerator/txmaReqGen'
import { uuidv4 } from '../common/utils/jslib/index'
import http from 'k6/http'
import { sleep } from 'k6'
import { isStatusCode202 } from '../common/utils/checks/assertions'
import { timeGroup } from '../common/utils/request/timing'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('signInSuccess', LoadProfile.smoke),
    ...createScenario('signUpSuccess', LoadProfile.smoke),
    ...createScenario('identityProvingSuccess', LoadProfile.smoke),
    ...createScenario('identityReuseSuccess', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  signInApiCall: ['B01_SignInSuccess_01_SignInAPICall'],
  signUpApiCall: ['B02_SignUpSuccess_01_SignUpAPICall'],
  idProveApiCall: ['B03_IdentityProvingSuccess_01_IdProveAPICall'], // pragma: allowlist secret
  idReuseApiCall: ['B04_IdReuse_01_IdReuseAPICall']
} as const

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
  identityJWT3: getEnv('TiCF_IPV_JWT_3'),
  envName: getEnv('ENVIRONMENT')
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
  const groups = groupMap.signInApiCall
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const emailID = `perfEmail${uuidv4()}@digital.cabinet-office.gov.uk`
  const journeyID = `perfJourney${uuidv4()}`
  const eventID = `perfTestID$_${uuidv4()}`
  const authAuthorisationInitiatedPayload = JSON.stringify(generateAuthAuthorisationInitiated(journeyID, eventID))
  const authLogInSuccessPayload = JSON.stringify(generateAuthLogInSuccess(eventID, userID, emailID, journeyID))
  const authCodeVerifiedPayload = JSON.stringify(generateAuthCodeVerified(emailID, journeyID, userID, eventID))
  iterationsStarted.add(1)

  sqs.sendMessage(env.sqs_queue, authAuthorisationInitiatedPayload)
  sleep(5)
  sqs.sendMessage(env.sqs_queue, authLogInSuccessPayload)
  sleep(5)
  sqs.sendMessage(env.sqs_queue, authCodeVerifiedPayload)
  sleep(5)

  const authSignInPayload = {
    vtr: ['Cl'],
    sub: userID,
    govuk_signin_journey_id: journeyID,
    authenticated: 'Y'
  }

  // B01_SignInSuccess_01_SignInAPICall
  timeGroup(groups[0], () => http.post(`${env.authAPIURL}/${env.envName}/auth`, JSON.stringify(authSignInPayload)), {
    isStatusCode202
  })

  iterationsCompleted.add(1)
}

export function signUpSuccess(): void {
  const groups = groupMap.signUpApiCall
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') // YYMMDDTHHmmss
  const testID = `perfTestID${timestamp}`
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const emailID = `perfEmail${uuidv4()}@digital.cabinet-office.gov.uk`
  const pairWiseID = `performanceTestRpPairwiseId${uuidv4()}`
  const journeyID = `perfJourney${uuidv4()}`
  const eventID = `perfTestID$_${uuidv4()}`

  const authAuthorisationInitiatedPayload = JSON.stringify(generateAuthAuthorisationInitiated(journeyID, eventID))
  const authCreateAccPayload = JSON.stringify(generateAuthCreateAccount(testID, userID, emailID, pairWiseID, journeyID))
  const authCodeVerifiedPayload = JSON.stringify(generateAuthCodeVerified(emailID, journeyID, userID, eventID))
  const authUpdatePhonePayload = JSON.stringify(generateAuthUpdatePhone(emailID, journeyID, userID))
  iterationsStarted.add(1)

  sqs.sendMessage(env.sqs_queue, authAuthorisationInitiatedPayload)
  sleep(5)
  sqs.sendMessage(env.sqs_queue, authCreateAccPayload)
  sleep(5)
  sqs.sendMessage(env.sqs_queue, authCodeVerifiedPayload)
  sleep(5)
  sqs.sendMessage(env.sqs_queue, authUpdatePhonePayload)

  sleep(5)

  const authSignUpPayload = {
    vtr: ['Cl.Cm'],
    sub: userID,
    govuk_signin_journey_id: journeyID,
    authenticated: 'Y',
    initial_registration: 'Y',
    '2fa_method': ['SMS']
  }

  // B02_SignUpSuccess_01_SignUpAPICall
  timeGroup(groups[0], () => http.post(`${env.authAPIURL}/${env.envName}/auth`, JSON.stringify(authSignUpPayload)), {
    isStatusCode202
  })

  iterationsCompleted.add(1)
}

export function identityProvingSuccess(): void {
  const groups = groupMap.idProveApiCall
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const journeyID = `perfJourney${uuidv4()}`
  const ipvJourneyStartPayload = JSON.stringify(generateIPVJourneyStart(journeyID, userID))
  const ipvSubJourneyStartPayload = JSON.stringify(generateIPVSubJourneyStart(journeyID, userID))
  const ipvDLCRIVCIssuedPayload = JSON.stringify(generateIPVDLCRIVCIssued(userID, journeyID))
  const ipvAddressCRIVCIssuedPayload = JSON.stringify(generateIPVAddressCRIVCIssued(journeyID, userID))
  const ipvKBVCRIStartPayload = JSON.stringify(generateIPVKBVCRIStart(journeyID, userID))
  const ipvKBVCRIEndPayload = JSON.stringify(generateIPVKBVCRIEnd(journeyID, userID))

  iterationsStarted.add(1)

  sqs.sendMessage(env.sqs_queue, ipvJourneyStartPayload)
  sleep(5)
  sqs.sendMessage(env.sqs_queue, ipvSubJourneyStartPayload)
  sleep(5)
  sqs.sendMessage(env.sqs_queue, ipvDLCRIVCIssuedPayload)
  sleep(5)
  sqs.sendMessage(env.sqs_queue, ipvAddressCRIVCIssuedPayload)
  sleep(5)
  sqs.sendMessage(env.sqs_queue, ipvKBVCRIStartPayload)
  sleep(5)
  sqs.sendMessage(env.sqs_queue, ipvKBVCRIEndPayload)

  sleep(5)
  const identityProvingPayload = {
    vtr: ['P2'],
    vot: 'P2',
    vtm: 'https://oidc.account.gov.uk/trustmark',
    sub: userID,
    govuk_signin_journey_id: journeyID,
    'https://vocab.account.gov.uk/v1/credentialJWT': [env.identityJWT1, env.identityJWT2, env.identityJWT3]
  }

  // B03_IdentityProvingSuccess_01_IdProveAPICall
  timeGroup(
    groups[0],
    () => http.post(`${env.ipvAPIURL}/${env.envName}/ipvcore`, JSON.stringify(identityProvingPayload)),
    {
      isStatusCode202
    }
  )
  iterationsCompleted.add(1)
}

export function identityReuseSuccess(): void {
  const groups = groupMap.idReuseApiCall
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const journeyID = `perfJourney${uuidv4()}`
  const ipvJourneyStartPayload = JSON.stringify(generateIPVJourneyStart(journeyID, userID))
  const ipvSubJourneyStartPayload = JSON.stringify(generateIPVSubJourneyStart(journeyID, userID))
  iterationsStarted.add(1)

  sqs.sendMessage(env.sqs_queue, ipvJourneyStartPayload)
  sleep(5)
  sqs.sendMessage(env.sqs_queue, ipvSubJourneyStartPayload)

  sleep(5)
  const identityReusePayload = {
    vtr: ['Cl.Cm.P2'],
    vot: 'P2',
    vtm: 'https://oidc.account.gov.uk/trustmark',
    sub: userID,
    govuk_signin_journey_id: journeyID,
    'https://vocab.account.gov.uk/v1/credentialJWT': []
  }

  // B04_IdReuse_01_IdReuseAPICall
  timeGroup(
    groups[0],
    () => http.post(`${env.ipvAPIURL}/${env.envName}/ipvcore`, JSON.stringify(identityReusePayload)),
    {
      isStatusCode202
    }
  )
  iterationsCompleted.add(1)
}
