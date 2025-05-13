import { SignatureV4 } from "../../common/utils/jslib/aws-signature"
import { config } from "./config"

  const credentials = JSON.parse(config.awsExecutionCredentials)
  export const apiSignaturev4Signer = new SignatureV4({
    service: 'execute-api',
    region: "eu-west-2",
    credentials: {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    },
    uriEscapePath: false,
    applyChecksum: false
  })