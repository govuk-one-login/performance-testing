import { fail } from 'k6'

// __ENV is the syntax in k6 for accessing environment variables
// Refer to deploy/scripts/README.md for guidance on how to set environment variables
export const environment = __ENV.ENVIRONMENT.toLocaleUpperCase()
const validEnvironments = ['BUILD', 'DEV']
if (environment in validEnvironments) fail(`Environment '${environment}' not in ${validEnvironments.toString()}`)

export const config = {
  testClientExecuteUrl: __ENV[`MOBILE_${environment}_TEST_CLIENT_URL`],
  backendUrl: __ENV[`MOBILE_${environment}_BACKEND_URL`],
  frontendUrl: __ENV[`MOBILE_${environment}_FRONTEND_URL`]
}
