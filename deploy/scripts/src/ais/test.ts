import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { generatePersistIVRequest, interventionCodes } from './requestGenerator/aisReqGen'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { uuidv4 } from '../common/utils/jslib/index'
import { group } from 'k6'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { SharedArray } from 'k6/data'
import http from 'k6/http'
import { getEnv } from '../common/utils/config/environment-variables'

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
      maxVUs: 3000,
      stages: [
        { target: 1000, duration: '15m' }, // Ramp up to 1000 iterations per second in 15 minutes
        { target: 1000, duration: '30m' }, // Maintain a steady state of 1000 iterations per second for 30 minutes
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
      maxVUs: 17100,
      stages: [
        { target: 5700, duration: '15m' }, // Ramp up to 5700 iterations per second in 15 minutes
        { target: 5700, duration: '30m' }, // Maintain a steady state of 5700 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'retrieveIV'
    }
  },
  dataCreation: {
    dataCreationForRetrieve: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 500,
      maxDuration: '60m',
      exec: 'dataCreationForRetrieve'
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

const env = {
  sqs_queue: getEnv('ACCOUNT_BRAVO_AIS_TxMASQS'),
  aisEnvURL: getEnv('ACCOUNT_BRAVO_AIS_URL')
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

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})
const sqs = new SQSClient(awsConfig)

export function persistIV (): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const persistIVPayload = generatePersistIVRequest(userID, interventionCodes.suspend)
  const persistIVMessage = JSON.stringify(persistIVPayload)
  iterationsStarted.add(1)
  sqs.sendMessage(env.sqs_queue, persistIVMessage)
  iterationsCompleted.add(1)
}

export function retrieveIV (): void {
  const retrieveData = csvData[Math.floor(Math.random() * csvData.length)]
  iterationsStarted.add(1)

  group('B02_RetrieveIV_01_GetInterventionData GET', () =>
    timeRequest(() => http.get(env.aisEnvURL + `/v1/ais/${retrieveData.userID}?history=true`, {
      tags: { name: 'B02_RetrieveIV_01_GetInterventionData' }
    }),
    { isStatusCode200, ...pageContentCheck('Perf Testing') }))
  iterationsCompleted.add(1)
}

export function dataCreationForRetrieve (): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  iterationsStarted.add(1)
  const persistIVPayload = generatePersistIVRequest(userID, interventionCodes.block)
  const persistIVMessage = JSON.stringify(persistIVPayload)
  sqs.sendMessage(env.sqs_queue, persistIVMessage)
  console.log(userID)
  iterationsCompleted.add(1)
}
