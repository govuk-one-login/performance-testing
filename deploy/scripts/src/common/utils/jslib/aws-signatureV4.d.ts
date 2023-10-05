export class AWSConfig {
  /**
   * AWSConfig is used to configure an AWS service client instance, such as
   * S3Client or SecretsManagerClient. It effectively allows the user to select
   * a region they wish to interact with, and the AWS credentials they wish to
   * use to authenticate.
   * https://k6.io/docs/javascript-api/jslib/aws/awsconfig/
   *
   * @param {string} region The AWS region to connect to. As described by Amazon AWS docs
   *        https://docs.aws.amazon.com/general/latest/gr/rande.html
   * @param {string} accessKeyId The AWS access key ID credential to use for authentication
   * @param {string} secretAccessKey The AWS secret access credential to use for authentication
   * @param {string} [sessionToken] The AWS secret access token to use for authentication
   * @example
   * const awsConfig = new AWSConfig({
   *  region: __ENV.AWS_REGION,
   *  accessKeyId: __ENV.AWS_ACCESS_KEY_ID,
   *  secretAccessKey: __ENV.AWS_SECRET_ACCESS_KEY,
   * })
   * const sqs = new SQSClient(awsConfig)
   */
  constructor (options: {
    region: string
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  })

  declare region
  declare accessKeyId
  declare secretAccessKey
  declare sessionToken
  declare scheme
  declare endpoint

  /**
   * Creates an AWSConfig using the `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
   * `AWS_SECRET_ACCESS_KEY` and `AWS_SESSION_TOKEN` environment variables.
   */
  declare static fromEnvironment (): AWSConfig
}

export class SignatureV4 {
  /**
   * With SignatureV4, you can produce authenticated HTTP requests to AWS services.
   * Namely, it lets you sign and pre-sign requests to AWS services using the Signature V4 algorithm.
   * The sign operation produces a signed request with authorization information stored in its headers.
   * The presign operation produces a pre-signed request with authorization information stored in its query
   * string parameters
   * https://k6.io/docs/javascript-api/jslib/aws/
   *
   * @param {string} service The AWS service to sign or pre-sign requests for.
   * @param {string} region The AWS region to sign or pre-sign requests for.
   * @param {object} credentials The AWS credentials to sign or pre-sign requests with.
   * @param {boolean} uriEscapePath Whether to uri-escape the request URI path as part of computing the canonical request string. As of late 2017, this is required for every AWS service except Amazon S3.
   * @param {boolean} applyChecksum Whether to calculate a checksum of the request body and include it as either a request header (when signing) or as a query string parameter (when pre-signing). This is required for AWS Glacier and Amazon S3 and optional for every other AWS service as of late 201
   * @example
   * const signer = new SignatureV4({
        service: 's3',
        region: awsConfig.region,
        credentials: {
            accessKeyId: awsConfig.accessKeyId,
            secretAccessKey: awsConfig.secretAccessKey,
            sessionToken: awsConfig.sessionToken,
        },
        uriEscapePath: false,
        applyChecksum: false,
    })
   */
  constructor (options: {
    service: string
    region: string
    credentials: {
      accessKeyId: string
      secretAccessKey: string
      sessionToken: string
    }
    uriEscapePath: boolean
    applyChecksum: boolean
  })

  /**
   * SignatureV4.presign() pre-signs a URL with the AWS Signature V4 algorithm
   * https://k6.io/docs/javascript-api/jslib/aws/signaturev4/presign/
   *
   * @param {string} method The HTTP method of the request.
   * @param {http or https string} protocol The network protocol of the request.
   * @param {string} hostname The hostname the request is sent to.
   * @param {string} path The path of the request.
   * @param {Object} headers The headers of the HTTP request.
   * @returns The presign operation returns an Object with the following properties
   * @param {Object} headers The pre-signed request headers to use in the context of a k6 HTTP request
   * @param {string} url The pre-signed url to use in the context of a k6 HTTP request
   * @example
   * const signedRequest = signer.presign(
   *  {
   *    method: 'GET',
   *    protocol: 'https',
   *    hostname: 'my-bucket.s3.us-east-1.amazonaws.com',
   *    path: '/my-file.txt',
   *    headers: { [AMZ_CONTENT_SHA256_HEADER]: 'UNSIGNED-PAYLOAD' }
   * })
   * console.log(`presigned URL: ${signedRequest.url}`)
   * const res = http.get(signedRequest.url, {
   *    headers: signedRequest.headers,
   * })
   * check(res, { 'status is 200': (r) => r.status === 200 })
   */
  presign (method: string,
    protocol: string,
    hostname: string,
    path: string,
    headers: Record<string, string>,): {
    headers: Record<string, string>
    url: string
  }

  /**
   * SignatureV4.sign() signs an HTTP request with the AWS Signature V4 algorithm.
   * https://k6.io/docs/javascript-api/jslib/aws/signaturev4/sign/
   *
   * @param {string} method The HTTP method of the request.
   * @param {http or https string} protocol The network protocol of the request.
   * @param {string} hostname The hostname the request is sent to.
   * @param {string} path The path of the request.
   * @param {Object} headers The headers of the HTTP request.
   * @param {string} body The optional body of the HTTP request
   * @param {Object} query The optional query parameters of the HTTP request
   * @returns The presign operation returns an Object with the following properties
   * @param {Object} headers The signed request's headers to use in the context of a k6 HTTP request.
   * @param {string} url The signed url to use in the context of a k6 HTTP request.
   * @example
   * @example
   * const signedRequest = signer.sign(
   *  {
   *    method: 'GET',
   *    protocol: 'https',
   *    hostname: 'my-bucket.s3.us-east-1.amazonaws.com',
   *    path: '/my-file.txt',
   *    headers: {}
   * })
   * http.get(signedRequest.url, { headers: signedRequest.headers })
   */

  sign (
    method: string,
    protocol: string,
    hostname: string,
    path: string,
    headers: Record<string, string>,
    body?: string,
    query?: Record<string, string>,): {
    headers: Record<string, string>
    url: string
  }
}
