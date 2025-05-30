# Mobile Performance Testing

This repository contains the performance test framework for testing DCMAW journeys.

## Required Installations

Pre-commit for running pre-commit hooks locally

```bash
brew install pre-commit && pre-commit install && pre-commit install -tprepare-commit-msg -tcommit-msg
```

k6 for testing and executing scripts locally

```bash
brew install k6
```

Install test dependencies

```bash
npm install
```

## Run Tests

### ID Check V1

K6 environment variables can be found in config.ts file.
Test Scripts are located in the `/mobile` folder with naming convention `*.test.ts`. Profile and scenario can be found in each script file.

```bash
# Generating dist files
npm start
```

Replace `your_environment` variable with `DEV` or `BUILD` value. Replace the url variables with the corresponding one for the selected environment.

```bash
# Run k6 test. Replace with actual values
k6 run ./dist/mobile/<your_test_file>.test.js -e PROFILE=<your_profile_name> -e SCENARIO=<your_scenario_name> -e MOBILE_<your_environment>_TEST_CLIENT_URL=<your_test_client_execute_url> -e MOBILE_<your_environment>_BACKEND_URL=<your_backend_url> -e MOBILE_<your_environment>_FRONTEND_URL=<your_frontend_url> -e ENVIRONMENT=<your_environment>
```

### Mobile Backend

Performance test scripts for STS are found within `mobile-backend.ts`.

The below example commands for running the tests should be run from the `/deploy/scripts` directory. Tests can be run
using against either the Dev or Build environment by providing the respective value of the `ENVIRONMENT` environment
variable. The other environment variables will need updated to reflect the environment under test.

For example, to run tests against Build using the performance test role, run the following command:

```bash
EXECUTION_ROLE=arn:aws:iam::330163506186:role/perftest-PerformanceTesterRole
EXECUTION_CREDENTIALS=$(aws sts assume-role --role-arn $EXECUTION_ROLE --role-session-name `date +%s` --profile perf-test-prod-pu)

MOBILE_BACKEND_BUILD_MOBILE_BACKEND_BASE_URL=https://mobile.build.account.gov.uk
MOBILE_BACKEND_BUILD_APP_CHECK_STUB_BASE_URL=https://app-check-stub.mobile.build.account.gov.uk
MOBILE_BACKEND_BUILD_ONE_LOGIN_APP_STS_CLIENT_ID=bYrcuRVvnylvEgYSSbBjwXzHrwJ
MOBILE_BACKEND_BUILD_ONE_LOGIN_APP_STS_REDIRECT_URI=https://mobile.build.account.gov.uk/redirect

MOBILE_STS_BUILD_STS_BASE_URL=https://token.build.account.gov.uk
MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL=https://mock-client.token.build.account.gov.uk
MOBILE_STS_BUILD_MOCK_CLIENT_ID=krlMiqGQSwoDsF9lMKM6Nr4EbCo
MOBILE_STS_BUILD_REDIRECT_URI=https://mobile.build.account.gov.uk/redirect
MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL=https://mock-issuer.token.build.account.gov.uk
MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL=https://auth-stub.mobile.build.account.gov.uk

npm start && k6 run dist/mobile/mobile-backend.js \
  -e PROFILE=<profile> -e SCENARIO=<scenario> \
  -e EXECUTION_CREDENTIALS="$EXECUTION_CREDENTIALS" \
  -e MOBILE_BACKEND_BUILD_MOBILE_BACKEND_BASE_URL=$MOBILE_BACKEND_BUILD_MOBILE_BACKEND_BASE_URL \
  -e MOBILE_BACKEND_BUILD_APP_CHECK_STUB_BASE_URL=$MOBILE_BACKEND_BUILD_APP_CHECK_STUB_BASE_URL \
  -e MOBILE_BACKEND_BUILD_ONE_LOGIN_APP_STS_CLIENT_ID=$MOBILE_BACKEND_BUILD_ONE_LOGIN_APP_STS_CLIENT_ID \
  -e MOBILE_BACKEND_BUILD_ONE_LOGIN_APP_STS_REDIRECT_URI=$MOBILE_BACKEND_BUILD_ONE_LOGIN_APP_STS_REDIRECT_URI \
  -e MOBILE_STS_BUILD_STS_BASE_URL=$MOBILE_STS_BUILD_STS_BASE_URL \
  -e MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL=$MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL \
  -e MOBILE_STS_BUILD_MOCK_CLIENT_ID=$MOBILE_STS_BUILD_MOCK_CLIENT_ID \
  -e MOBILE_STS_BUILD_REDIRECT_URI=$MOBILE_STS_BUILD_REDIRECT_URI \
  -e MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL=$MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL \
  -e MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL=$MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL \
  -e ENVIRONMENT=BUILD -e AWS_REGION=eu-west-2
```

