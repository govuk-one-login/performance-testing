import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  createI3SpikeSignInScenario,
  createI4PeakTestSignInScenario,
  createI4PeakTestSignUpScenario,
  createSpikeTestSignInScenario,
  createSpikeTestSignUpScenario,
  describeProfile,
  createStressTestSignInScenario
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
  generateAuthAuthorisationInitiated,
  generateRandomIP,
  generateRandomPhoneNumber
} from '../common/requestGenerator/txmaReqGen'
import { uuidv4 } from '../common/utils/jslib/index'
import { SharedArray } from 'k6/data'
import http from 'k6/http'
import { sleep } from 'k6'
import exec from 'k6/execution'
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
    },
    silentLogin: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [{ target: 1, duration: '5m' }],
      exec: 'silentLogin'
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
    ...createI4PeakTestSignInScenario('ticf', 71, 66, 33),
    ...createI4PeakTestSignInScenario('silentLogin', 21, 63, 10)
  },
  perf006Iteration8PeakTest: {
    ...createI4PeakTestSignInScenario('ticf', 126, 66, 58),
    ...createI4PeakTestSignInScenario('silentLogin', 38, 63, 18)
  },
  perf006Iteration9StressTest: {
    ...createStressTestSignInScenario('ticf', 250, 66, 115),
    ...createStressTestSignInScenario('silentLogin', 75, 63, 35, 26)
  },
  ticfSingleIteration: {
    ticf: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      exec: 'ticf'
    },
    silentLogin: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      exec: 'silentLogin'
    }
  },
  ticfSIRA2ItersTest: {
    ...createI4PeakTestSignInScenario('ticf', 2, 66, 2)
  },
  dataCreationSignedUpUsers: {
    dataCreationSignedUpUser: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 500,
      exec: 'dataCreationSignedUpUser'
    }
  },
  dataCreationProvedUsers: {
    dataCreationProvedUser: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 500,
      exec: 'dataCreationProvedUser'
    }
  },
  perf006Iteration10PeakTest: {
    ...createI4PeakTestSignUpScenario('ticfCase1', 750, 13, 751),
    ...createI4PeakTestSignInScenario('ticfCase2', 214, 7, 98, 653),
    ...createI4PeakTestSignUpScenario('ticfCase3', 200, 19, 201, 550),
    ...createI4PeakTestSignInScenario('ticfCase4', 267, 7, 122, 629),
    ...createI4PeakTestSignInScenario('ticfCase5', 64, 7, 29, 722)
  },
  perf006Iteration10SpikeTest: {
    ...createSpikeTestSignUpScenario('ticfCase1', 2250, 13, 2251),
    ...createSpikeTestSignInScenario('ticfCase2', 642, 7, 294, 653),
    ...createSpikeTestSignUpScenario('ticfCase3', 600, 19, 601, 550),
    ...createSpikeTestSignInScenario('ticfCase4', 801, 7, 366, 629),
    ...createSpikeTestSignInScenario('ticfCase5', 192, 7, 87, 722)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  ticf: [
    'B01_HappyPath_01_SignUpAPICall',
    'B01_HappyPath_02_SignInAPICall',
    'B01_HappyPath_03_IdProveAPICall', // pragma: allowlist secret
    'B01_HappyPath_04_IdReuseAPICall'
  ],
  silentLogin: [
    'B02_SilentLogin_01_SignUpAPICall',
    'B02_SilentLogin_02_SilentSignInAPICall',
    'B02_SilentLogin_03_IdProveAPICall' // pragma: allowlist secret
  ],
  ticfCase1: ['B01_HappyPath_01_SignUpAPICall'],
  ticfCase2: ['B01_HappyPath_02_SignInAPICall'],
  ticfCase3: ['B01_HappyPath_03_IdProveAPICall'], // pragma: allowlist secret
  ticfCase4: ['B01_HappyPath_04_IdReuseAPICall'],
  ticfCase5: ['B02_SilentLogin_02_SilentSignInAPICall']
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'],
    http_req_failed: ['rate<0.05']
  }
}

