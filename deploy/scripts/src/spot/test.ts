import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI3SpikeSignInScenario,
  createI4PeakTestSignInScenario
} from '../common/utils/config/load-profiles'
import { AWSConfig, SQSClient } from '../common/utils/jslib/aws-sqs'
import { type AssumeRoleOutput } from '../common/utils/aws/types'
import { getEnv } from '../common/utils/config/environment-variables'
import { generateSPOTRequest } from './request/generator'
import { signJwt } from '../common/utils/authentication/jwt'
import { crypto as webcrypto, EcKeyImportParams, JWK } from 'k6/experimental/webcrypto'
import crypto from 'k6/crypto'
import { b64decode } from 'k6/encoding'
import { SpotRequestInfo } from './request/types'
import { generateFraudPayload, generateKBVPayload, generatePassportPayload } from './request/generator'

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
  },
  perf006Iteration3PeakTest: {
    spot: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 60,
      maxVUs: 120,
      stages: [
        { target: 40, duration: '19s' },
        { target: 40, duration: '30m' }
      ],
      exec: 'spot'
    }
  },
  perf006Iteration3SpikeTest: {
    ...createI3SpikeSignInScenario('spot', 120, 3, 55)
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignInScenario('spot', 90, 3, 21)
  },
  perf006Iteration4SpikeTest: {
    ...createI3SpikeSignInScenario('spot', 242, 3, 111)
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignInScenario('spot', 122, 3, 30)
  },
  perf006Iteration5SpikeTest: {
    ...createI3SpikeSignInScenario('spot', 275, 3, 126)
  },
  perf006Iteration6PeakTest: {
    ...createI4PeakTestSignInScenario('spot', 161, 3, 48)
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

const kids = {
  fraud: getEnv('IDENTITY_SPOT_FRAUD_KID'),
  passport: getEnv('IDENTITY_SPOT_PASSPORT_KID'),
  kbv: getEnv('IDENTITY_SPOT_KBV_KID')
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
    fraud: generateFraudPayload(pairwiseSub('fraudSector')),
    passport: generatePassportPayload(pairwiseSub('passportSector')),
    kbv: generateKBVPayload(pairwiseSub('verificationSector'))
  }
  const createJwt = async (key: JWK, payload: object, kid: string): Promise<string> => {
    const escdaParam: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
    const importedKey = await webcrypto.subtle.importKey('jwk', key, escdaParam, true, ['sign'])
    return signJwt('ES256', importedKey, payload, kid)
  }
  const jwts = [
    await createJwt(keys.fraud, payloads.fraud, kids.fraud),
    await createJwt(keys.passport, payloads.passport, kids.passport),
    await createJwt(keys.kbv, payloads.kbv, kids.kbv)
  ]
  const payload = generateSPOTRequest(pairwiseSub(config.sector), config, jwts)
  iterationsStarted.add(1)
  sqs.sendMessage(env.sqs_queue, JSON.stringify(payload))
  iterationsCompleted.add(1)
}
