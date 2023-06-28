// __ENV.<variable> refers to value of environment variable, either passed via the CLI
// or defined in the env/parameter-store section of the template.yaml
export const config = {
  testClientExecuteUrl: __ENV.MOBILE_TEST_CLIENT_EXECUTE_URL,
  backendUrl: __ENV.MOBILE_BACKEND_URL,
  frontendUrl: __ENV.MOBILE_FRONTEND_URL
}
