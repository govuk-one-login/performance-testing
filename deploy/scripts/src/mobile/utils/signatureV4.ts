import { SignatureV4 } from '../../common/utils/jslib/aws-signature'

type Credentials = {
  AccessKeyId: string
  SecretAccessKey: string
  SessionToken: string
}

export function signRequest(
  region: string,
  credentials: Credentials,
  method: string,
  hostname: string,
  path: string,
  headers: Record<string, string>,
  requestBody: string
): {
  headers: Record<string, string>
  url: string
} {
  const apiGatewaySigner = new SignatureV4({
    service: 'execute-api',
    region: region,
    credentials: {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken
    },
    uriEscapePath: false,
    applyChecksum: false
  })

  return apiGatewaySigner.sign({
    method,
    protocol: 'https',
    hostname,
    path,
    headers,
    body: requestBody
  })
}
