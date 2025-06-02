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
`./data/sts-reauthentication-test-data-DEV.json` and `./data/sts-reauthentication-test-data-BUILD.json`, respectively.
The data in these files is valid for up to 1 year, after which it will need to be regenerated.

Generating new sets of test data for the dev and build environments can be done automatically be running the respective
bash scripts, `./generate-sts-reauthentication-test-data-dev.sh $EXECUTION_CREDENTIALS` and
`./generate-sts-reauthentication-test-data-build.sh $EXECUTION_CREDENTIALS` when in the `/deploy/scripts/src/mobile`
directory, where `EXECUTION_CREDENTIALS` is the credentials you use to run the test script.

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