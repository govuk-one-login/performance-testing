# koa-stub

This project contains source code and supporting files for a serverless application that you can deploy with the SAM CLI. It includes the following files and folders.

* src - Code for the application's Lambda function written in TypeScript.
* src/tests - Unit tests for the application code.
* template.yaml - A template that defines the application's AWS resources.

The application uses several AWS resources, including a Lambda function, an API Gateway API and a Dynamodb Table.

### Deploy the application

To use the SAM CLI, you need the following tools.

* SAM CLI - [Install the SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
* Node.js - [Install Node.js 20](https://nodejs.org/en/), including the NPM package management tool.
* Docker - [Install Docker community edition](https://hub.docker.com/search/?type=edition&offering=community)

### Use the SAM CLI to build and test locally

Build your application with the `sam build` command.

```bash
koa-stub$ sam build
```
The SAM CLI installs dependencies defined in `src/package.json`, compiles TypeScript with esbuild, creates a deployment package, and saves it in the `.aws-sam/build` folder.

The SAM CLI can also emulate your application's API. Use the `sam local start-api` to run the API locally on port 3000.

##### Local Service Dependencies

There are two service dependencies before you can start the SAM service

##### DynamoDB
You need to have created a dynamodb sessions table locally before this will work, to do that:
```bash
koa-stub$ docker run -p 8000:8000 amazon/dynamodb-local
```
Then, in a separate terminal create your SessionTable:
```bash
koa-stub$ aws dynamodb create-table --table-name SessionTable --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST --endpoint-url http://localhost:8000
```

##### OIDC Server

Then, in a separate terminal create your SessionTable:
```bash
koa-stub$ npx oauth2-mock-server
Generated new RSA key with kid "7ea4a872d0360ed571aee8b216313c91753601cae3bc2f15751840c1d463fda58af017a2ac575ba3"
OAuth 2 server listening on http://[::]:8080
OAuth 2 issuer is http://localhost:8080
```
Press ctrl-c to exit this server when you've finished with it.
##### Local API using SAM

You can then start the local api, using the example.json setup.
```bash
koa-stub$ sam local start-api --env-vars example.json
koa-stub$ curl http://localhost:3000/start
```

### Deploy to an env

To deploy to an env, for SSM parameters must be set:

- CLIENT_ID: "{{resolve:ssm:StubClientId:1}}"
- CLIENT_SECRET: "{{resolve:ssm:StubClientSecret:1}}"
- OIDC_ENDPOINT: "{{resolve:ssm:StubOIDCEndpoint:1}}"
- RESPONSE_ALG: "{{resolve:ssm:StubResponseAlgorithm:1}}"
- CALLBACK_URL: "{{resolve:ssm:StubCallbackUrl:1}}"  # This unfortunately needs to be set to a holding value until after the first deployment.

## Unit tests

Tests are defined in the `src/test` folder in this project.

```bash
koa-stub$ cd src
rp-stub$ npm install
rp-stub$ npm run test
```

## Bugs to resolve

- currently the env var for the callback URL has to be set after the first deployment to be able to use the API Gateway URL, otherwise you end up with a circular dependency.
- tests missing to explain which security capabilities have explicility not been set/bypassed in order for this to perform the function of a performance stub, not a reference implementation for an RP.
- more test coverage needed, and a different approach.
- local testing works using mocked aws-sdk and a mocked openid-client.

## Resources

See the [AWS SAM developer guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html) for an introduction to SAM specification, the SAM CLI, and serverless application concepts.