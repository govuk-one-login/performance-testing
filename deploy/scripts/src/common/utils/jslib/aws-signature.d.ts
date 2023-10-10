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
