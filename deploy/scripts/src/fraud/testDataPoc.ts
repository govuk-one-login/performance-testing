import { getEnv } from '../common/utils/config/environment-variables'
import { AssumeRoleOutput } from '../common/utils/aws/types'
import { AWSConfig, S3Client } from '../common/utils/jslib/aws-s3'
import { SharedArray } from 'k6/data'
// import { SharedArray } from 'k6/data'

const bucketDetails = {
  bucketName: getEnv('TICF_RAWDATA_S3_TEST_BUCKET'),
  fileName: getEnv('TICF_RAWDATA_TEST_FILE')
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})

interface RawData {
  requestOriginator: string
  subjectId: string
  requestType: string
  requestFieldName: string
  requestFieldValue: string
}

export async function setup(): Promise<RawData[]> {
  const s3 = new S3Client(awsConfig)
  const testBucketName = bucketDetails.bucketName
  const testFileKey = bucketDetails.fileName
  const object = await s3.getObject(testBucketName, testFileKey)
  // console.log(object)
  const testDataContent = JSON.stringify(object)
  console.log(testDataContent)
  // return testDataContent

  const splitData = new SharedArray<RawData>('rawData', function () {
    const testData = testDataContent.slice(117, -2).split('\\r\\n')
    const headers = testData[0].split(',')
    const users: RawData[] = []

    for (let i = 1; i < testData.length; i++) {
      if (testData[i].trim() === '') continue // Skip empty lines
      const values = testData[i].split(',')
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
  })

  console.log(`Loaded ${splitData.length} users in setup.`)
  return splitData
}

export default async function testDataPOC(splitData: RawData[]): Promise<void> {
  const userIndex: number = __VU % splitData.length
  const user: RawData = splitData[userIndex]
  console.log(`VU ${__VU} using requestField: ${user.requestOriginator}`)
  console.log(`VU ${__VU} using subjectID: ${user.subjectId}`)
  console.log(`VU ${__VU} using requestType: ${user.requestType}`)
  console.log(`VU ${__VU} using requestFieldName: ${user.requestFieldName}`)
  console.log(`VU ${__VU} using requestFieldValue: ${user.requestFieldValue}`)
}
