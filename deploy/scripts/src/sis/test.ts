import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI4PeakTestSignUpScenario,
  createI4PeakTestSignInScenario
} from '../common/utils/config/load-profiles'
import http from 'k6/http'

import { type Options } from 'k6/options'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode202, isStatusCode204 } from '../common/utils/checks/assertions'
import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'
import { generateIdentityPayload } from './request/generator'
import { crypto as webcrypto, EcKeyImportParams, JWK } from 'k6/experimental/webcrypto'
import { signJwt } from '../common/utils/authentication/jwt'
import { sleep } from 'k6'
import { uuidv4 } from '../common/utils/jslib'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('identity', LoadProfile.smoke),
    ...createScenario('invalidate', LoadProfile.smoke)
  },
  perf006Iteration6PeakTest: {
    ...createI4PeakTestSignUpScenario('identity', 570, 11, 571),
    ...createI4PeakTestSignInScenario('invalidate', 104, 6, 48)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  identity: ['B01_SIS_01_IdentityCall', 'B01_SIS_01_InvalidateCall'],
  invalidate: ['B02_SIS_01_InvalidateCall']
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
  envURL: getEnv('IDENTITY_SIS_URL'),
  envApiKey: getEnv('IDENTITY_SIS_API_KEY')
}
const keys = {
  identity: JSON.parse(getEnv('IDENTITY_SIS_PRIVATEKEY')) as JWK
}

export async function identity(): Promise<void> {
  const groups = groupMap.identity
  const subjectID = 'urn:fdc:gov.uk:2022:' + uuidv4()
  const payloads = {
    identityPayload: generateIdentityPayload(subjectID)
  }
  const createJwt = async (key: JWK, payload: object): Promise<string> => {
    const escdaParam: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
    const importedKey = await webcrypto.subtle.importKey('jwk', key, escdaParam, true, ['sign'])
    return signJwt('ES256', importedKey, payload)
  }
  const identityJWT = await createJwt(keys.identity, payloads.identityPayload)
  const identityReqBody = JSON.stringify({
    userId: subjectID,
    si: {
      jwt: identityJWT,
      vot: 'P2',
      metadata: {
        xyz: 'abc'
      }
    }
  })
  const invalidateReqBody = JSON.stringify({
    userId: subjectID
  })
  const params = {
    headers: {
      'x-api-key': env.envApiKey
    }
  }

  iterationsStarted.add(1)
  // B01_SIS_01_IdentityCall
  timeGroup(groups[0], () => http.post(env.envURL + '/v1/identity', identityReqBody, params), {
    isStatusCode202
  })

  sleep(5)

  // B01_SIS_01_InvalidateCall
  timeGroup(groups[1], () => http.post(env.envURL + '/v1/identity/invalidate', invalidateReqBody, params), {
    isStatusCode204
  })

  iterationsCompleted.add(1)
}

export async function invalidate(): Promise<void> {
  const groups = groupMap.invalidate
  const subjectID = 'urn:fdc:gov.uk:2022:' + uuidv4()
  const invalidateReqBody = JSON.stringify({
    userId: subjectID
  })
  const params = {
    headers: {
      'x-api-key': env.envApiKey
    }
  }

  iterationsStarted.add(1)

  // B02_SIS_01_InvalidateCall
  timeGroup(groups[0], () => http.post(env.envURL + '/v1/identity/invalidate', invalidateReqBody, params), {
    isStatusCode204
  })

  iterationsCompleted.add(1)
}
