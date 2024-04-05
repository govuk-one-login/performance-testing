import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { AWSConfig } from '../common/utils/jslib/aws-sqs'
import { SignatureV4 } from '../common/utils/jslib/aws-signature'
import { generatePutCI, generateGetCIC, generatePostMitigations } from './requestGenerator/cimitReqGen'
import { group } from 'k6'
import http from 'k6/http'
import { type Options } from 'k6/options'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200 } from '../common/utils/checks/assertions'
import { SharedArray } from 'k6/data'
import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

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
  },
  lowVolumeTest: {
    putContraIndicators: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 30, duration: '5m' }, // Ramp up to 30 iterations per second in 5 minutes
        { target: 30, duration: '15m' }, // Maintain steady state at 30 iterations per second for 15 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'putContraIndicators'
    },
    getContraIndicatorCredentials: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 30, duration: '5m' }, // Ramp up to 30 iterations per second in 5 minutes
        { target: 30, duration: '15m' }, // Maintain steady state at 30 iterations per second for 15 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'getContraIndicatorCredentials'
    },
    postMitigations: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 30, duration: '5m' }, // Ramp up to 30 iterations per second in 5 minutes
        { target: 30, duration: '15m' }, // Maintain steady state at 30 iterations per second for 15 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'postMitigations'
    }
  },
  load: {
    putContraIndicators: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1200,
      stages: [
        { target: 400, duration: '15m' }, // Ramp up to 400 iterations per second in 15 minutes
        { target: 400, duration: '30m' }, // Maintain steady state at 400 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'putContraIndicators'
    },
    getContraIndicatorCredentials: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 500,
      stages: [
        { target: 100, duration: '15m' }, // Ramp up to 100 iterations per second in 15 minutes
        { target: 100, duration: '30m' }, // Maintain steady state at 100 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'getContraIndicatorCredentials'
    },
    postMitigations: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 500,
      stages: [
        { target: 100, duration: '15m' }, // Ramp up to 100 iterations per second in 15 minutes
        { target: 100, duration: '30m' }, // Maintain steady state at 100 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
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
const groupMap = {
  putContraIndicators: [
    'B01_CIMIT_01_PutContraIndicator'
  ],
  getContraIndicatorCredentials: [
    'B02_CIMIT_01_GetContraIndicatorCredentials'
  ],
  postMitigations: [
    'B03_CIMIT_01_PostMitigations'
  ]
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup (): void {
  describeProfile(loadProfile)
}

const env = {
  putCIURL: getEnv('IDENTITY_CIMIT_PUTCI'),
  getCICURL: getEnv('IDENTITY_CIMIT_GETCIC'),
  postMitigationURL: getEnv('IDENTITY_CIMIT_POSTMITIGATION')
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
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
  const groups = groupMap.putContraIndicators
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
  iterationsStarted.add(1)
  group(groups[0], () => timeRequest(() => // B01_CIMIT_01_PutContraIndicator
    http.post(signedRequest.url, putContraIndicatorPayload,
      {
        headers: signedRequest.headers
      }),
  { isStatusCode200 }))
  iterationsCompleted.add(1)
}

export function getContraIndicatorCredentials (): void {
  const groups = groupMap.getContraIndicatorCredentials
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
  iterationsStarted.add(1)
  group(groups[0], () => timeRequest(() => // B02_CIMIT_01_GetContraIndicatorCredentials
    http.post(signedRequest.url, getCICPayload,
      {
        headers: signedRequest.headers
      }),
  { isStatusCode200 }))
  iterationsCompleted.add(1)
}

export function postMitigations (): void {
  const groups = groupMap.postMitigations
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
  iterationsStarted.add(1)
  group(groups[0], () => timeRequest(() => // B03_CIMIT_01_PostMitigations
    http.post(signedRequest.url, postMitigationsPayload,
      {
        headers: signedRequest.headers
      }),
  { isStatusCode200 }))
  iterationsCompleted.add(1)
}
