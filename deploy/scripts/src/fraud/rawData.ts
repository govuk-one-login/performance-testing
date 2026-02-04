import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  createScenario,
  LoadProfile,
  describeProfile
} from '../common/utils/config/load-profiles'
import { getEnv } from '../common/utils/config/environment-variables'
import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { AWSConfig, S3Client } from '../common/utils/jslib/aws-s3'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import http from 'k6/http'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { timeGroup } from '../common/utils/request/timing'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('rawDataApi', LoadProfile.smoke)
  },
  perf006Iteration8PeakTest: {
    rawDataApi: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 150,
      maxVUs: 300,
      stages: [
        { target: 100, duration: '46s' },
        { target: 100, duration: '90m' }
      ],
      exec: 'rawDataApi'
    }
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  rawDataApi: ['B03_RawDataApi_01_RawDataAccess']
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'],
    http_req_failed: ['rate<0.05']
  }
}

const bucketDetails = {
  bucketName: getEnv('TICF_RAWDATA_S3_TEST_BUCKET'),
  fileName: getEnv('TICF_RAWDATA_TEST_FILE')
}

const env = {
  envName: getEnv('ENVIRONMENT'),
  rawDataApiURL: getEnv('TiCF_RAW_DATA_URL')
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})

const s3 = new S3Client(awsConfig)
interface RawData {
  requestOriginator: string
  subjectId: string
  requestType: string
  requestFieldName: string
  requestFieldValue: string
}

export async function setup(): Promise<RawData[]> {
  describeProfile(loadProfile)
  const testBucketName = bucketDetails.bucketName
  const testFileKey = bucketDetails.fileName
  const object = await s3.getObject(testBucketName, testFileKey)
  const testDataContent = JSON.stringify(object)
  console.log(testDataContent)
  const splitData = testDataContent.slice(117, -2).split('\\r\\n')
  const headers = splitData[0].split(',')
  const users: RawData[] = []

  for (let i = 1; i < splitData.length; i++) {
    if (splitData[i].trim() === '') continue // Skip empty lines
    const values = splitData[i].split(',')
    // Create a User object, ensuring properties match the interface
    const user: RawData = {
      requestOriginator: values[headers.indexOf('requestOriginator')].trim(),
      subjectId: values[headers.indexOf('subjectId')].trim(),
      requestType: values[headers.indexOf('requestType')].trim(),
      requestFieldName: values[headers.indexOf('requestFieldName')].trim(),
      requestFieldValue: values[headers.indexOf('requestFieldValue')].trim()
    }
    users.push(user)
  }
  return users
}

export function rawDataApi(users: RawData[]): void {
  const userIndex: number = __VU % users.length
  const user: RawData = users[userIndex]
  console.log(`VU ${__VU} using requestField: ${user.requestOriginator}`)
  console.log(`VU ${__VU} using subjectID: ${user.subjectId}`)
  console.log(`VU ${__VU} using requestType: ${user.requestType}`)
  console.log(`VU ${__VU} using requestFieldName: ${user.requestFieldName}`)
  console.log(`VU ${__VU} using requestFieldValue: ${user.requestFieldValue}`)
  const groups = groupMap.rawDataApi
  const rawDataRequestBody = JSON.stringify({
    requestOriginator: user.requestOriginator,
    subjectId: user.subjectId,
    requestType: user.requestType,
    requestField: { name: user.requestFieldName, value: user.requestFieldValue }
  })

  iterationsStarted.add(1)

  timeGroup(groups[0], () => http.post(`${env.rawDataApiURL}/${env.envName}/rawDataAccess`, rawDataRequestBody), {
    isStatusCode200,
    ...pageContentCheck('SUCCESSFUL')
  })

  iterationsCompleted.add(1)
}
