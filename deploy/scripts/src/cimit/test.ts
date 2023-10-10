import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { AWSConfig, SignatureV4 } from '../common/utils/jslib/aws'
import { generatePutCI, generateGetCIC, generatePostMitigations } from './requestGenerator/cimitReqGen'
import { group } from 'k6'
import http from 'k6/http'
import { type Options } from 'k6/options'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200 } from '../common/utils/checks/assertions'
import { SharedArray } from 'k6/data'

const profiles: ProfileList = {
  smoke: {
    putContraIndicators: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'putContraIndicators'
    },
    getContraIndicatorCredentials: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'getContraIndicatorCredentials'
    },
    postMitigations: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'postMitigations'
    }
  }
}

interface GetCICData { journeyID: string, userID: string }
const getCIC: GetCICData[] = new SharedArray('Get CIC Data', () => {
  return JSON.parse(open('./data/getCICData.json')).getCICUSers
})

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
  putCIURL: __ENV.IDENTITY_CIMIT_PUTCI,
  getCICURL: __ENV.IDENTITY_CIMIT_GETCIC,
  postMitigationURL: __ENV.IDENTITY_CIMIT_POSTMITIGATION
}

const credentials = (JSON.parse(__ENV.EXECUTION_CREDENTIALS) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: __ENV.AWS_REGION,
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})
const signer = new SignatureV4({
  service: 'lambda',
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
    sessionToken: awsConfig.sessionToken
  },
  uriEscapePath: true,
  applyChecksum: false
})

export function putContraIndicators (): void {
  const putContraIndicatorPayload = JSON.stringify(generatePutCI())
  const request = {
    method: 'POST',
    protocol: 'https' as const,
    hostname: `lambda.${awsConfig.region}.amazonaws.com`,
    path: `/2015-03-31/functions/${env.putCIURL}/invocations`,
    headers: {},
    body: putContraIndicatorPayload
  }
  const signedRequest = signer.sign(request)

  group('B01_CIMIT_01_PutContraIndicator POST', () => {
    timeRequest(() => http.post(signedRequest.url, putContraIndicatorPayload,
      {
        headers: signedRequest.headers,
        tags: { name: 'B01_CIMIT_01_PutContraIndicator' }
      }),
    { isStatusCode200 })
  })
}

export function getContraIndicatorCredentials (): void {
  const user = getCIC[Math.floor(Math.random() * getCIC.length)]
  const getCICPayload = JSON.stringify(generateGetCIC(user.journeyID, user.userID))
  const request = {
    method: 'POST',
    protocol: 'https' as const,
    hostname: `lambda.${awsConfig.region}.amazonaws.com`,
    path: `/2015-03-31/functions/${env.getCICURL}/invocations`,
    headers: {},
    body: getCICPayload
  }
  const signedRequest = signer.sign(request)

  group('B02_CIMIT_01_GetContraIndicatorCredentials GET', () =>
    timeRequest(() => http.post(signedRequest.url, getCICPayload,
      {
        headers: signedRequest.headers,
        tags: { name: 'B02_CIMIT_01_GetContraIndicatorCredentials' }
      }),
    { isStatusCode200 }))
}

export function postMitigations (): void {
  const postMitigationsPayload = JSON.stringify(generatePostMitigations())
  const request = {
    method: 'POST',
    protocol: 'https' as const,
    hostname: `lambda.${awsConfig.region}.amazonaws.com`,
    path: `/2015-03-31/functions/${env.postMitigationURL}/invocations`,
    headers: {},
    body: postMitigationsPayload
  }
  const signedRequest = signer.sign(request)

  group('B03_CIMIT_01_PostMitigations POST', () =>
    timeRequest(() => http.post(signedRequest.url, postMitigationsPayload,
      {
        headers: signedRequest.headers,
        tags: { name: 'B03_CIMIT_01_PostMitigations' }
      }),
    { isStatusCode200 }))
}
