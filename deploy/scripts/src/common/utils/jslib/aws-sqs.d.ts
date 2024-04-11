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
  constructor(options: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  });

  declare region;
  declare accessKeyId;
  declare secretAccessKey;
  declare sessionToken;
  declare scheme;
  declare endpoint;

  /**
   * Creates an AWSConfig using the `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
   * `AWS_SECRET_ACCESS_KEY` and `AWS_SESSION_TOKEN` environment variables.
   */
  static fromEnvironment(): AWSConfig;
}

export class SQSClient {
  /**
   * SQSClient interacts with the AWS Simple Queue Service (SQS). With it, the
   * user can send messages to specified queues and list available queues in
   * the current region.
   * https://k6.io/docs/javascript-api/jslib/aws/sqsclient/
   *
   * @param {AWSConfig} config AWS Config to use to initialise the SQS client
   */
  constructor(config: AWSConfig);

  /**
   * Retrieves a list of available Amazon Simple Queue Service (SQS) queues
   * https://k6.io/docs/javascript-api/jslib/aws/sqsclient/sqsclient-listqueues/
   *
   * @param {object} [options] Options for the request. Accepted properties are:
   *        `queueNamePrefix` (optional string) setting the prefix filter for
   *        the returned queue list, `maxResults` (optional number) setting the
   *        maximum number of results to include in the response (`1 <=
   *        maxResults <= 1000>`), and nextToken (optional string) setting the
   *        pagination token to request the next set of results.
   * @returns A Promise that fulfills with an object with an `urls` property
   *          containing an array of queue URLs, and an optional `nextToken`
   *          containing a pagination token to include in the next request when
   *          relevant.
   * @example
   * const sqs = new SQSClient(awsConfig)
   * const testQueue = 'https://sqs.us-east-1.amazonaws.com/000000000/test-queue'
   *
   * // List all queues in the AWS account
   * const queuesResponse = await sqs.listQueues()
   *
   * // If our test queue does not exist, abort the execution.
   * if (queuesResponse.queueUrls.filter((q) => q === testQueue).length == 0) {
   *     exec.test.abort()
   * }
   */
  listQueues(options?: {
    queueNamePrefix?: string;
    maxResults?: number;
    nextToken?: string;
  }): Promise<{
    urls: string[];
    nextToken?: string;
  }>;

  /**
   * Sends a message to the specified Amazon Simple Queue Service (SQS) queue.
   * https://k6.io/docs/javascript-api/jslib/aws/sqsclient/sqsclient-sendmessage/
   *
   * @param {string} queueUrl The URL of the Amazon SQS queue to which a
   *        message is sent. Queue URLs and names are case-sensitive.
   * @param {string} messageBody The message to send. The minimum size is one
   *        character. The maximum size is 256 KB.
   * @param {object} [options] Options for the request. Accepted properties are
   *        `messageDeduplicationId` (optional string) setting the message
   *        deduplication id, and `messageGroupId` (optional string) setting
   *        the message group ID for FIFO queues
   * @example
   * const sqs = new SQSClient(awsConfig)
   * const testQueue = 'https://sqs.us-east-1.amazonaws.com/000000000/test-queue'
   * const sentMessage = sqs.sendMessage(testQueue, JSON.stringify({value: '123'}))
   */
  sendMessage(
    queueUrl: string,
    messageBody: string,
    options?: {
      messageDeduplicationId?: string;
      messageGroupId?: string;
    }
  ): {
    id: string;
    bodyMD5: string;
  };
}
