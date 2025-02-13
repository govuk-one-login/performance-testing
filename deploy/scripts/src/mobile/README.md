# Mobile Performance Testing

This repository contains the performance test framework for testing DCMAW mobile journeys.


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