// __ENV is the syntax in k6 for accessing environment variables
// Refer to deploy/scripts/README.md for guidance on how to set environment variables
export const config = {
  testClientExecuteUrl: __ENV.MOBILE_TEST_CLIENT_EXECUTE_URL,
  backendUrl: __ENV.MOBILE_BACKEND_URL,
  frontendUrl: __ENV.MOBILE_FRONTEND_URL
}
