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

export function postGenerateClientAttestation(groupName: string, publicKeyJwk: JsonWebKey): string {
  const requestBody = {
    jwk: {
      kty: publicKeyJwk.kty,
      use: 'sig',
      crv: publicKeyJwk.crv,
      x: publicKeyJwk.x,
      y: publicKeyJwk.y
    }
  }

  const signedRequest = signRequest(
    getEnv('AWS_REGION'),
    credentials,
    'POST',
    config.stsMockClientBaseUrl.split('https://')[1],
    '/generate-client-attestation',
    {
      'Content-Type': 'application/json'
    },
    JSON.stringify(requestBody)
  )

  const res = timeGroup(
    groupName,
    () => {
      return http.post(signedRequest.url, JSON.stringify(requestBody), { headers: signedRequest.headers })
    },
    {
      isStatusCode200
    }
  )
  return res.json('client_attestation') as string
}
