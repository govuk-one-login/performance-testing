import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI4PeakTestSignUpScenario,
  createI4PeakTestSignInScenario,
  createI3SpikeSignUpScenario,
  createI3SpikeSignInScenario
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
import { signJwt } from '../common/utils/authentication/jwt'
import { sleep } from 'k6'
import { uuidv4 } from '../common/utils/jslib'
import execution from 'k6/execution'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('cimitIDProvingAPIs', LoadProfile.smoke),
    ...createScenario('cimitSignInAPI', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('cimitIDProvingAPIs', LoadProfile.short, 30, 5)
  },
  load: {
    ...createScenario('cimitIDProvingAPIs', LoadProfile.full, 400, 5)
  },
  dataCreationGenerateCIs: {
    cimitIDProvingAPIs: {
      executor: 'per-vu-iterations',
      vus: 100,
      iterations: 500,
      maxDuration: '60m',
      exec: 'cimitIDProvingAPIs'
    }
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('cimitIDProvingAPIs', 1880, 19, 471)
  },
  perf006Iteration4SpikeTest: {
    ...createI3SpikeSignUpScenario('cimitIDProvingAPIs', 4520, 19, 1131)
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignUpScenario('cimitIDProvingAPIs', 2280, 19, 571),
    ...createI4PeakTestSignInScenario('cimitSignInAPI', 65, 6, 30)
  },
  perf006Iteration5SpikeTest: {
    ...createI3SpikeSignUpScenario('cimitIDProvingAPIs', 4520, 19, 1130),
    ...createI3SpikeSignInScenario('cimitSignInAPI', 162, 6, 75)
  },
  perf006Iteration6PeakTest: {
    ...createI4PeakTestSignUpScenario('cimitIDProvingAPIs', 4720, 19, 921),
    ...createI4PeakTestSignInScenario('cimitSignInAPI', 104, 6, 48)
  },
  perf006Iteration6SpikeTest: {
    ...createI3SpikeSignUpScenario('cimitIDProvingAPIs', 2280, 19, 571),
    ...createI3SpikeSignInScenario('cimitSignInAPI', 260, 6, 119)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('cimitIDProvingAPIs', 720, 19, 181),
    ...createI4PeakTestSignInScenario('cimitSignInAPI', 71, 6, 33)
  },
  perf006Iteration8PeakTest: {
    ...createI4PeakTestSignUpScenario('cimitIDProvingAPIs', 680, 19, 171),
    ...createI4PeakTestSignInScenario('cimitSignInAPI', 126, 6, 58)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  cimitIDProvingAPIs: [
    'B01_CIMITIDProving_01_PutContraIndicator',
    'B01_CIMITIDProving_02_PostMitigations',
    'B01_CIMITIDProving_03_GetContraIndicatorCredentials'
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
  passport: JSON.parse(getEnv('IDENTITY_CIMIT_PASSPORTKEY')) as JsonWebKey,
  drivingLicense: JSON.parse(getEnv('IDENTITY_CIMIT_DLKEY')) as JsonWebKey
}

const kids = {
  passport: getEnv('IDENTITY_CIMIT_PASSPORT_KID'),
  drivingLicence: getEnv('IDENTITY_CIMIT_DL_KID')
}

export async function cimitIDProvingAPIs(): Promise<void> {
  const groups = groupMap.cimitIDProvingAPIs
  const subjectID = 'urn:fdc:gov.uk:2022:' + uuidv4()
  const payloads = {
    putContraIndicatorPayload: generatePassportPayloadCI(subjectID),
    postMitigationsPayload: generateDrivingLicensePayloadMitigation(subjectID)
  }
  const createJwt = async (key: JsonWebKey, payload: object, kid: string): Promise<string> => {
    const escdaParam: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
    const importedKey = await crypto.subtle.importKey('jwk', key, escdaParam, true, ['sign'])
    return signJwt('ES256', importedKey, payload, kid)
  }
  const putContraIndicatorJWT = await createJwt(keys.passport, payloads.putContraIndicatorPayload, kids.passport)
  const putContraIndicatorReqBody = JSON.stringify({ signed_jwt: putContraIndicatorJWT })
  const postMitigationsJWT = await createJwt(keys.drivingLicense, payloads.postMitigationsPayload, kids.drivingLicence)
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