Due to current configuration of STS and Mobile Backend in Build, some STS and Mobile Backend tests may have some
dependencies on each other. When the tests are run in CodeBuild, the performance test account poweruser role is assumed,
and this role has access to all STS and Mobile Backend stubs that may need to be called during a test. However, if you
are running the tests locally and do not have access to this role, you may have to provide different sets of AWS
credentials to invoke the necessary stubs in the different accounts. This can be achieved by passing the environment
variable `LOCAL=true` and passing the `STS_EXECUTION_CREDENTIALS` environment variable instead of `EXECUTION_CREDENTIALS`.

```bash
AWS_PROFILE=<your-mobile-platform-aws-profile>  # Replace with Mobile Platform profile from your AWS config
MOBILE_PLATFORM_EXECUTION_CREDENTIALS="$(jq -n --argjson Credentials "$(aws configure export-credentials --profile $AWS_PROFILE)" '{Credentials: $Credentials}')"

MOBILE_BACKEND_BUILD_MOBILE_BACKEND_BASE_URL=https://mobile.build.account.gov.uk
MOBILE_BACKEND_BUILD_APP_CHECK_STUB_BASE_URL=https://app-check-stub.mobile.build.account.gov.uk
MOBILE_BACKEND_BUILD_ONE_LOGIN_APP_STS_CLIENT_ID=bYrcuRVvnylvEgYSSbBjwXzHrwJ
MOBILE_BACKEND_BUILD_ONE_LOGIN_APP_STS_REDIRECT_URI=https://mobile.build.account.gov.uk/redirect

MOBILE_STS_BUILD_STS_BASE_URL=https://token.build.account.gov.uk
MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL=https://mock-client.token.build.account.gov.uk
MOBILE_STS_BUILD_MOCK_CLIENT_ID=krlMiqGQSwoDsF9lMKM6Nr4EbCo
MOBILE_STS_BUILD_REDIRECT_URI=https://mobile.build.account.gov.uk/redirect
MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL=https://mock-issuer.token.build.account.gov.uk
MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL=https://auth-stub.mobile.build.account.gov.uk

npm start && k6 run dist/mobile/mobile-backend.js \
  -e PROFILE=<profile> -e SCENARIO=<scenario> \
  -e MOBILE_PLATFORM_EXECUTION_CREDENTIALS="$MOBILE_PLATFORM_EXECUTION_CREDENTIALS" \
  -e MOBILE_BACKEND_BUILD_MOBILE_BACKEND_BASE_URL=$MOBILE_BACKEND_BUILD_MOBILE_BACKEND_BASE_URL \
  -e MOBILE_BACKEND_BUILD_APP_CHECK_STUB_BASE_URL=$MOBILE_BACKEND_BUILD_APP_CHECK_STUB_BASE_URL \
  -e MOBILE_BACKEND_BUILD_ONE_LOGIN_APP_STS_CLIENT_ID=$MOBILE_BACKEND_BUILD_ONE_LOGIN_APP_STS_CLIENT_ID \
  -e MOBILE_BACKEND_BUILD_ONE_LOGIN_APP_STS_REDIRECT_URI=$MOBILE_BACKEND_BUILD_ONE_LOGIN_APP_STS_REDIRECT_URI \
  -e MOBILE_STS_BUILD_STS_BASE_URL=$MOBILE_STS_BUILD_STS_BASE_URL \
  -e MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL=$MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL \
  -e MOBILE_STS_BUILD_MOCK_CLIENT_ID=$MOBILE_STS_BUILD_MOCK_CLIENT_ID \
  -e MOBILE_STS_BUILD_REDIRECT_URI=$MOBILE_STS_BUILD_REDIRECT_URI \
  -e MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL=$MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL \
  -e MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL=$MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL \
  -e ENVIRONMENT=BUILD -e AWS_REGION=eu-west-2 \
  -e LOCAL=true
```