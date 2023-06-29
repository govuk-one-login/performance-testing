export interface AWSConfigOptions {
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
}
export class AWSConfig {
  constructor (options: AWSConfigOptions)
  awsconfig (): void
}
export class SQSClient {
    constructor (config: AWSConfig)
    sendMessage (queueUrl: string, messageBody: string): void
}
