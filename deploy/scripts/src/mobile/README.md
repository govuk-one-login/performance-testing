# Mobile Performance Testing

This directory contains the performance test framework for testing DCMAW journeys.

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

### STS

Performance test scripts for STS are found within `sts.js`.

The below example commands for running the tests should be run from the `/deploy/scripts` directory. Tests can be run
using against either the Dev or Build environment by providing the respective value of the `ENVIRONMENT` environment
variable. The other environment variables will need updated to reflect the environment under test.

For example, to run tests against Build using the performance test role, run the following command:

```bash
EXECUTION_ROLE=arn:aws:iam::330163506186:role/perftest-PerformanceTesterRole
EXECUTION_CREDENTIALS=$(aws sts assume-role --role-arn $EXECUTION_ROLE --role-session-name `date +%s` --profile perf-test-prod-pu)

MOBILE_STS_BUILD_STS_BASE_URL=https://token.build.account.gov.uk
MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL=https://mock-client.token.build.account.gov.uk
MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL=https://auth-stub.mobile.build.account.gov.uk
MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL=https://mock-issuer.token.build.account.gov.uk
MOBILE_STS_BUILD_MOCK_CLIENT_ID=krlMiqGQSwoDsF9lMKM6Nr4EbCo
MOBILE_STS_BUILD_REDIRECT_URI=https://mobile.build.account.gov.uk/redirect

npm start && k6 run dist/mobile/sts.js \
  -e PROFILE=<profile> -e SCENARIO=<scenario> \
  -e EXECUTION_CREDENTIALS="$EXECUTION_CREDENTIALS" \
  -e MOBILE_STS_BUILD_STS_BASE_URL=$MOBILE_STS_BUILD_STS_BASE_URL \
  -e MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL=$MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL \
  -e MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL=$MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL \
  -e MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL=$MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL \
  -e MOBILE_STS_BUILD_MOCK_CLIENT_ID=$MOBILE_STS_BUILD_MOCK_CLIENT_ID \
  -e MOBILE_STS_BUILD_REDIRECT_URI=$MOBILE_STS_BUILD_REDIRECT_URI \
  -e ENVIRONMENT=BUILD -e AWS_REGION=eu-west-2
```

Due to current configuration of STS and Mobile Backend in Build, some STS and Mobile Backend tests may have some
dependencies on each other. When the tests are run in CodeBuild, the performance test account poweruser role is assumed,
and this role has access to all STS and Mobile Backend stubs that may need to be called during a test. However, if you
are running the tests locally and do not have access to this role, you may have to provide different sets of AWS
credentials to invoke the necessary stubs in the different accounts. This can be achieved by passing the environment
variable `LOCAL=true` and passing the `STS_EXECUTION_CREDENTIALS` environment variable instead of `EXECUTION_CREDENTIALS`.

```bash
AWS_PROFILE=<your-sts-aws-profile>  # Replace with STS profile from your AWS config
STS_EXECUTION_CREDENTIALS="$(jq -n --argjson Credentials "$(aws configure export-credentials --profile $AWS_PROFILE)" '{Credentials: $Credentials}')"

MOBILE_STS_BUILD_STS_BASE_URL=https://token.build.account.gov.uk
MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL=https://mock-client.token.build.account.gov.uk
MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL=https://auth-stub.mobile.build.account.gov.uk
MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL=https://mock-issuer.token.build.account.gov.uk
MOBILE_STS_BUILD_MOCK_CLIENT_ID=krlMiqGQSwoDsF9lMKM6Nr4EbCo
MOBILE_STS_BUILD_REDIRECT_URI=https://mobile.build.account.gov.uk/redirect

npm start && k6 run dist/mobile/sts.js \
  -e PROFILE=<profile> -e SCENARIO=<scenario> \
  -e STS_EXECUTION_CREDENTIALS="$STS_EXECUTION_CREDENTIALS" \
  -e MOBILE_STS_BUILD_STS_BASE_URL=$MOBILE_STS_BUILD_STS_BASE_URL \
  -e MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL=$MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL \
  -e MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL=$MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL \
  -e MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL=$MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL \
  -e MOBILE_STS_BUILD_MOCK_CLIENT_ID=$MOBILE_STS_BUILD_MOCK_CLIENT_ID \
  -e MOBILE_STS_BUILD_REDIRECT_URI=$MOBILE_STS_BUILD_REDIRECT_URI \
  -e ENVIRONMENT=BUILD -e AWS_REGION=eu-west-2 \
  -e LOCAL=true
```

