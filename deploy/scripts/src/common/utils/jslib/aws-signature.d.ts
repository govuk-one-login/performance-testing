export class SignatureV4 {
  /**
   * With SignatureV4, you can produce authenticated HTTP requests to AWS services.
   * Namely, it lets you sign and pre-sign requests to AWS services using the Signature V4 algorithm.
   * The sign operation produces a signed request with authorization information stored in its headers.
   * The presign operation produces a pre-signed request with authorization information stored in its query
   * string parameters
   * https://k6.io/docs/javascript-api/jslib/aws/
   *
   * @param {string} service The AWS service to sign or pre-sign requests for
   * @param {string} region The AWS region to sign or pre-sign requests for
   * @param {object} credentials The AWS credentials to sign or pre-sign requests with.
   *                             An object with accessKeyId, secretAccessKeyId,
   *                             and optional sessionToken properties
   * @param {boolean} uriEscapePath Whether to uri-escape the request URI path
   *                                as part of computing the canonical request string
   * @param {boolean} applyChecksum Whether to calculate a checksum of the request body
   *                                and include it as either a request header (when signing)
   *                                or as a query string parameter (when pre-signing)
   * @example
   * const signer = new SignatureV4({
   *  service: 's3',
   *  region: awsConfig.region,
   *  credentials: {
   *    accessKeyId: awsConfig.accessKeyId,
   *    secretAccessKey: awsConfig.secretAccessKey,
   *    sessionToken: awsConfig.sessionToken,
   * },
   * uriEscapePath: false,
   * applyChecksum: false,
   * })
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
   *
   * @param {string} method The HTTP method of the request
   * @param {string} protocol The network protocol of the request. Accepted values 'http' and 'https'
   * @param {string} hostname The hostname the request is sent to
   * @param {string} path The path of the request
   * @param {object} headers The headers of the HTTP request
   * @param {string or ArrayBuffer} body The optional body of the HTTP request
   * @param {object} query The optional query parameters of the HTTP request
   * @example
   * const signedRequest = signer.sign(
   *  method: 'GET',
   *  protocol: 'https',
   *  hostname: 'mybucket.s3.us-east-1.amazonaws.com',
   *  path: '/myfile.txt',
   *  headers: {},
   * },
   * {
   * signingDate: new Date(),
   * signingService: 's3',
   * signingRegion: 'us-east-1',
   * })
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
