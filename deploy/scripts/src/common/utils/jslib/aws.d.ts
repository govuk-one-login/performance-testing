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
  static fromEnvironment (): AWSConfig
}

export class SignatureV4 {
  /**
   * With SignatureV4, you can produce authenticated HTTP requests to AWS services.
   * Namely, it lets you sign and pre-sign requests to AWS services using the Signature V4 algorithm.
   * The sign operation produces a signed request with authorization information stored in its headers.
   * The presign operation produces a pre-signed request with authorization information stored in its query
   * string parameters
   * https://k6.io/docs/javascript-api/jslib/aws/
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
   * SignatureV4.sign() signs an HTTP request with the AWS Signature V4 algorithm.
   * https://k6.io/docs/javascript-api/jslib/aws/signaturev4/sign/
   */
  sign (request: {
    method: string
    protocol: 'http' | 'https'
    hostname: string
    path: string
    headers: Record<string, string>
    body?: string | ArrayBuffer
    query?: Record<string, string>
  }, overrides?: {
      signingDate?: Date
      signingService?: string
      signingRegion?: string
      unsignableHeaders?: Set<string>
      signableHeaders?: Set<string>
    }): {
    headers: Record<string, string>
    url: string
  }
}