export function setup(): void {
  describeProfile(loadProfile)
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

export function signUpSuccess(
  groupName: string,
  userID: string,
  emailID: string,
  randomIP: string,
  randomPhoneNumber: string
): void {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') // YYMMDDTHHmmss
  const testID = `perfTestID${timestamp}`
  const pairWiseID = `performanceTestRpPairwiseId${uuidv4()}`
  const journeyID = `perfJourney${uuidv4()}`

  const authAuthorisationInitiatedPayload = JSON.stringify(generateAuthAuthorisationInitiated(journeyID, randomIP))
  sqs.sendMessage(env.sqs_queue, authAuthorisationInitiatedPayload)
  sleep(3)

  const authCreateAccPayload = JSON.stringify(
    generateAuthCreateAccount(testID, userID, emailID, pairWiseID, journeyID, randomIP, randomPhoneNumber)
  )
  sqs.sendMessage(env.sqs_queue, authCreateAccPayload)
  sleep(3)

  const authCodeVerifiedPayload = JSON.stringify(generateAuthCodeVerified(emailID, journeyID, userID, randomIP))
  sqs.sendMessage(env.sqs_queue, authCodeVerifiedPayload)
  sleep(3)

  const authUpdatePhonePayload = JSON.stringify(
    generateAuthUpdatePhone(emailID, journeyID, userID, randomIP, randomPhoneNumber)
  )
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
  timeGroup(groupName, () => http.post(`${env.authAPIURL}/${env.envName}/auth`, JSON.stringify(authSignUpPayload)), {
    isStatusCode202
  })
}

export function signInSuccess(
  groupName: string,
  userID: string,
  emailID: string,
  randomIP: string,
  randomPhoneNumber: string
): void {
  const journeyID = `perfJourney${uuidv4()}`

  const authAuthorisationInitiatedPayload = JSON.stringify(generateAuthAuthorisationInitiated(journeyID, randomIP))
  sqs.sendMessage(env.sqs_queue, authAuthorisationInitiatedPayload)
  sleep(3)

  const authLogInSuccessPayload = JSON.stringify(
    generateAuthLogInSuccess(userID, emailID, journeyID, randomIP, randomPhoneNumber)
  )
  sqs.sendMessage(env.sqs_queue, authLogInSuccessPayload)
  sleep(3)

  const authSignInPayload = {
    vtr: ['Cl'],
    sub: userID,
    govuk_signin_journey_id: journeyID,
    authenticated: 'Y'
  }

  // B01_SignInSuccess_02_SignInAPICall
  timeGroup(groupName, () => http.post(`${env.authAPIURL}/${env.envName}/auth`, JSON.stringify(authSignInPayload)), {
    isStatusCode202
  })
}

export function signInSilent(groupName: string, userID: string, randomIP: string): void {
  const journeyID = `perfJourney${uuidv4()}`

  const authAuthorisationInitiatedPayload = JSON.stringify(generateAuthAuthorisationInitiated(journeyID, randomIP))
  sqs.sendMessage(env.sqs_queue, authAuthorisationInitiatedPayload)
  sleep(3)

  const authSignInPayload = {
    vtr: ['Cl'],
    sub: userID,
    govuk_signin_journey_id: journeyID,
    authenticated: 'Y'
  }

  // B01_SignInSuccess_02_SignInAPICall
  timeGroup(groupName, () => http.post(`${env.authAPIURL}/${env.envName}/auth`, JSON.stringify(authSignInPayload)), {
    isStatusCode202
  })
}

export function identityProvingSuccess(groupName: string, userID: string, randomIP: string): void {
  const journeyID = `perfJourney${uuidv4()}`

  const ipvJourneyStartPayload = JSON.stringify(generateIPVJourneyStart(journeyID, userID, randomIP))
  sqs.sendMessage(env.sqs_queue, ipvJourneyStartPayload)
  sleep(3)

  const ipvSubJourneyStartPayload = JSON.stringify(generateIPVSubJourneyStart(journeyID, userID, randomIP))
  sqs.sendMessage(env.sqs_queue, ipvSubJourneyStartPayload)
  sleep(3)

  const ipvDLCRIVCIssuedPayload = JSON.stringify(generateIPVDLCRIVCIssued(userID, journeyID, randomIP))
  sqs.sendMessage(env.sqs_queue, ipvDLCRIVCIssuedPayload)
  sleep(3)

  const ipvAddressCRIVCIssuedPayload = JSON.stringify(generateIPVAddressCRIVCIssued(journeyID, userID, randomIP))
  sqs.sendMessage(env.sqs_queue, ipvAddressCRIVCIssuedPayload)
  sleep(3)

  const ipvKBVCRIStartPayload = JSON.stringify(generateIPVKBVCRIStart(journeyID, userID, randomIP))
  sqs.sendMessage(env.sqs_queue, ipvKBVCRIStartPayload)
  sleep(3)

  const ipvKBVCRIEndPayload = JSON.stringify(generateIPVKBVCRIEnd(journeyID, userID, randomIP))
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
    groupName,
    () => http.post(`${env.ipvAPIURL}/${env.envName}/ipvcore`, JSON.stringify(identityProvingPayload)),
    {
      isStatusCode202
    }
  )
}

export function identityReuseSuccess(groupName: string, userID: string, randomIP: string): void {
  const journeyID = `perfJourney${uuidv4()}`

  const ipvJourneyStartPayload = JSON.stringify(generateIPVJourneyStart(journeyID, userID, randomIP))
  sqs.sendMessage(env.sqs_queue, ipvJourneyStartPayload)
  sleep(3)

  const ipvSubJourneyStartPayload = JSON.stringify(generateIPVSubJourneyStart(journeyID, userID, randomIP))
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
    groupName,
    () => http.post(`${env.ipvAPIURL}/${env.envName}/ipvcore`, JSON.stringify(identityReusePayload)),
    {
      isStatusCode202
    }
  )
}

const signedUpUsers = new SharedArray('signedUpUsers', () => {
  return open('./data/signedUpUsers.csv')
    .split('\n')
    .slice(1)
    .filter(line => line.trim() !== '')
    .map(line => ({ userID: line.trim() }))
})

