[![Publish](https://github.com/alphagov/di-devplatform-performance/actions/workflows/post-merge.yaml/badge.svg?branch=main)](https://github.com/alphagov/di-devplatform-performance/actions/workflows/post-merge.yaml)

# Performance Testing Framework

The following is an example performance test framework.

## Getting Started

Developer tools required:

* AWS CLI with credentials to your target AWS account
* AWS SAM CLI (`brew tap aws/tap && brew install aws-sam-cli`)
* pre-commit (`brew install pre-commit && pre-commit install && pre-commit install -tprepare-commit-msg -tcommit-msg`)
* GDS CLI (`brew tap alphagov/gds && brew install gds-cli`)

## k6.io

This framework is setup to execute [k6](k6.io) against stacks _in the same account_ as this performance test application.

## Environment Variables

This will run against one or more stacks.  To understand the environment, the K6 container will have the following env variables exposed:

```
$CFN_$StackName_$Output
```

The tests should aim to be 100% blackbox testing.
If the developers require further access, this should be exposed via a specific permission on the performance application roles/pipelines.  The application stacks themselves should not need to be modified at anything other than environment specific config.

The performance stack is independent of the application stacks, they should only integrate based on the output variables.

## Types of testing

### Product Level Load Testing

Where we're testing against a deployed 'product' in an environment.

### Stack Level Load Testing

Where we're testing against a particular CFN stack deployed to an environment.

### Third Party Load Testing

Where we're testing directly/indirectly to a third party.