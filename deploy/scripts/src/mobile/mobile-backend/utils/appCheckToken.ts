import { getEnv } from '../../../common/utils/config/environment-variables'
import { AssumeRoleOutput } from '../../../common/utils/aws/types'
import { timeGroup } from '../../../common/utils/request/timing'
import http from 'k6/http'
import { isStatusCode200 } from '../../../common/utils/checks/assertions'
import { signRequest } from '../../utils/signatureV4'
import { config } from './config'

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials

export function getAppCheckToken(groupName: string): string {
  const signedRequest = signRequest(
    getEnv('AWS_REGION'),
    credentials,
    'GET',
    config.appCheckStubBaseUrl.split('https://')[1],
    '/app-check-token',
    {},
    ''
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
  return res.json('token') as string
}
