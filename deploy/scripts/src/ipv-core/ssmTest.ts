import { AWSConfig, SystemsManagerClient } from '../common/utils/jslib/aws-ssm'
import { type AssumeRoleOutput } from '../common/utils/aws/types'

const credentials = (JSON.parse(__ENV.EXECUTION_CREDENTIALS) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: __ENV.AWS_REGION,
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})
const systemsManager = new SystemsManagerClient(awsConfig)
const testParameterName = '/perfTest/identity/orchStubUrl'
const env = {
  orchStubEndPoint: systemsManager.getParameter(testParameterName)
}

export default function (): void {
  console.log(env.orchStubEndPoint.value)
}
