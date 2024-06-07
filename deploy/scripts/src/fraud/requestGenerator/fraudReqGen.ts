import { type FraudRequest } from './fraudReqFormat'
import { uuidv4 } from '../../common/utils/jslib/index'
import { b64encode } from 'k6/encoding'
import crypto, { Algorithm } from 'k6/crypto'
import { getEnv } from '../../common/utils/config/environment-variables'

export function generateRequest(): FraudRequest {
  const audClientID = uuidv4()
  const sampleFraudRequest: FraudRequest = {
    iss: 'https://performancetest.onelogin.gov/',
    jti: `performance-test-${audClientID}`,
    iat: Math.round(Date.now() / 1000),
    aud: 'https://ssf.account.gov.uk/',
    events: {
      'https://vocab.account.gov.uk/secevent/v1/notification/accountBlock': {
        subject: {
          format: 'uri',
          uri: 'urn:fdc:gov.uk:2022:56P4CMsGh_02YOlWpd8PAOI-2sVlB2nsNU7mcLZYhYw='
        },
        reason_admin: { en: 'eligibility-fraud' }
      }
    }
  }
  return sampleFraudRequest
}

export function signRequest(): string {
  const payload = generateRequest()
  const encodedHeader = b64encode(JSON.stringify({ alg: 'HS256', typ: 'secevent+jwt' }), 'rawurl')
  const encodedPayload = b64encode(JSON.stringify(payload), 'rawurl')
  const encodedSignature = sign(`${encodedHeader}.${encodedPayload}`, 'sha256', getEnv('FRAUD_PRIVATE_KEY'))
  console.log(getEnv('FRAUD_PRIVATE_KEY'))
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}

export function sign(data: ArrayBuffer | string, hashAlg: Algorithm, secret: string | ArrayBuffer) {
  const hasher = crypto.createHMAC(hashAlg, secret)
  hasher.update(data)
  return hasher.digest('base64').replace(/\//g, '_').replace(/\+/g, '-').replace(/=/g, '')
}
