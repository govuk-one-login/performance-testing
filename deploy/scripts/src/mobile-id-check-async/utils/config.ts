import { AssumeRoleOutput } from '../../common/utils/aws/types'
import { getEnv } from '../../common/utils/config/environment-variables'

// Refer to deploy/scripts/README.md for guidance on how to set environment variables
export const environment = getEnv('ENVIRONMENT').toLocaleUpperCase()
const validEnvironments = ['BUILD', 'DEV']
if (!validEnvironments.includes(environment))
  throw new Error(`Environment '${environment}' not in [${validEnvironments.toString()}]`)

export const config = {
  awsExecutionCredentials: getEnv('EXECUTION_CREDENTIALS'),
  clientId: getEnv(`MOBILE_ID_CHECK_ASYNC_${environment}_CLIENT_ID`),
  clientSecret: getEnv(`MOBILE_ID_CHECK_ASYNC_${environment}_CLIENT_SECRET`),
  privateApiUrl: getEnv(`MOBILE_ID_CHECK_ASYNC_${environment}_PRIVATE_API_URL`),
  proxyApiUrl: getEnv(`MOBILE_ID_CHECK_ASYNC_${environment}_PROXY_API_URL`),
  readidMockApiUrl: getEnv(`MOBILE_ID_CHECK_ASYNC_${environment}_READ_ID_MOCK_API_URL`),
  sessionsApiUrl: getEnv(`MOBILE_ID_CHECK_ASYNC_${environment}_SESSIONS_API_URL`),
  stsMockApiUrl: getEnv(`MOBILE_ID_CHECK_ASYNC_${environment}_STS_MOCK_API_URL`),
  useProxyApi: getEnv(`MOBILE_ID_CHECK_ASYNC_${environment}_USE_PROXY_API`),
  biometricSessionTestData: getEnv(`MOBILE_ID_CHECK_ASYNC_${environment}_BIOMETRIC_SESSION_TEST_DATA`)
}
