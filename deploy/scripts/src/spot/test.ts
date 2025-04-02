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
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { getEnv } from '../common/utils/config/environment-variables'
import { generatePayload, generateSPOTRequest, Issuer } from './request/generator'
import { signJwt } from '../common/utils/authentication/jwt'
import { crypto as webcrypto, EcKeyImportParams, JWK } from 'k6/experimental/webcrypto'
import crypto from 'k6/crypto'
import { b64decode } from 'k6/encoding'
import { SpotRequestInfo } from './request/types'

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
  const config: SpotRequestInfo = {
    host: 'a-simple-local-account-id',
    sector: 'a.simple.sector.id',
    salt: 'YS1zaW1wbGUtc2FsdA=='
  }

  const pairwiseSub = (sectorId: string): string => {
    const hasher = crypto.createHash('sha256')
    hasher.update(sectorId)
    hasher.update(config.host)
    hasher.update(b64decode(config.salt))
    const id = hasher.digest('base64rawurl')
    return 'urn:fdc:gov.uk:2022:' + id
  }

  const payloads = {
    fraud: generatePayload(pairwiseSub('fraudSector'), Issuer.Fraud),
    passport: generatePayload(pairwiseSub('passportSector'), Issuer.Passport),
    kbv: generatePayload(pairwiseSub('verificationSector'), Issuer.KBV)
  }
  const createJwt = async (key: JWK, payload: object): Promise<string> => {
    const escdaParam: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
    const importedKey = await webcrypto.subtle.importKey('jwk', key, escdaParam, true, ['sign'])
    return signJwt('ES256', importedKey, payload)
  }
  const jwts = [
    await createJwt(keys.fraud, payloads.fraud),
    await createJwt(keys.passport, payloads.passport),
    await createJwt(keys.kbv, payloads.kbv)
  ]
  const payload = generateSPOTRequest(pairwiseSub(config.sector), config, jwts)
  iterationsStarted.add(1)
  sqs.sendMessage(env.sqs_queue, JSON.stringify(payload))
  iterationsCompleted.add(1)
}
