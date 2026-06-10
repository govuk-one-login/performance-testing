import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI3SpikeSignUpScenario,
  createI3SpikeSignInScenario,
  createI4PeakTestSignUpScenario,
  createI4PeakTestSignInScenario,
  createStressTestSignUpScenario,
  createStressTestSignInScenario
} from '../common/utils/config/load-profiles'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import {
  generateAuthRequest,
  generateF2FRequest,
  generateIPVRequest,
  generateDocumentUploadedRequest
} from './requestGenerator/ipvrReqGen'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { uuidv4 } from '../common/utils/jslib/index'
import { getEnv } from '../common/utils/config/environment-variables'
import http from 'k6/http'
import { sleep } from 'k6'
import { timeGroup } from '../common/utils/request/timing'
//import { isStatusCode302 } from '../common/utils/checks/assertions'
import { URL } from '../common/utils/jslib/url'
import { isStatusCode200, isSpecificStatusCode, pageContentCheck } from '../common/utils/checks/assertions'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('authEvent', LoadProfile.smoke),
    ...createScenario('allEvents', LoadProfile.smoke),
    ...createScenario('IPVR_FE', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('authEvent', LoadProfile.short, 30, 2),
    ...createScenario('allEvents', LoadProfile.short, 3, 2)
  },
  stress: {
    ...createScenario('authEvent', LoadProfile.full, 2000, 2),
    ...createScenario('allEvents', LoadProfile.full, 12, 2)
  },
  perf006Iteration2PeakTest: {
    authEvent: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 11, duration: '6s' },
        { target: 11, duration: '30m' }
      ],
      exec: 'authEvent'
    },
    allEvents: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 3, duration: '4s' },
        { target: 3, duration: '30m' }
      ],
      exec: 'allEvents'
    }
  },
  spikeI2HighTraffic: {
    ...createScenario('authEvent', LoadProfile.spikeI2HighTraffic, 32),
    ...createScenario('allEvents', LoadProfile.spikeI2HighTraffic, 1)
  },
  perf006Iteration3PeakTest: {
    authEvent: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 24, duration: '12s' },
        { target: 24, duration: '30m' }
      ],
      exec: 'authEvent'
    },
    allEvents: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 4, duration: '5s' },
        { target: 4, duration: '30m' }
      ],
      exec: 'allEvents'
    }
  },
  perf006Iteration3SpikeTest: {
    ...createI3SpikeSignUpScenario('allEvents', 12, 20, 13),
    ...createI3SpikeSignInScenario('authEvent', 71, 5, 7)
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('allEvents', 12, 20, 13),
    ...createI4PeakTestSignInScenario('authEvent', 43, 5, 21)
  },
  perf006Iteration5SpikeTest: {
    ...createI3SpikeSignUpScenario('allEvents', 28, 20, 29),
    ...createI3SpikeSignInScenario('authEvent', 162, 5, 74)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('allEvents', 5, 20, 6),
    ...createI4PeakTestSignInScenario('authEvent', 71, 5, 33)
  },
  perf006Iteration8PeakTest: {
    ...createI4PeakTestSignUpScenario('allEvents', 4, 20, 5),
    ...createI4PeakTestSignInScenario('authEvent', 126, 5, 58)
  },
  perf006Iteration8SpikeTest: {
    ...createI3SpikeSignUpScenario('allEvents', 16, 20, 17),
    ...createI3SpikeSignInScenario('authEvent', 227, 5, 104)
  },
  perf006Iteration9StressTest: {
    ...createStressTestSignUpScenario('allEvents', 16, 20, 17, 33),
    ...createStressTestSignInScenario('authEvent', 250, 5, 115)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  IPVR_FE: [
    'B01_OIDCStub_01_GET_/authorize',
    'B02_IPVR_FE_02_POST_/login',
    'B03_IPVR_FE_03_POST_/continue',
    'B04_IPVR_FE_04_GET_/govuk-redirect'
  ]
} as const

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
  sqs_queue: getEnv('IDENTITY_KIWI_STUB_SQS'),
  OIDC_STUB_URL: getEnv('IDENTITY_OIDC_STUB_URL'),
  CLIENT_ID: getEnv('IDENTITY_OIDC_STUB_CLIENT_ID'),
  REDIRECT_URI: getEnv('IDENTITY_OIDC_STUB_REDIRECT_URI'),
  OIDC_STUB_PASSWORD: getEnv('IDENTITY_OIDC_STUB_PASSWORD')
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})

