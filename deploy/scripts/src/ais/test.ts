import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { generatePersistIVRequest } from './requestGenerator/aisReqGen'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { uuidv4 } from '../common/utils/jslib/index'
import { group } from 'k6'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { SharedArray } from 'k6/data'
import http from 'k6/http'

const profiles: ProfileList = {
  smoke: {
    persistIV: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'persistIV'
    },
    retrieveIV: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'retrieveIV'
    }
  },
  lowVolumeTest: {
    persistIV: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 30, duration: '15m' }, // Ramp up to 30 iterations/messages per second in 15 minutes
        { target: 30, duration: '30m' }, // Maintain a steady state of 30 messages per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'persistIV'
    },
    retrieveIV: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 100, duration: '15m' }, // Ramp up to 100 iterations per second in 15 minutes
        { target: 100, duration: '30m' }, // Maintain a steady state of 100 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'retrieveIV'
    }
  },
  stress: {
    persistIV: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 500,
      stages: [
        { target: 100, duration: '15m' }, // Ramp up to 100 iterations/messages per second in 15 minutes
        { target: 100, duration: '30m' }, // Maintain a steady state of 100 messages per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'persistIV'
    },
    retrieveIV: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 11400,
      stages: [
        { target: 3800, duration: '15m' }, // Ramp up to 3800 iterations per second in 15 minutes
        { target: 3800, duration: '30m' }, // Maintain a steady state of 3800 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'retrieveIV'
    }
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

export function setup (): void {
  describeProfile(loadProfile)
}

const interventionCode = __ENV.ACCOUNT_BRAVO_AIS_IVCODE
const validIVCode = ['01', '02', '03', '04', '05', '06', '07']
if (!validIVCode.includes(interventionCode)) throw new Error(`Intervention Code '${interventionCode}' not in [${validIVCode.toString()}]`)

const env = {
  sqs_queue: __ENV.ACCOUNT_BRAVO_AIS_TxMASQS,
  aisEnvURL: __ENV.ACCOUNT_BRAVO_AIS_URL
}

interface RetrieveUserID {
  userID: string
}

const csvData: RetrieveUserID[] = new SharedArray('Retrieve Intervention User ID', function () {
  return open('./data/retrieveInterventionUser.csv').split('\n').slice(1).map((userID) => {
    return {
      userID
    }
  })
})

const credentials = (JSON.parse(__ENV.EXECUTION_CREDENTIALS) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: __ENV.AWS_REGION,
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})
const sqs = new SQSClient(awsConfig)

export function persistIV (): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const persistIVPayload = generatePersistIVRequest(userID, interventionCode)
  const persistIVMessage = JSON.stringify(persistIVPayload)
  iterationsStarted.add(1)
  sqs.sendMessage(env.sqs_queue, persistIVMessage)
  iterationsCompleted.add(1)
}

export function retrieveIV (): void {
  const retrieveData = csvData[Math.floor(Math.random() * csvData.length)]
  iterationsStarted.add(1)

  group('B02_RetrieveIV_01_GetInterventionData GET', () =>
    timeRequest(() => http.get(env.aisEnvURL + `/v1/ais/${retrieveData.userID}?history=true`),
      { isStatusCode200, ...pageContentCheck('vcs') }))
  iterationsCompleted.add(1)
}
