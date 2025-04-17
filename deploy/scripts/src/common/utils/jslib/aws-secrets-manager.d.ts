export class AWSConfig {
  /**
   * AWSConfig is used to configure an AWS service client instance, such as
   * S3Client or SecretsManagerClient. It effectively allows the user to select
   * a region they wish to interact with, and the AWS credentials they wish to
   * use to authenticate.
   * https://k6.io/docs/javascript-api/jslib/aws/awsconfig/
   *
   * @param {object} options Object containing the details of the AWS credentials to initialise the class
   * @param {string} options.region The AWS region to connect to. As described by Amazon AWS docs
   *        https://docs.aws.amazon.com/general/latest/gr/rande.html
   * @param {string} options.accessKeyId The AWS access key ID credential to use for authentication
   * @param {string} options.secretAccessKey The AWS secret access credential to use for authentication
   * @param {string} [options.sessionToken] The AWS secret access token to use for authentication
   * @example
   * const awsConfig = new AWSConfig({
   *  region: getEnv('AWS_REGION'),
   *  accessKeyId: getEnv('AWS_ACCESS_KEY_ID'),
   *  secretAccessKey: getEnv('AWS_SECRET_ACCESS_KEY'),
   * })
   * const sqs = new SQSClient(awsConfig)
   */
  constructor(options: { region: string; accessKeyId: string; secretAccessKey: string; sessionToken?: string })

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
  static fromEnvironment(): AWSConfig
}

export class SecretsManagerClient {
  /**
   * SecretsManagerClient interacts with AWS Secrets Manager. With it, the
   * user can retrieve values of secrets stored in the current region.
   * https://k6.io/docs/javascript-api/jslib/aws/secretsmanagerclient/
   *
   * @param {AWSConfig} config AWS Config to use to initialise the SQS client
   */
  constructor(config: AWSConfig)

  /**
   * Retreives the value of a secret from AWS Secrets Manager.
   * https://k6.io/docs/javascript-api/jslib/aws/secretsmanagerclient/getsecret/
   *
   * @param {string} secretID The name of the secret to retrieve..
   * @example
   * const secretsManager = new SecretsManagerClient(awsConfig)
   * const secret = secretsManager.getSecret('my-secret-value')
   */
  getSecret(secretID: string): Promise<{ name: string }>
}
