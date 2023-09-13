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

export class SystemsManagerClient {
  /**
   * SystemsManagerClient interacts with the AWS Systems Manager Service. With it, the
   * the user can get parameters from the Systems Manager Service in the
   * caller's AWS account and region the current region.
   * https://k6.io/docs/javascript-api/jslib/aws/systemsmanagerclient/
   *
   * @param {AWSConfig} config AWS Config is used to initialise the SystemsManager client
   */
  constructor (config: AWSConfig)

  /**
   *Gets a Systems Manager parameter in the caller's AWS account and region.
   * https://k6.io/docs/javascript-api/jslib/aws/systemsmanagerclient/systemsmanagerclient-getparameter/
   *
   * @returns A Promise that fulfills with an array of 'SystemsManagerParameter' objects.
   * @example
   * const systemsManager = new SystemsManagerClient(awsConfig)
   * const testParameterName = 'jslib-test-parameter'
   * const testParameterValue = 'jslib-test-value'
   *
   * // getParameter returns a parameter object: e.g. {name: string, value: string...}
   * const parameter = await systemsManager.getParameter(testParameterName);
   *
   *  // If the value of the parameter does not match the value of 'testParameterValue', abort the execution.
   * if (parameter.value !== testParameterValue) {
   *     exec.test.abort('test parameter not found')
   * }
   */
  getParameter (parameterName: string): {
    arn: string
    dataType: string
    lastModifiedDate: number
    name: string
    selector: string
    sourceResult: string
    type: string
    value: string
    version: string
  }
}
