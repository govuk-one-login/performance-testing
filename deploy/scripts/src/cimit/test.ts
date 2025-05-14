import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import http from 'k6/http'
import { type Options } from 'k6/options'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { SharedArray } from 'k6/data'
import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'
import { generatePutContraIndicatorPayload, generatePostMitigationsPayload } from './request/generator'
import { crypto as webcrypto, EcKeyImportParams, JWK } from 'k6/experimental/webcrypto'
import crypto from 'k6/crypto'
import { b64decode } from 'k6/encoding'
import { signJwt } from '../common/utils/authentication/jwt'
import execution from 'k6/execution'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('putContraIndicators', LoadProfile.smoke),
    ...createScenario('getContraIndicatorCredentials', LoadProfile.smoke),
    ...createScenario('postMitigations', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('putContraIndicators', LoadProfile.short, 30, 5),
    ...createScenario('getContraIndicatorCredentials', LoadProfile.short, 30, 5),
    ...createScenario('postMitigations', LoadProfile.short, 30, 5)
  },
  load: {
    ...createScenario('putContraIndicators', LoadProfile.full, 400, 5),
    ...createScenario('getContraIndicatorCredentials', LoadProfile.full, 100, 5),
    ...createScenario('postMitigations', LoadProfile.full, 100, 5)
  }
}

interface GetCICData {
  userID: string
}

const getCICData: GetCICData[] = new SharedArray('Get CIC Data', function () {
  return open('./data/getCICData.csv')
    .split('\n')
    .slice(1)
    .map(subID => {
      return {
        subID
      }
    })
})

const loadProfile = selectProfile(profiles)
const groupMap = {
  putContraIndicators: ['B01_CIMIT_01_PutContraIndicator'],
  getContraIndicatorCredentials: ['B02_CIMIT_01_GetContraIndicatorCredentials'],
  postMitigations: ['B03_CIMIT_01_PostMitigations']
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
  describeProfile(loadProfile)
}

const env = {
  envURL: getEnv('IDENTITY_CIMIT_APIURL')
}

const keys = {
  cimit: JSON.parse(getEnv('IDENTITY_CIMIT_KEY'))
}

export async function putContraIndicators(): Promise<void> {
  const groups = groupMap.putContraIndicators
  const config = {
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
    putContraIndicatorPayload: generatePutContraIndicatorPayload(pairwiseSub('cimit'))
  }

  console.log(payloads)
  const createJwt = async (key: JWK, payload: object): Promise<string> => {
    const escdaParam: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
    const importedKey = await webcrypto.subtle.importKey('jwk', key, escdaParam, true, ['sign'])
    return signJwt('ES256', importedKey, payload)
  }
  const jwts = [await createJwt(keys.cimit, payloads.putContraIndicatorPayload)]
  console.log(jwts)

  iterationsStarted.add(1)
  // B01_CIMIT_01_PutContraIndicator
  timeGroup(
    groups[0],
    () =>
      http.post(env.envURL + '/v1/contra-indicators/detect', {
        signed_jwt: jwts
      }),
    { isStatusCode200, ...pageContentCheck('success') }
  )
  iterationsCompleted.add(1)
}

export function getContraIndicatorCredentials(): void {
  const groups = groupMap.getContraIndicatorCredentials
  const getContraIndicatorData = getCICData[execution.vu.idInTest - 1]
  iterationsStarted.add(1)
  // B02_CIMIT_01_GetContraIndicatorCredentials
  timeGroup(groups[1], () => http.get(env.envURL + `/v1/contra-indicators?userId=${getContraIndicatorData.subID}`), {
    isStatusCode200,
    ...pageContentCheck('vc')
  })
  iterationsCompleted.add(1)
}

export async function postMitigations(): void {
  const groups = groupMap.postMitigations
  const config = {
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
    postMitigationsPayload: generatePostMitigationsPayload(pairwiseSub('cimit'))
  }

  console.log(payloads)
  const createJwt = async (key: JWK, payload: object): Promise<string> => {
    const escdaParam: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
    const importedKey = await webcrypto.subtle.importKey('jwk', key, escdaParam, true, ['sign'])
    return signJwt('ES256', importedKey, payload)
  }
  const jwts = [await createJwt(keys.cimit, payloads.postMitigationsPayload)]
  console.log(jwts)

  iterationsStarted.add(1)
  // B03_CIMIT_01_PostMitigations
  timeGroup(
    groups[0],
    () =>
      http.post(env.envURL + '/v1/contra-indicators/mitigate', {
        signed_jwts: [jwts]
      }),
    { isStatusCode200, ...pageContentCheck('success') }
  )
  iterationsCompleted.add(1)
}
