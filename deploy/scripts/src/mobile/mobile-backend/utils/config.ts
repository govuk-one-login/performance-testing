import { getEnv } from '../../../common/utils/config/environment-variables'
// Refer to deploy/scripts/README.md for guidance on how to set environment variables
export const environment = getEnv('ENVIRONMENT').toLocaleUpperCase()
const validEnvironments = ['BUILD', 'DEV']
if (!validEnvironments.includes(environment))
  throw new Error(`Environment '${environment}' not in [${validEnvironments.toString()}]`)

export const config = {
  mobileBackendBaseUrl: getEnv(`MOBILE_BACKEND_${environment}_MOBILE_BACKEND_BASE_URL`),
  appCheckStubBaseUrl: getEnv(`MOBILE_BACKEND_${environment}_APP_CHECK_STUB_BASE_URL`),
  oneLoginAppStsClientId: getEnv(`MOBILE_BACKEND_${environment}_ONE_LOGIN_APP_STS_CLIENT_ID`),
  oneLoginAppStsRedirectUri: getEnv(`MOBILE_BACKEND_${environment}_ONE_LOGIN_APP_STS_REDIRECT_URI`)
}
