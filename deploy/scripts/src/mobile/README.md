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

```bash
# Run k6 test. Replace with actual values
k6 run ./dist/mobile/<your_test_file>.test.js -e PROFILE=<your_profile_name> -e SCENARIO=<your_scenario_name> -e MOBILE_TEST_CLIENT_EXECUTE_URL=<your_test_client_execute_url> -e MOBILE_BACK_END_URL=<your_backend_url> -e MOBILE_FRONT_END_URL=<your_frontend_url>
```