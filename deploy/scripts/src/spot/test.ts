import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { generateSPOTRequest } from './requestGenerator/spotReqGen'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { getEnv } from '../common/utils/config/environment-variables'
import { uuidv4 } from '../common/utils/jslib'
import { generateFraudPayload, generateKBVPayload, generatePassportPayload } from './requestGenerator/payloadGenerator'
import encoding from 'k6/encoding'
import { signJwt } from '../common/utils/authentication/jwt'
import { crypto, EcKeyImportParams } from 'k6/experimental/webcrypto'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('spot', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('spot', LoadProfile.full, 50, 3)
  },
  load: {
    ...createScenario('spot', LoadProfile.full, 100, 3)
  },
  stress: {
    ...createScenario('spot', LoadProfile.full, 2000, 3)
  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'], // 95th percentile response time <=1000ms, 99th percentile response time <=2500ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
}

export function setup(): void {
  describeProfile(loadProfile)
}

const env = {
  sqs_queue: getEnv('IDENTITY_SPOT_SQS')
}

const pkcs8Keys = {
  fraud: getEnv('IDENTITY_SPOT_FRAUDKEY'),
  passport: getEnv('IDENTITY_SPOT_PASSPORTKEY'),
  kbv: getEnv('IDENTITY_SPOT_KBVKEY')
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})
const sqs = new SQSClient(awsConfig)

export async function spot(): Promise<void> {
  const currTime = new Date().toISOString().slice(2, 16).replace(/[-:]/g, '') // YYMMDDTHHmm
  const userID = uuidv4()
  const subjectID = `urn:fdc:gov.uk:2022:${userID}`
  const payloads = {
    fraudPayload: generateFraudPayload(subjectID),
    passportPayload: generatePassportPayload(subjectID),
    kbvPayload: generateKBVPayload(subjectID)
  }
  const escdaParam: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
  const cryptoKeys = {
    fraudCryptoKey: str2buffer(pkcs8Keys.fraud),
    passportCryptoKey: str2buffer(pkcs8Keys.passport),
    kbvCryptoKey: str2buffer(pkcs8Keys.kbv)
  }

  const importedPrivateKeys = {
    fraudPrivateKey: await crypto.subtle.importKey('pkcs8', cryptoKeys.fraudCryptoKey, escdaParam, true, ['sign']),
    passportPrivateKey: await crypto.subtle.importKey('pkcs8', cryptoKeys.passportCryptoKey, escdaParam, true, [
      'sign'
    ]),
    kbvPrivateKey: await crypto.subtle.importKey('pkcs8', cryptoKeys.kbvCryptoKey, escdaParam, true, ['sign'])
  }

  const jwts = {
    fraudSignedJWT: await signJwt('ES256', importedPrivateKeys.fraudPrivateKey, payloads.fraudPayload),
    passportSignedJWT: await signJwt('ES256', importedPrivateKeys.passportPrivateKey, payloads.passportPayload),
    kbvSignedJWT: await signJwt('ES256', importedPrivateKeys.kbvPrivateKey, payloads.kbvPayload)
  }

  const spotPayload = generateSPOTRequest(currTime, jwts.fraudSignedJWT, jwts.kbvSignedJWT, jwts.kbvSignedJWT)

  const spotMessage = {
    messageBody: JSON.stringify(spotPayload)
  }
  iterationsStarted.add(1)
  sqs.sendMessage(env.sqs_queue, spotMessage.messageBody)
  iterationsCompleted.add(1)
}

function str2buffer(pkcs8Keys: string): ArrayBuffer {
  return encoding.b64decode(pkcs8Keys, 'std')
}
