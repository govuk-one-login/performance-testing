import { getEnv } from '../../../common/utils/config/environment-variables'
import { AssumeRoleOutput } from '../../../common/utils/aws/types'
import { timeGroup } from '../../../common/utils/request/timing'
import http from 'k6/http'
import { isStatusCode200 } from '../../../common/utils/checks/assertions'
import { signRequest } from '../../utils/signatureV4'
import { config } from './config'

const credentialsEnvironmentVariable =
  getEnv('LOCAL', false) === 'true' ? 'STS_EXECUTION_CREDENTIALS' : 'EXECUTION_CREDENTIALS'
const credentials = (JSON.parse(getEnv(credentialsEnvironmentVariable)) as AssumeRoleOutput).Credentials

export function getPreAuthorizedCode(groupName: string): string {
  const signedRequest = signRequest(
    getEnv('AWS_REGION'),
    credentials,
    'GET',
    config.stsMockExternalCriBaseUrl.split('https://')[1],
    '/generate-pre-auth-code',
    {}
  )

  const res = timeGroup(
    groupName,
    () => {
      return http.get(signedRequest.url, { headers: signedRequest.headers })
    },
    {
      isStatusCode200
    }
  )
  return res.json('preAuthCode') as string
}
