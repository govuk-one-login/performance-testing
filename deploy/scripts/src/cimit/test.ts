import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI4PeakTestSignUpScenario,
  createI4PeakTestSignInScenario,
  createI3SpikeSignUpScenario
} from '../common/utils/config/load-profiles'
import http from 'k6/http'
import { SharedArray } from 'k6/data'
import { type Options } from 'k6/options'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'
import { generatePassportPayloadCI, generateDrivingLicensePayloadMitigation } from './request/generator'
import { crypto as webcrypto, EcKeyImportParams, JWK } from 'k6/experimental/webcrypto'
import { signJwt } from '../common/utils/authentication/jwt'
import { sleep } from 'k6'
import { uuidv4 } from '../common/utils/jslib'
import execution from 'k6/execution'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('cimitSignUpAPIs', LoadProfile.smoke),
    ...createScenario('cimitSignInAPI', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('cimitSignUpAPIs', LoadProfile.short, 30, 5)
  },
  load: {
    ...createScenario('cimitSignUpAPIs', LoadProfile.full, 400, 5)
  },
  dataCreationGenerateCIs: {
    cimitSignUpAPIs: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 500,
      maxDuration: '60m',
      exec: 'cimitSignUpAPIs'
    }
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('cimitSignUpAPIs', 1880, 19, 471)
  },
  perf006Iteration4SpikeTest: {
    ...createI3SpikeSignUpScenario('cimitSignUpAPIs', 4520, 19, 1131)
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignUpScenario('cimitSignUpAPIs', 2280, 19, 571),
    ...createI4PeakTestSignInScenario('cimitSignInAPI', 65, 6, 30)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  cimitSignUpAPIs: [
    'B01_CIMITSignUp_01_PutContraIndicator',
    'B01_CIMITSignUp_02_PostMitigations',
    'B01_CIMITSignUp_03_GetContraIndicatorCredentials'
  ],
  cimitSignInAPI: ['B02_CIMITSignIn_01_GetContraIndicatorCredentials']
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

interface RetrieveSubjectId {
  subjectId: string
}

const csvData: RetrieveSubjectId[] = new SharedArray('Retrieve SubjectId', function () {
  return open('./data/getSubjectId.csv')
    .split('\n')
    .slice(1)
    .map(subjectId => {
      return {
        subjectId
      }
    })
})

const keys = {
  passport: JSON.parse(getEnv('IDENTITY_CIMIT_PASSPORTKEY')) as JWK,
  drivingLicense: JSON.parse(getEnv('IDENTITY_CIMIT_DLKEY')) as JWK
}

export async function cimitSignUpAPIs(): Promise<void> {
  const groups = groupMap.cimitSignUpAPIs
  const subjectID = 'urn:fdc:gov.uk:2022:' + uuidv4()
  const payloads = {
    putContraIndicatorPayload: generatePassportPayloadCI(subjectID),
    postMitigationsPayload: generateDrivingLicensePayloadMitigation(subjectID)
  }
  const createJwt = async (key: JWK, payload: object): Promise<string> => {
    const escdaParam: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
    const importedKey = await webcrypto.subtle.importKey('jwk', key, escdaParam, true, ['sign'])
    return signJwt('ES256', importedKey, payload)
  }
  const putContraIndicatorJWT = await createJwt(keys.passport, payloads.putContraIndicatorPayload)
  const putContraIndicatorReqBody = JSON.stringify({ signed_jwt: putContraIndicatorJWT })
  const postMitigationsJWT = await createJwt(keys.drivingLicense, payloads.postMitigationsPayload)
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

  // B03_CIMIT_02_PostMitigations
  timeGroup(groups[1], () => http.post(env.envURL + '/v1/contra-indicators/mitigate', postMitigationReqBody, params), {
    isStatusCode200,
    ...pageContentCheck('success')
  })

  sleep(5)

  // B02_CIMIT_03_GetContraIndicatorCredentials
  timeGroup(groups[2], () => http.get(env.envURL + `/v1/contra-indicators?user_id=${subjectID}`, params), {
    isStatusCode200,
    ...pageContentCheck('vc')
  })

  iterationsCompleted.add(1)

  console.log(subjectID)
}

export async function cimitSignInAPI(): Promise<void> {
  const retrieveData = csvData[execution.vu.idInTest - 1]
  const groups = groupMap.cimitSignInAPI
  const params = {
    headers: {
      'govuk-signin-journey-id': uuidv4(),
      'ip-address': '1.2.3.4'
    }
  }

  iterationsStarted.add(1)

  // B02_CIMIT_03_GetContraIndicatorCredentials
  timeGroup(groups[0], () => http.get(env.envURL + `/v1/contra-indicators?user_id=${retrieveData.subjectId}`, params), {
    isStatusCode200,
    ...pageContentCheck('vc')
  })
  iterationsCompleted.add(1)
}
