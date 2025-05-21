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
import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'
import { generatePassportPayloadCI, generatePassportPayloadMitigation } from './request/generator'
import { crypto as webcrypto, EcKeyImportParams, JWK } from 'k6/experimental/webcrypto'
import { signJwt } from '../common/utils/authentication/jwt'
import { sleep } from 'k6'
import { uuidv4 } from '../common/utils/jslib'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('cimitAPIs', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('cimitAPIs', LoadProfile.short, 30, 5)
  },
  load: {
    ...createScenario('cimitAPIs', LoadProfile.full, 400, 5)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  cimitAPIs: [
    'B01_CIMIT_01_PutContraIndicator',
    'B02_CIMIT_01_GetContraIndicatorCredentials',
    'B03_CIMIT_01_PostMitigations'
  ]
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
  cimit: JSON.parse(getEnv('IDENTITY_CIMIT_KEY')) as JWK
}

export async function cimitAPIs(): Promise<void> {
  const groups = groupMap.cimitAPIs
  const subjectID = 'urn:fdc:gov.uk:2022:' + uuidv4()

  const payloads = {
    putContraIndicatorPayload: generatePassportPayloadCI(subjectID),
    postMitigationsPayload: generatePassportPayloadMitigation(subjectID)
  }
  const createJwt = async (key: JWK, payload: object): Promise<string> => {
    const escdaParam: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
    const importedKey = await webcrypto.subtle.importKey('jwk', key, escdaParam, true, ['sign'])
    return signJwt('ES256', importedKey, payload)
  }
  const putContraIndicatorJWT = await createJwt(keys.cimit, payloads.putContraIndicatorPayload)
  const putContraIndicatorReqBody = JSON.stringify({ signed_jwt: putContraIndicatorJWT })
  const postMitigationsJWT = await createJwt(keys.cimit, payloads.postMitigationsPayload)
  const postMitigationReqBody = JSON.stringify({ signed_jwts: [postMitigationsJWT] })
  const params = {
    headers: {
      'govuk-signin-journey-id': uuidv4(),
      'ip-address': '1.2.3.4'
    }
  }

  iterationsStarted.add(1)
  // B01_CIMIT_01_PutContraIndicator
  timeGroup(
    groups[0],
    () => http.post(env.envURL + '/v1/contra-indicators/detect', putContraIndicatorReqBody, params),
    {
      isStatusCode200,
      ...pageContentCheck('success')
    }
  )

  sleep(5)

  // B02_CIMIT_01_GetContraIndicatorCredentials
  timeGroup(groups[1], () => http.get(env.envURL + `/v1/contra-indicators?user_id=${subjectID}`, params), {
    isStatusCode200,
    ...pageContentCheck('vc')
  })

  sleep(5)

  // B03_CIMIT_01_PostMitigations
  timeGroup(groups[2], () => http.post(env.envURL + '/v1/contra-indicators/mitigate', postMitigationReqBody, params), {
    isStatusCode200,
    ...pageContentCheck('success')
  })
  iterationsCompleted.add(1)
}
