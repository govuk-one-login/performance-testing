import { getEnv } from '../common/utils/config/environment-variables'
import { AssumeRoleOutput } from '../common/utils/aws/types'
import { AWSConfig, S3Client } from '../common/utils/jslib/aws-s3'

const bucketDetails = {
  bucketName: getEnv('TICF_RAWDATA_S3_TEST_BUCKET'),
  fileName: getEnv('TICF_RAWDATA_TEST_FILE')
}

export default async function testDataPOC(): Promise<void> {
  const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
  const awsConfig = new AWSConfig({
    region: getEnv('AWS_REGION'),
    accessKeyId: credentials.AccessKeyId,
    secretAccessKey: credentials.SecretAccessKey,
    sessionToken: credentials.SessionToken
  })

  const s3 = new S3Client(awsConfig)
  const testBucketName = bucketDetails.bucketName
  const testFileKey = bucketDetails.fileName
  const object = await s3.getObject(testBucketName, testFileKey)

  console.log(JSON.stringify(object))
}
