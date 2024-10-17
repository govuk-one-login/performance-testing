import http from 'k6/http'
import { getEnv } from './utils/config/environment-variables'

const env = {
  imposterStubURL: getEnv('IDENTITY_IMPOSTER_STUB_URL'),
  environment: getEnv('ENVIRONMENT')
}
const payload = {
  reqBody: getEnv('IDENTITY_IMPOSTER_PAYLOAD')
}
const bearerToken = getEnv('IDENTITY_IMPOSTER_BEARER_TOKEN')

export class Imposter {
  public handler() {
    const req = {
      method: 'POST',
      url: `https://${env.imposterStubURL}/${env.environment}/individuals/authentication/authenticator/api/match`,
      body: JSON.stringify(payload.reqBody),
      params: {
        headers: {
          'Content-Type': 'application/json',
          Authorization: bearerToken
        }
      }
    }

    const reqArray = Array(10).fill(req)
    const response = http.batch(reqArray)

    return response
  }
}
