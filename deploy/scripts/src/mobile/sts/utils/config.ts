import { getEnv } from '../../../common/utils/config/environment-variables'

// Refer to deploy/scripts/README.md for guidance on how to set environment variables
export const environment = getEnv('ENVIRONMENT').toLocaleUpperCase()
const validEnvironments = ['BUILD', 'DEV']
if (!validEnvironments.includes(environment))
  throw new Error(`Environment '${environment}' not in [${validEnvironments.toString()}]`)

export const config = {
  stsBaseUrl: getEnv(`MOBILE_STS_${environment}_STS_BASE_URL`),
  stsMockClientBaseUrl: getEnv(`MOBILE_STS_${environment}_STS_MOCK_CLIENT_BASE_URL`),
  mockExternalCriBaseUrl: getEnv(`MOBILE_STS_${environment}_MOCK_EXTERNAL_CRI_BASE_URL`),
  orchestrationBaseUrl: getEnv(`MOBILE_STS_${environment}_ORCHESTRATION_BASE_URL`),
  mockClientId: getEnv(`MOBILE_STS_${environment}_MOCK_CLIENT_ID`),
  redirectUri: getEnv(`MOBILE_STS_${environment}_REDIRECT_URI`),
  clientInstanceKey: getEnv(`MOBILE_STS_${environment}_CLIENT_INSTANCE_KEY`),
  sqs_queue_url: getEnv(`MOBILE_STS_${environment}_SQS_QUEUE`)
}
