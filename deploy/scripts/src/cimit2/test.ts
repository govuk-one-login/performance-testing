import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { getEnv } from '../common/utils/config/environment-variables'
import { signJwt } from '../common/utils/authentication/jwt'
import { crypto as webcrypto, EcKeyImportParams, JWK } from 'k6/experimental/webcrypto'
import { generateCimitPayload } from './request/generator'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('postContraIndicators', LoadProfile.smoke), // putContraIndicators to postContraIndicators
    ...createScenario('getContraIndicatorCredentials', LoadProfile.smoke), //getContraIndicatorCredentials to getVerifiableCredentials
    ...createScenario('postMitigations', LoadProfile.smoke) //
  },
  lowVolume: {
    ...createScenario('postContraIndicators', LoadProfile.short, 30, 5),
    ...createScenario('getContraIndicatorCredentials', LoadProfile.short, 30, 5),
    ...createScenario('postMitigations', LoadProfile.short, 30, 5)
  },
  load: {
    ...createScenario('postContraIndicators', LoadProfile.full, 400, 5),
    ...createScenario('getContraIndicatorCredentials', LoadProfile.full, 100, 5),
    ...createScenario('postMitigations', LoadProfile.full, 100, 5)
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

const groupMap = {
  postContraIndicators: ['B01_CIMIT_01_PostContraIndicator'],
  getVerifiableCredentials: ['B02_CIMIT_01_GetVerifiableCredentials'],
  postMitigations: ['B03_CIMIT_01_PostMitigations']
} as const

export function setup(): void {
  describeProfile(loadProfile)
}

const env = {
  postCIURL: getEnv('IDENTITY_CIMIT_POSTCI'), //
  getVCCURL: getEnv('IDENTITY_CIMIT_GETVC'),
  postMitigationURL: getEnv('IDENTITY_CIMIT_POSTMITIGATION')
}

const keys = {
  cimit: JSON.parse(getEnv('IDENTITY_CIMIT_CIMITKEY')) as JWK //To do: Add it in template.yml and store the value in the PS - not working at the moment
}

//i was not pretty sure hence kept the following two functions for

const payloads = {
  CIMIT: generateCimitPayload(uuidv4(), true), // For contraIndicator
  CIMITMitigation: generateCimitPayload(uuidv4(), false), // For mitigation
}

const createJwt = async (key: JWK, payload: object): Promise<string> => {
  const escdaParam: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
  const importedKey = await webcrypto.subtle.importKey('jwk', key, escdaParam, true, ['sign'])
  return signJwt('ES256', importedKey, payload)
}

const jwts = [await createJwt(keys.cimit, payloads.CIMIT)]

//Add Export function for http requests with jwt signed bodies (for all three api calls)
