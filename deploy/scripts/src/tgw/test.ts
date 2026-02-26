import {
  selectProfile,
  createScenario,
  describeProfile,
  LoadProfile,
  type ProfileList,
  createI4PeakTestSignInScenario
} from '../common/utils/config/load-profiles'
import { type Options } from 'k6/options'
import http from 'k6/http'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200 } from '../common/utils/checks/assertions'
import { getEnv } from '../common/utils/config/environment-variables'
import { AssumeRoleOutput } from '../common/utils/aws/types'
import { getThresholds } from '../common/utils/config/thresholds'
import { AWSConfig } from '../common/utils/jslib/aws-sqs'
import { SignatureV4 } from '../common/utils/jslib/aws-signature'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('transitGateway', LoadProfile.smoke)
  },
  loadTest: {
    ...createI4PeakTestSignInScenario('transitGateway', 402, 3, 184)
  }
}

const loadProfile = selectProfile(profiles)

const groupMap = {
  transitGateway: ['B01_TransitGateway_01_InvokeLambda']
}

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
  describeProfile(loadProfile)
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
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

const env = {
  lambdaUrl: getEnv('PLATFORM_TGW_LAMBDA_URL'),
  targetUrl: getEnv('PLATFORM_TGW_TARGET_URL')
}

export function transitGateway(): void {
  const groups = groupMap.transitGateway
  const lambdaPayload = JSON.stringify({
    iterations: 1,
    url: env.targetUrl
  })

  const request = {
    method: 'POST',
    protocol: 'https' as const,
    hostname: `lambda.${awsConfig.region}.amazonaws.com`,
    path: `/2015-03-31/functions/${env.lambdaUrl}/invocations`,
    headers: {},
    body: lambdaPayload
  }
  const signedRequest = signer.sign(request)

  iterationsStarted.add(1)

  //  B01_TransitGateway_01_InvokeLambda
  timeGroup(groups[0], () => http.post(signedRequest.url, lambdaPayload, { headers: signedRequest.headers }), {
    isStatusCode200,
    ...pageContentCheck(env.targetUrl)
  })

  iterationsCompleted.add(1)
}
