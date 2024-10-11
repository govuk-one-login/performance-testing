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
import { signJwt } from '../common/utils/authentication/jwt'
import { crypto, CryptoKey, EcKeyImportParams, JWK } from 'k6/experimental/webcrypto'

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

const keys = {
  fraud: JSON.parse(getEnv('IDENTITY_SPOT_FRAUDKEY')) as JWK,
  passport: JSON.parse(getEnv('IDENTITY_SPOT_PASSPORTKEY')) as JWK,
  kbv: JSON.parse(getEnv('IDENTITY_SPOT_KBVKEY')) as JWK
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
    fraud: generateFraudPayload(subjectID),
    passport: generatePassportPayload(subjectID),
    kbv: generateKBVPayload(subjectID)
  }
  const importKey = async (key: JWK): Promise<CryptoKey> => {
    const escdaParam: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
    return crypto.subtle.importKey('jwk', key, escdaParam, true, ['sign'])
  }
  const importedKeys = {
    fraud: await importKey(keys.fraud),
    passport: await importKey(keys.passport),
    kbv: await importKey(keys.kbv)
  }
  const algorithm = 'ES256'
  const jwts = [
    await signJwt(algorithm, importedKeys.fraud, payloads.fraud),
    await signJwt(algorithm, importedKeys.passport, payloads.passport),
    await signJwt(algorithm, importedKeys.kbv, payloads.kbv)
  ]
  const payload = generateSPOTRequest(currTime, jwts)

  iterationsStarted.add(1)
  sqs.sendMessage(env.sqs_queue, JSON.stringify(payload))
  iterationsCompleted.add(1)
}