const sqs = new SQSClient(awsConfig)

export function authEvent(): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const signinJourneyID = uuidv4()
  const authPayload = generateAuthRequest(userID, signinJourneyID)
  const authEventMessage = JSON.stringify(authPayload)
  iterationsStarted.add(1)
  sqs.sendMessage(env.sqs_queue, authEventMessage)
  iterationsCompleted.add(1)
}

export function allEvents(): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const signinJourneyID = uuidv4()
  const authPayload = generateAuthRequest(userID, signinJourneyID)
  const f2fPayload = generateF2FRequest(userID, signinJourneyID)
  const docUploadPayload = generateDocumentUploadedRequest(userID)
  const ipvPayload = generateIPVRequest(userID, signinJourneyID)
  iterationsStarted.add(1)
  sqs.sendMessage(env.sqs_queue, JSON.stringify(authPayload))
  sleep(5)
  sqs.sendMessage(env.sqs_queue, JSON.stringify(f2fPayload))
  sleep(5)
  sqs.sendMessage(env.sqs_queue, JSON.stringify(docUploadPayload))
  sleep(5)
  sqs.sendMessage(env.sqs_queue, JSON.stringify(ipvPayload))
  iterationsCompleted.add(1)
}

/* IPVR_FE() function to be executed after the 'allevents' scenario to validate the IPVR FE journey.
 It simulates a user going through the OIDC stub and being redirected to the GOV.UK sign in page.
 BE to FE journey validation for IPVR, simulating a user going through the OIDC stub and being redirected to the GOV.UK sign in page.
*/
export function IPVR_FE(): void {
  // Construct the OIDC authorization URL with necessary query parameters
  const url = new URL(`${env.OIDC_STUB_URL}/authorize`)
  url.searchParams.set('client_id', env.CLIENT_ID)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid profile')
  url.searchParams.set('redirect_uri', env.REDIRECT_URI)
  url.searchParams.set('nonce', uuidv4())

  // Step 1: GET OIDC stub login page
  const loginPage = timeGroup(groupMap.IPVR_FE[0], () => http.get(url.href), { isStatusCode200 })
  console.log(`Step 1 url: ${loginPage.headers.referer}`)

  // Step 2: Submit login form with userId and password
  const submitPage = timeGroup(
    groupMap.IPVR_FE[1],
    () =>
      loginPage.submitForm({
        fields: {
          login: `${uuidv4()}@example.com`,
          password: env.OIDC_STUB_PASSWORD
        },
        submitSelector: '[type="submit"]'
      }),
    { isStatusCode200 }
  )
  console.log(`submitPage.body: ${submitPage.body}`)

  // Step 3: Click Continue or confirm button to follow redirect to GOV.UK page
  const govukPage = timeGroup(
    groupMap.IPVR_FE[2],
    () =>
      submitPage.submitForm({
        submitSelector: '.login.login-submit'
      }),
    { ...isSpecificStatusCode(202) }
  )

  console.log(`Step 3 status: ${govukPage.status}`)
  console.log(`Step 3 URL: ${govukPage.url}`)
  console.log(`Step 3 body: ${govukPage.body}`)

  // Step 4: Follow redirect to GOV.UK page
  const GOVUKsignInpage = timeGroup(groupMap.IPVR_FE[3], () => http.get(govukPage.headers['Location']), {
    ...pageContentCheck('Create your GOV.UK One Login or sign in')
  })
  console.log(`Step 4 status: ${GOVUKsignInpage.status}`)
  console.log(`Step 4 URL: ${GOVUKsignInpage.url}`)
  console.log(`Step 4 body: ${GOVUKsignInpage.body}`)
}
