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

## Run Command

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

## Generating Test Data

### STS Reauthentication Journey

The STS reauthentication journey requires a persistent session ID which is obtained from a previous authentication
journey with STS. In order to test this, we need to have pre-generated test data with the persistent session ID from a
previous journey. The test data for the dev and build environments is stored in
`./data/sts-reauthentication-test-data-DEV` and `./data/sts-reauthentication-test-data-BUILD`, respectively. The data in
these files is valid for up to 1 year, after which it will need regenerated.

To generate a new set of test data, if you have access to the performance test account PowerUser role, run the following
command from the `/deploy/scripts` directory:
```bash
EXECUTION_ROLE=arn:aws:iam::330163506186:role/perftest-PerformanceTesterRole
EXECUTION_CREDENTIALS=$(aws sts assume-role --role-arn $EXECUTION_ROLE --role-session-name `date +%s` --profile perf-test-prod-pu)

ENVIRONMENT=BUILD # replace with DEV if generating test data for the DEV environment

DATA_FILE_PATH=src/mobile/data
DATA_FILE_NAME=sts-reauthentication-test-data-$ENVIRONMENT.txt

MOBILE_STS_DEV_STS_BASE_URL=https://token.dev.account.gov.uk
MOBILE_STS_DEV_ORCHESTRATION_BASE_URL=https://auth-stub.mobile.dev.account.gov.uk
MOBILE_STS_DEV_MOCK_EXTERNAL_CRI_BASE_URL=https://mock-issuer.token.dev.account.gov.uk
MOBILE_STS_DEV_STS_MOCK_CLIENT_BASE_URL=https://mock-client.token.dev.account.gov.uk
MOBILE_STS_DEV_MOCK_CLIENT_ID=bCAOfDdDSwO4ug2ZNNU1EZrlGrg
MOBILE_STS_DEV_REDIRECT_URI=https://mobile.dev.account.gov.uk/redirect

MOBILE_STS_BUILD_STS_BASE_URL=https://token.build.account.gov.uk
MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL=https://auth-stub.mobile.build.account.gov.uk
MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL=https://mock-issuer.token.build.account.gov.uk
MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL=https://mock-client.token.build.account.gov.uk
MOBILE_STS_BUILD_MOCK_CLIENT_ID=krlMiqGQSwoDsF9lMKM6Nr4EbCo
MOBILE_STS_BUILD_REDIRECT_URI=https://mobile.build.account.gov.uk/redirect

# Need to update PROFILE env var below with profile that will generate largest set of test data, to ensure maximum amount of pre-generated test data is available for all tests
rm -f $DATA_FILE_PATH/$DATA_FILE_NAME && mkdir -p $DATA_FILE_NAME && touch $DATA_FILE_PATH/$DATA_FILE_NAME \
  && npm start && k6 run dist/mobile/sts.js -e PROFILE=smoke -e SCENARIO=generateReauthenticationTestData \
  -e EXECUTION_CREDENTIALS="$EXECUTION_CREDENTIALS" \
  -e MOBILE_STS_DEV_STS_BASE_URL=$MOBILE_STS_DEV_STS_BASE_URL \
  -e MOBILE_STS_DEV_STS_MOCK_CLIENT_BASE_URL=$MOBILE_STS_DEV_STS_MOCK_CLIENT_BASE_URL \
  -e MOBILE_STS_DEV_MOCK_EXTERNAL_CRI_BASE_URL=$MOBILE_STS_DEV_MOCK_EXTERNAL_CRI_BASE_URL \
  -e MOBILE_STS_DEV_ORCHESTRATION_BASE_URL=$MOBILE_STS_DEV_ORCHESTRATION_BASE_URL \
  -e MOBILE_STS_DEV_MOCK_CLIENT_ID=$MOBILE_STS_DEV_MOCK_CLIENT_ID \
  -e MOBILE_STS_DEV_REDIRECT_URI=$MOBILE_STS_DEV_REDIRECT_URI \
  -e MOBILE_STS_BUILD_STS_BASE_URL=$MOBILE_STS_BUILD_STS_BASE_URL \
  -e MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL=$MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL \
  -e MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL=$MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL \
  -e MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL=$MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL \
  -e MOBILE_STS_BUILD_MOCK_CLIENT_ID=$MOBILE_STS_BUILD_MOCK_CLIENT_ID \
  -e MOBILE_STS_BUILD_REDIRECT_URI=$MOBILE_STS_BUILD_REDIRECT_URI \
  -e ENVIRONMENT=$ENVIRONMENT -e AWS_REGION=eu-west-2 \
  --console-output $DATA_FILE_PATH/$DATA_FILE_NAME
```