### Mobile Backend

Performance test scripts for Mobile Backend are at the top level of the `mobile` directory and start with the prefix
`mobile-backend-`.

The below example commands for running the tests should be run from the `/deploy/scripts` directory. Tests can be run
using against either the Dev or Build environment by providing the respective value of the `ENVIRONMENT` environment
variable. The other environment variables will need updated to reflect the environment under test.

For example, to run tests against Build using the performance test role, run the following command:

```bash
EXECUTION_ROLE=arn:aws:iam::330163506186:role/perftest-PerformanceTesterRole
EXECUTION_CREDENTIALS=$(aws sts assume-role --role-arn $EXECUTION_ROLE --role-session-name `date +%s` --profile perf-test-prod-pu)

MOBILE_BACKEND_BUILD_MOBILE_BACKEND_BASE_URL=https://mobile.build.account.gov.uk
MOBILE_BACKEND_BUILD_APP_CHECK_STUB_BASE_URL=https://app-check-stub.mobile.build.account.gov.uk

npm start && k6 run dist/mobile/mobile-backend-get-client-attestation.js \
  -e PROFILE=<profile> -e SCENARIO=<scenario> \
  -e EXECUTION_CREDENTIALS="$EXECUTION_CREDENTIALS" \
  -e MOBILE_BACKEND_BUILD_MOBILE_BACKEND_BASE_URL=$MOBILE_BACKEND_BUILD_MOBILE_BACKEND_BASE_URL \
  -e MOBILE_BACKEND_BUILD_APP_CHECK_STUB_BASE_URL=$MOBILE_BACKEND_BUILD_APP_CHECK_STUB_BASE_URL \
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

npm start && k6 run dist/mobile/mobile-backend-get-client-attestation.js \
  -e PROFILE=<profile> -e SCENARIO=<scenario> \
  -e MOBILE_PLATFORM_EXECUTION_CREDENTIALS="$MOBILE_PLATFORM_EXECUTION_CREDENTIALS" \
  -e MOBILE_BACKEND_BUILD_MOBILE_BACKEND_BASE_URL=$MOBILE_BACKEND_BUILD_MOBILE_BACKEND_BASE_URL \
  -e MOBILE_BACKEND_BUILD_APP_CHECK_STUB_BASE_URL=$MOBILE_BACKEND_BUILD_APP_CHECK_STUB_BASE_URL \
  -e ENVIRONMENT=BUILD -e AWS_REGION=eu-west-2 \
  -e LOCAL=true
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

## Generating Test Data

### STS Reauthentication Journey

The STS reauthentication journey requires a persistent session ID which is obtained from a previous authentication
journey with STS. In order to test this, we need to have pre-generated test data with the persistent session ID from a
previous journey. The test data for the dev and build environments is stored in
`./data/sts-reauthentication-test-data-DEV.json` and `./data/sts-reauthentication-test-data-BUILD.json`, respectively.
The data in these files is valid for up to 1 year, after which it will need to be regenerated.

Generating new sets of test data for the dev and build environments can be done automatically by running the bash scripts on [this confluence page](https://govukverify.atlassian.net/wiki/spaces/QE/pages/5449482527/How+to+Generate+Test+Data+for+STS+Reauthentication+Journey).

The commands below can be used to generate the test data for Build, depending on which credentials you have access to.
These commands must be run from this directory to ensure test data is output to the correct location.

If you have access to the performance test account PowerUser role:

```bash
EXECUTION_ROLE=arn:aws:iam::330163506186:role/perftest-PerformanceTesterRole
EXECUTION_CREDENTIALS=$(aws sts assume-role --role-arn $EXECUTION_ROLE --role-session-name `date +%s` --profile perf-test-prod-pu)
./generate-sts-reauthentication-test-data-build.sh $EXECUTION_CREDENTIALS
```

If you have access to the corresponding STS role for the dev or build environments:

```bash
AWS_PROFILE=<your-sts-aws-profile>
STS_EXECUTION_CREDENTIALS="$(jq -n --argjson Credentials "$(aws configure export-credentials --profile $AWS_PROFILE)" '{Credentials: $Credentials}')"
./generate-sts-reauthentication-test-data-build.sh $EXECUTION_CREDENTIALS
```

To allow for small differences in test runtime and to ensure that the test does not fail because there
is an insufficient amount of test data available, the `generateReauthenticationTestData` scenario should be run at a
load 10% greater than the load at which the reauthentication journey is tested.
