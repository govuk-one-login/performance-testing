import { type Options } from 'k6/options'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { AWSConfig, SystemsManagerClient } from '../common/utils/jslib/aws-ssm'
import { type AssumeRoleOutput } from '../common/utils/aws/types'

const profiles: ProfileList = {
  smoke: {
    ssmTest: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '30s',
      exec: 'ssmTest'
    }
  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
  scenarios: loadProfile.scenarios
}

export function setup (): void {
  describeProfile(loadProfile)
}

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

export function ssmTest (): void {
  console.log(env.orchStubEndPoint.value)
}
