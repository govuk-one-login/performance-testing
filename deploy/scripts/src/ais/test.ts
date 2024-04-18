import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { generatePersistIVRequest, interventionCodes } from './requestGenerator/aisReqGen'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { uuidv4 } from '../common/utils/jslib/index'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { SharedArray } from 'k6/data'
import http from 'k6/http'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('persistIV', LoadProfile.smoke),
    ...createScenario('retrieveIV', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('persistIV', LoadProfile.full, 30, 5),
    ...createScenario('retrieveIV', LoadProfile.full, 1000, 3)
  },
  stress: {
    ...createScenario('persistIV', LoadProfile.full, 100, 5),
    ...createScenario('retrieveIV', LoadProfile.full, 5700, 3)
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
const groupMap = {
  retrieveIV: ['B02_RetrieveIV_01_GetInterventionData']
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
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
  return open('./data/retrieveInterventionUser.csv')
    .split('\n')
    .slice(1)
    .map(userID => {
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

export function persistIV(): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  const persistIVPayload = generatePersistIVRequest(userID, interventionCodes.suspend)
  const persistIVMessage = JSON.stringify(persistIVPayload)
  iterationsStarted.add(1)
  sqs.sendMessage(env.sqs_queue, persistIVMessage)
  iterationsCompleted.add(1)
}

export function retrieveIV(): void {
  const groups = groupMap.retrieveIV
  const retrieveData = csvData[Math.floor(Math.random() * csvData.length)]
  iterationsStarted.add(1)

  // B02_RetrieveIV_01_GetInterventionData
  timeGroup(groups[0], () => http.get(env.aisEnvURL + `/v1/ais/${retrieveData.userID}?history=true`), {
    isStatusCode200,
    ...pageContentCheck('Perf Testing')
  })
  iterationsCompleted.add(1)
}

export function dataCreationForRetrieve(): void {
  const userID = `urn:fdc:gov.uk:2022:${uuidv4()}`
  iterationsStarted.add(1)
  const persistIVPayload = generatePersistIVRequest(userID, interventionCodes.block)
  const persistIVMessage = JSON.stringify(persistIVPayload)
  sqs.sendMessage(env.sqs_queue, persistIVMessage)
  console.log(userID)
  iterationsCompleted.add(1)
}
