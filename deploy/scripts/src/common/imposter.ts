import http from 'k6/http'
import { getEnv } from './utils/config/environment-variables'

const env = {
  imposterStubURL: getEnv('IDENTITY_NINO_IMPOSTER_STUB_URL')
}
const payload = {
  reqBody: getEnv('IDENTITY_NINO_IMPOSTER_PAYLOAD')
}

export class Imposter {
  public handler() {
    const url = `https://${env.imposterStubURL}/build/individuals/authentication/authenticator/api/match`

    const body = JSON.stringify(payload.reqBody)

    const params = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer goodToken'
      }
    }

    const response = http.post(url, body, params)

    return response
  }
}
