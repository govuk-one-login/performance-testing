# koa-stub

This project contains source code and supporting files for a serverless application that you can deploy with the SAM CLI. It includes the following files and folders.

* src - Code for the application's Lambda function written in TypeScript.
* src/tests - Unit tests for the application code.
* template.yaml - A template that defines the application's AWS resources.

The application uses several AWS resources, including a Lambda function, an API Gateway API and a Dynamodb Table.

### Deploy the application

To use the SAM CLI, you need the following tools.

* SAM CLI - [Install the SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)
* Node.js - [Install Node.js 24](https://nodejs.org/en/), including the NPM package management tool.
* Docker - [Install Docker community edition](https://hub.docker.com/search/?type=edition&offering=community)

### Run locally

##### DynamoDB
You need to have created a dynamodb sessions table locally before this will work, to do that:
```bash
koa-stub$ docker run -p 8000:8000 amazon/dynamodb-local
```
Then, in a separate terminal create your SessionTable (one-time):
```bash
koa-stub$ aws dynamodb create-table --table-name SessionTable --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST --endpoint-url http://localhost:8000
```

##### OIDC Server

In a separate terminal:
```bash
koa-stub/src$ npm run mock-oidc
OAuth 2 issuer is http://localhost:8080
```
Press ctrl-c to exit this server when you've finished with it.

##### Local API

Set the required environment variables and start the app:
```bash
koa-stub/src$ CLIENT_ID=testclient CLIENT_SECRET=testsecret OIDC_ENDPOINT=http://localhost:8080 RESPONSE_ALG=RS256 SESSION_TABLE=SessionTable CALLBACK_URL=http://localhost:3000/callback npm start
koa-stub$ curl -L -c cookies.txt http://localhost:3000/start
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
koa-stub/src$ npm install
koa-stub/src$ npm run test
```

## Bugs to resolve

- currently the env var for the callback URL has to be set after the first deployment to be able to use the API Gateway URL, otherwise you end up with a circular dependency.
- tests missing to explain which security capabilities have explicility not been set/bypassed in order for this to perform the function of a performance stub, not a reference implementation for an RP.
- more test coverage needed, and a different approach.
- local testing works using mocked aws-sdk and a mocked openid-client.

## Resources

See the [AWS SAM developer guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html) for an introduction to SAM specification, the SAM CLI, and serverless application concepts.