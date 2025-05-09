import { getEnv } from '../../common/utils/config/environment-variables'

// Refer to deploy/scripts/README.md for guidance on how to set environment variables
export const environment = getEnv('ENVIRONMENT').toLocaleUpperCase()
const validEnvironments = ['BUILD', 'DEV']
if (!validEnvironments.includes(environment))
  throw new Error(`Environment '${environment}' not in [${validEnvironments.toString()}]`)

export const config = {
  testClientExecuteUrl: getEnv(`MOBILE_${environment}_TEST_CLIENT_URL`),
  backendUrl: getEnv(`MOBILE_${environment}_BACKEND_URL`),
  frontendUrl: getEnv(`MOBILE_${environment}_FRONTEND_URL`),
  dcaMockReadIdUrl: getEnv(`MOBILE_${environment}_DCAMOCK_READID_URL`),
  requestBody: getEnv(`MOBILE_${environment}_REQ_BODY`)
}
