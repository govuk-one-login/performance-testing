import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { lambdaHandler } from '../../callback';
import { expect, describe, it } from '@jest/globals';

describe('Unit test for callback handler', function () {
    const event: APIGatewayProxyEvent = {
        httpMethod: 'get',
        body: '',
        headers: {},
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: {},
        path: '/callback',
        pathParameters: {},
        queryStringParameters: {},
        requestContext: {
            accountId: '123456789012',
            apiId: '1234',
            authorizer: {},
            httpMethod: 'get',
            identity: {
                accessKey: '',
                accountId: '',
                apiKey: '',
                apiKeyId: '',
                caller: '',
                clientCert: {
                    clientCertPem: '',
                    issuerDN: '',
                    serialNumber: '',
                    subjectDN: '',
                    validity: { notAfter: '', notBefore: '' },
                },
                cognitoAuthenticationProvider: '',
                cognitoAuthenticationType: '',
                cognitoIdentityId: '',
                cognitoIdentityPoolId: '',
                principalOrgId: '',
                sourceIp: '',
                user: '',
                userAgent: '',
                userArn: '',
            },
            path: '/callback',
            protocol: 'HTTP/1.1',
            requestId: 'c6af9ac6-7b61-11e6-9a41-93e8deadbeef',
            requestTimeEpoch: 1428582896000,
            resourceId: '123456',
            resourcePath: '/callback',
            stage: 'dev',
        },
        resource: '',
        stageVariables: {},
    };
    const context: Context = {
        callbackWaitsForEmptyEventLoop: false,
        functionName: 'lambdaHandler',
        functionVersion: '1.0',
        invokedFunctionArn: 'arn:1234567890:lambda:lambdaHandler',
        memoryLimitInMB: '128',
        awsRequestId: '1234567890',
        logGroupName: 'lambdaHandlerLogGroup',
        logStreamName: 'c6a789dff9326bc178',
        getRemainingTimeInMillis: function (): number {
            throw new Error('Function not implemented.');
        },
        done: function (error?: Error, result?: any): void {
            throw new Error('Function not implemented.');
        },
        fail: function (error: string | Error): void {
            throw new Error('Function not implemented.');
        },
        succeed: function (messageOrObject: any): void {
            throw new Error('Function not implemented.');
        }
    };
    it('generates a valid redirect URL with the righ querystring params ', async () => {
        const result: APIGatewayProxyResult = await lambdaHandler(event, context);

        expect(result.statusCode).toEqual(301);
        expect(result.body).toContain("userinfo");
    });
});
