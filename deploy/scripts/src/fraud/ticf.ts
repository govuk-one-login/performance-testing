import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  createI3SpikeSignInScenario,
  createI4PeakTestSignInScenario
} from '../common/utils/config/load-profiles'
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
  ticfSmoke: {
    ticf: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [{ target: 1, duration: '5m' }],
      exec: 'ticf'
    }
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignInScenario('ticf', 47, 66, 23)
  },
  perf006Iteration4SpikeTest: {
    ...createI3SpikeSignInScenario('ticf', 129, 66, 60)
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignInScenario('ticf', 65, 66, 31)
  },
  perf006Iteration5SpikeTest: {
    ...createI3SpikeSignInScenario('ticf', 162, 66, 75)
  },
  perf006Iteration6PeakTest: {
    ...createI4PeakTestSignInScenario('ticf', 104, 66, 48)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignInScenario('ticf', 71, 66, 33)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  ticf: [
    'B01_SignUpSuccess_01_SignUpAPICall',
    'B01_SignInSuccess_02_SignInAPICall',
    'B01_IdentityProvingSuccess_03_IdProveAPICall', // pragma: allowlist secret
    'B01_IdReuse_04_IdReuseAPICall'
  ]
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

export function signUpSuccess(userID: string, emailID: string): void {
  const groups = groupMap.ticf
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') // YYMMDDTHHmmss
  const testID = `perfTestID${timestamp}`
  const pairWiseID = `performanceTestRpPairwiseId${uuidv4()}`
  const journeyID = `perfJourney${uuidv4()}`

  const authAuthorisationInitiatedPayload = JSON.stringify(generateAuthAuthorisationInitiated(journeyID))
  sqs.sendMessage(env.sqs_queue, authAuthorisationInitiatedPayload)
  sleep(3)

  const authCreateAccPayload = JSON.stringify(generateAuthCreateAccount(testID, userID, emailID, pairWiseID, journeyID))
  sqs.sendMessage(env.sqs_queue, authCreateAccPayload)
  sleep(3)

  const authCodeVerifiedPayload = JSON.stringify(generateAuthCodeVerified(emailID, journeyID, userID))
  sqs.sendMessage(env.sqs_queue, authCodeVerifiedPayload)
  sleep(3)

  const authUpdatePhonePayload = JSON.stringify(generateAuthUpdatePhone(emailID, journeyID, userID))
  sqs.sendMessage(env.sqs_queue, authUpdatePhonePayload)
  sleep(3)

  const authSignUpPayload = {
    vtr: ['Cl.Cm'],
    sub: userID,
    govuk_signin_journey_id: journeyID,
    authenticated: 'Y',
    initial_registration: 'Y',
    '2fa_method': ['SMS']
  }

  // B01_SignUpSuccess_01_SignUpAPICall
  timeGroup(groups[0], () => http.post(`${env.authAPIURL}/${env.envName}/auth`, JSON.stringify(authSignUpPayload)), {
    isStatusCode202
  })
}

export function signInSuccess(userID: string, emailID: string): void {
  const groups = groupMap.ticf
  const journeyID = `perfJourney${uuidv4()}`

  const authAuthorisationInitiatedPayload = JSON.stringify(generateAuthAuthorisationInitiated(journeyID))
  sqs.sendMessage(env.sqs_queue, authAuthorisationInitiatedPayload)
  sleep(3)

  const authLogInSuccessPayload = JSON.stringify(generateAuthLogInSuccess(userID, emailID, journeyID))
  sqs.sendMessage(env.sqs_queue, authLogInSuccessPayload)
  sleep(3)

  const authSignInPayload = {
    vtr: ['Cl'],
    sub: userID,
    govuk_signin_journey_id: journeyID,
    authenticated: 'Y'
  }

  // B01_SignInSuccess_02_SignInAPICall
  timeGroup(groups[1], () => http.post(`${env.authAPIURL}/${env.envName}/auth`, JSON.stringify(authSignInPayload)), {
    isStatusCode202
  })
}

export function identityProvingSuccess(userID: string): void {
  const groups = groupMap.ticf
  const journeyID = `perfJourney${uuidv4()}`

  const ipvJourneyStartPayload = JSON.stringify(generateIPVJourneyStart(journeyID, userID))
  sqs.sendMessage(env.sqs_queue, ipvJourneyStartPayload)
  sleep(3)

  const ipvSubJourneyStartPayload = JSON.stringify(generateIPVSubJourneyStart(journeyID, userID))
  sqs.sendMessage(env.sqs_queue, ipvSubJourneyStartPayload)
  sleep(3)

  const ipvDLCRIVCIssuedPayload = JSON.stringify(generateIPVDLCRIVCIssued(userID, journeyID))
  sqs.sendMessage(env.sqs_queue, ipvDLCRIVCIssuedPayload)
  sleep(3)

  const ipvAddressCRIVCIssuedPayload = JSON.stringify(generateIPVAddressCRIVCIssued(journeyID, userID))
  sqs.sendMessage(env.sqs_queue, ipvAddressCRIVCIssuedPayload)
  sleep(3)

  const ipvKBVCRIStartPayload = JSON.stringify(generateIPVKBVCRIStart(journeyID, userID))
  sqs.sendMessage(env.sqs_queue, ipvKBVCRIStartPayload)
  sleep(3)

  const ipvKBVCRIEndPayload = JSON.stringify(generateIPVKBVCRIEnd(journeyID, userID))
  sqs.sendMessage(env.sqs_queue, ipvKBVCRIEndPayload)
  sleep(3)

  const identityProvingPayload = {
    vtr: ['Cl.Cm.P2'],
    vot: 'P2',
    vtm: 'https://oidc.account.gov.uk/trustmark',
    sub: userID,
    govuk_signin_journey_id: journeyID,
    'https://vocab.account.gov.uk/v1/credentialJWT': [env.identityJWT1, env.identityJWT2, env.identityJWT3]
  }

  // B01_IdentityProvingSuccess_03_IdProveAPICall
  timeGroup(
    groups[2],
    () => http.post(`${env.ipvAPIURL}/${env.envName}/ipvcore`, JSON.stringify(identityProvingPayload)),
    {
      isStatusCode202
    }
  )
}

export function identityReuseSuccess(userID: string): void {
  const groups = groupMap.ticf
  const journeyID = `perfJourney${uuidv4()}`

  const ipvJourneyStartPayload = JSON.stringify(generateIPVJourneyStart(journeyID, userID))
  sqs.sendMessage(env.sqs_queue, ipvJourneyStartPayload)
  sleep(3)

  const ipvSubJourneyStartPayload = JSON.stringify(generateIPVSubJourneyStart(journeyID, userID))
  sqs.sendMessage(env.sqs_queue, ipvSubJourneyStartPayload)
  sleep(3)

  const identityReusePayload = {
    vtr: ['Cl.Cm.P2'],
    vot: 'P2',
    vtm: 'https://oidc.account.gov.uk/trustmark',
    sub: userID,
    govuk_signin_journey_id: journeyID,
    'https://vocab.account.gov.uk/v1/credentialJWT': []
  }

  // B01_IdReuse_04_IdReuseAPICall
  timeGroup(
    groups[3],
    () => http.post(`${env.ipvAPIURL}/${env.envName}/ipvcore`, JSON.stringify(identityReusePayload)),
    {
      isStatusCode202
    }
  )
}

export function ticf(): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const emailID = `perfEmail${uuidv4()}@digital.cabinet-office.gov.uk`

  iterationsStarted.add(1)

  signUpSuccess(userID, emailID)
  sleep(3)
  signInSuccess(userID, emailID)
  sleep(3)
  identityProvingSuccess(userID)
  sleep(3)
  identityReuseSuccess(userID)

  iterationsCompleted.add(1)
}