If you do not have access to the performance test account PowerUser role (for example, if you have access to a role in
the STS account that has access to the stub APIs), run the following command from the `/deploy/scripts` directory to
generate a new set of test data:
```bash
AWS_PROFILE=<your-sts-aws-profile>  # Replace with STS profile from your AWS config
STS_EXECUTION_CREDENTIALS="$(jq -n --argjson Credentials "$(aws configure export-credentials --profile $AWS_PROFILE)" '{Credentials: $Credentials}')"

ENVIRONMENT=BUILD # replace with DEV if generating test data for the DEV environment

DATA_FILE_PATH=src/mobile/data
DATA_FILE_NAME=sts-reauthentication-test-data-$ENVIRONMENT.txt

MOBILE_STS_DEV_STS_BASE_URL=https://token.dev.account.gov.uk
MOBILE_STS_DEV_ORCHESTRATION_BASE_URL=https://auth-stub.mobile.dev.account.gov.uk
MOBILE_STS_DEV_MOCK_EXTERNAL_CRI_BASE_URL=https://mock-issuer.token.dev.account.gov.uk
MOBILE_STS_DEV_STS_MOCK_CLIENT_BASE_URL=https://mock-client.token.dev.account.gov.uk
MOBILE_STS_DEV_MOCK_CLIENT_ID=bCAOfDdDSwO4ug2ZNNU1EZrlGrg
MOBILE_STS_DEV_REDIRECT_URI=https://mobile.dev.account.gov.uk/redirect

MOBILE_STS_BUILD_STS_BASE_URL=https://token.build.account.gov.uk
MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL=https://auth-stub.mobile.build.account.gov.uk
MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL=https://mock-issuer.token.build.account.gov.uk
MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL=https://mock-client.token.build.account.gov.uk
MOBILE_STS_BUILD_MOCK_CLIENT_ID=krlMiqGQSwoDsF9lMKM6Nr4EbCo
MOBILE_STS_BUILD_REDIRECT_URI=https://mobile.build.account.gov.uk/redirect

# Need to update PROFILE env var below with profile that will generate largest set of test data, to ensure maximum amount of pre-generated test data is available for all tests
rm -f $DATA_FILE_PATH/$DATA_FILE_NAME && mkdir -p $DATA_FILE_NAME && touch $DATA_FILE_PATH/$DATA_FILE_NAME \
  && npm start && k6 run dist/mobile/sts.js -e PROFILE=smoke -e SCENARIO=generateReauthenticationTestData \
  -e STS_EXECUTION_CREDENTIALS="$STS_EXECUTION_CREDENTIALS" \
  -e MOBILE_STS_DEV_STS_BASE_URL=$MOBILE_STS_DEV_STS_BASE_URL \
  -e MOBILE_STS_DEV_STS_MOCK_CLIENT_BASE_URL=$MOBILE_STS_DEV_STS_MOCK_CLIENT_BASE_URL \
  -e MOBILE_STS_DEV_MOCK_EXTERNAL_CRI_BASE_URL=$MOBILE_STS_DEV_MOCK_EXTERNAL_CRI_BASE_URL \
  -e MOBILE_STS_DEV_ORCHESTRATION_BASE_URL=$MOBILE_STS_DEV_ORCHESTRATION_BASE_URL \
  -e MOBILE_STS_DEV_MOCK_CLIENT_ID=$MOBILE_STS_DEV_MOCK_CLIENT_ID \
  -e MOBILE_STS_DEV_REDIRECT_URI=$MOBILE_STS_DEV_REDIRECT_URI \
  -e MOBILE_STS_BUILD_STS_BASE_URL=$MOBILE_STS_BUILD_STS_BASE_URL \
  -e MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL=$MOBILE_STS_BUILD_STS_MOCK_CLIENT_BASE_URL \
  -e MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL=$MOBILE_STS_BUILD_MOCK_EXTERNAL_CRI_BASE_URL \
  -e MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL=$MOBILE_STS_BUILD_ORCHESTRATION_BASE_URL \
  -e MOBILE_STS_BUILD_MOCK_CLIENT_ID=$MOBILE_STS_BUILD_MOCK_CLIENT_ID \
  -e MOBILE_STS_BUILD_REDIRECT_URI=$MOBILE_STS_BUILD_REDIRECT_URI \
  -e ENVIRONMENT=$ENVIRONMENT -e AWS_REGION=eu-west-2 \
  -e LOCAL=true
  --console-output $DATA_FILE_PATH/$DATA_FILE_NAME
```

To allow for small differences in test runtime and to ensure that the test does not fail because there
is an insufficient amount of test data available, the `generateReauthenticationTestData` scenario should be run at a
load 10% greater than the load at which the reauthentication journey is tested.