const provedUsers = new SharedArray('provedUsers', () => {
  return open('./data/provedUsers.csv')
    .split('\n')
    .slice(1)
    .filter(line => line.trim() !== '')
    .map(line => ({ userID: line.trim() }))
})

// Case 1: New user signs up — fresh userID, feeds signedUpUsers + provedUsers pools
export function ticfCase1(): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const emailID = `perfHappyPath${uuidv4()}@digital.cabinet-office.gov.uk`
  const randomIP = generateRandomIP()
  const randomPhoneNumber = generateRandomPhoneNumber()
  iterationsStarted.add(1)
  signUpSuccess(groupMap.ticfCase1[0], userID, emailID, randomIP, randomPhoneNumber)
  iterationsCompleted.add(1)
}

// Case 2: Known signed-up user signs in — reuses userID from signedUpUsers pool
export function ticfCase2(): void {
  const { userID } = signedUpUsers[exec.scenario.iterationInTest % signedUpUsers.length]
  const emailID = `perfHappyPath${uuidv4()}@digital.cabinet-office.gov.uk`
  const randomIP = generateRandomIP()
  const randomPhoneNumber = generateRandomPhoneNumber()
  iterationsStarted.add(1)
  signInSuccess(groupMap.ticfCase2[0], userID, emailID, randomIP, randomPhoneNumber)
  iterationsCompleted.add(1)
}

// Case 3: Known signed-up user identity proves — reuses userID from signedUpUsers pool
export function ticfCase3(): void {
  const { userID } = signedUpUsers[exec.scenario.iterationInTest % signedUpUsers.length]
  const randomIP = generateRandomIP()
  iterationsStarted.add(1)
  identityProvingSuccess(groupMap.ticfCase3[0], userID, randomIP)
  iterationsCompleted.add(1)
}

// Case 4: Known proved user identity reuses — reuses userID from provedUsers pool
export function ticfCase4(): void {
  const { userID } = provedUsers[exec.scenario.iterationInTest % provedUsers.length]
  const randomIP = generateRandomIP()
  iterationsStarted.add(1)
  identityReuseSuccess(groupMap.ticfCase4[0], userID, randomIP)
  iterationsCompleted.add(1)
}

// Case 5: Known signed-up user silent sign in — reuses userID from signedUpUsers pool
export function ticfCase5(): void {
  const { userID } = signedUpUsers[exec.scenario.iterationInTest % signedUpUsers.length]
  const randomIP = generateRandomIP()
  iterationsStarted.add(1)
  signInSilent(groupMap.ticfCase5[0], userID, randomIP)
  iterationsCompleted.add(1)
}

// Data creation: generates a signed-up user and logs userID to stdout for CSV harvesting
export function dataCreationSignedUpUser(): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const emailID = `perfHappyPath${uuidv4()}@digital.cabinet-office.gov.uk`
  const randomIP = generateRandomIP()
  const randomPhoneNumber = generateRandomPhoneNumber()
  signUpSuccess(groupMap.ticfCase1[0], userID, emailID, randomIP, randomPhoneNumber)
  console.log(userID)
}

// Data creation: generates a proved user (sign up + identity prove) and logs userID to stdout
export function dataCreationProvedUser(): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const emailID = `perfHappyPath${uuidv4()}@digital.cabinet-office.gov.uk`
  const randomIP = generateRandomIP()
  const randomPhoneNumber = generateRandomPhoneNumber()
  signUpSuccess(groupMap.ticfCase1[0], userID, emailID, randomIP, randomPhoneNumber)
  sleep(3)
  identityProvingSuccess(groupMap.ticfCase3[0], userID, randomIP)
  console.log(userID)
}

export function ticf(): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const emailID = `perfHappyPath${uuidv4()}@digital.cabinet-office.gov.uk`
  const randomIP = generateRandomIP()
  const randomPhoneNumber = generateRandomPhoneNumber()

  iterationsStarted.add(1)

  signUpSuccess(groupMap.ticf[0], userID, emailID, randomIP, randomPhoneNumber)
  sleep(3)
  signInSuccess(groupMap.ticf[1], userID, emailID, randomIP, randomPhoneNumber)
  sleep(3)
  identityProvingSuccess(groupMap.ticf[2], userID, randomIP)
  sleep(3)
  identityReuseSuccess(groupMap.ticf[3], userID, randomIP)

  iterationsCompleted.add(1)
}

export function silentLogin(): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const emailID = `perfSilentLogin${uuidv4()}@digital.cabinet-office.gov.uk`
  const randomIP = generateRandomIP()
  const randomPhoneNumber = generateRandomPhoneNumber()

  iterationsStarted.add(1)

  signUpSuccess(groupMap.silentLogin[0], userID, emailID, randomIP, randomPhoneNumber)
  sleep(3)
  signInSuccess(groupMap.silentLogin[1], userID, emailID, randomIP, randomPhoneNumber)
  sleep(3)
  identityProvingSuccess(groupMap.silentLogin[2], userID, randomIP)

  iterationsCompleted.add(1)
}
