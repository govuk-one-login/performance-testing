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

export class S3Client {
  /**
   * S3Client interacts with the AWS Simple Storage Service (S3). With it, the
   * user ccan do several operations such as list buckets, list objects in
   * a bucket, or download objects from a bucket. For a full list of supported operations
   * https://grafana.com/docs/k6/latest/javascript-api/jslib/aws/s3client/
   *
   * @param {AWSConfig} config AWS Config to use to initialise the SQS client
   */
  constructor(config: AWSConfig)

  /**
   * Lists the buckets the authenticated user has access to in the region set by the S3Client instance’s configuration.
   * https://k6.io/docs/javascript-api/jslib/aws/sqsclient/sqsclient-listqueues/
   *
   * @returns A Promise that fulfills with an array of Bucket objects,
   * @example
   * const s3 = new S3Client(awsConfig)
   * const testBucketName = 'test-jslib-aws'
   *
   * // List the buckets the AWS authentication configuration gives us access to.
   * const buckets = await s3.listBuckets()
   *
   * // If our test bucket does not exist, abort the execution.
   * if (buckets.filter((b) => b.name === testBucketName).length == 0) {
   *     exec.test.abort()
   * }
   */
  listBuckets(): Promise<{
    name: string[]
    creationDate: string[]
  }>

  /**
   * Lists the objects contained in a bucket.
   * https://grafana.com/docs/k6/latest/javascript-api/jslib/aws/s3client/listobjects/
   *
   * @param {string} bucketName Name of the bucket to fetch the object from.
   * @param {string} prefix Limits the response to keys that begin with the specified prefix.
   * @example
   * const s3 = new S3Client(awsConfig)
   * const testBucketName = 'test-jslib-aws'
   * const testFileKey = 'bonjour.txt'
   * // List our bucket's objects
   *   const objects = await s3.listObjects(testBucketName);
   * // If our test object does not exist, abort the execution.
   *   if (objects.filter((o) => o.key === testFileKey).length == 0) {
   *   exec.test.abort()
   *   }
   */
  listObject(
    bucketName: string,
    prefix?: string
  ): {
    key: string
    lastModified: number
    etag: string
    size: number
    storageClass: string | Uint8Array | null
  }

  /**
   * Downloads an object from a bucket.
   * https://grafana.com/docs/k6/latest/javascript-api/jslib/aws/s3client/getobject/
   *
   * @param {string} bucketName Name of the bucket to fetch the object from.
   * @param {string} objectKey Name of the object to download.
   * @param {object} options Additional headers to send with the request
   * @example
   * const s3 = new S3Client(awsConfig)
   * const testBucketName = 'test-jslib-aws'
   * const testFileKey = 'bonjour.txt';
   * const objects = await s3.listObjects(testBucketName);
   * // If our test object does not exist, abort the execution.
   *  if (objects.filter((o) => o.key === testFileKey).length == 0) {
   *   exec.test.abort()
   *   }
   * // Let's download our test object and print its content
   *  const object = await s3.getObject(testBucketName, testFileKey);
   *  console.log(JSON.stringify(object));
   */
  getObject(
    bucketName: string,
    objectKey: string,
    additionalHeaders?: {
      Accept: string
    }
  ): Promise<{
    key: string
    lastModified: number
    etag: string
    size: number
    storageClass: string | Uint8Array | null
  }>
}
