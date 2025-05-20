import { SignatureV4 } from '../../common/utils/jslib/aws-signature'
import { AssumeRoleOutput } from '../../common/utils/aws/types'
import { getEnv } from '../../common/utils/config/environment-variables'

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
export const apiSignaturev4Signer = new SignatureV4({
  service: 'execute-api',
  region: getEnv('AWS_REGION'),
  credentials: {
    accessKeyId: credentials.AccessKeyId,
    secretAccessKey: credentials.SecretAccessKey,
    sessionToken: credentials.SessionToken
  },
  uriEscapePath: false,
  applyChecksum: false
})
