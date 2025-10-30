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
import http, { type Response } from 'k6/http'

import { type Options } from 'k6/options'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode202, isStatusCode204, pageContentCheck } from '../common/utils/checks/assertions'
import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'
import { generateIdentityPayload } from './request/generator'
import { signJwt } from '../common/utils/authentication/jwt'
import { fail, sleep } from 'k6'
import { uuidv4 } from '../common/utils/jslib'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('identity', LoadProfile.smoke),
    ...createScenario('invalidate', LoadProfile.smoke)
  },
  perf006Iteration6PeakTest: {
    ...createI4PeakTestSignUpScenario('identity', 570, 11, 571),
    ...createI4PeakTestSignInScenario('invalidate', 104, 6, 48)
  },
  perf006Iteration6SpikeTest: {
    ...createI3SpikeSignUpScenario('identity', 570, 11, 571),
    ...createI3SpikeSignInScenario('invalidate', 260, 6, 119)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  // eslint-disable-next-line prettier/prettier
  identity: [
    'B01_SIS_01_IdentityCall',
    'B01_SIS_01_InvalidateCall'
  ],
  // eslint-disable-next-line prettier/prettier
  invalidate: [
    'B02_SIS_01_InvalidateCall'
  ],

  useridentity: [
    'B03_SIS_01_PostVC-StubCall',
    'B03_SIS_02_PostSISrecord-StubCall',
    'B03_SIS_03_GetToken-StubCall',
    'B03_SIS_04_postuserIdentityCall'
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
  envURL: getEnv('IDENTITY_SIS_URL'),
  envApiKey: getEnv('IDENTITY_SIS_API_KEY'),
  keyID: getEnv('IDENTITY_SIS_KID'),
  EVCSStubApiKey: getEnv('IDENTITY_EVCSStub_APIKEY'),
  EVCSStubURL: getEnv('IDENTITY_EVCSStub_URL'),
  MockTokenApiKey: getEnv('IDENTITY_MockTokenStub_APIKEY'),
  MockTokenURL: getEnv('IDENTITY_MockTokenStub_URL'),
  envUserIdentityURL: getEnv('IDENTITY_SIS_URL'),
  envUserIdentityApiKey: getEnv('IDENTITY_SIS_API_KEY')
}
const keys = {
  identity: JSON.parse(getEnv('IDENTITY_SIS_PRIVATEKEY')) as JsonWebKey,
  useridentity: JSON.parse(getEnv('USERIDENTITY_SIS_PRIVATEKEY')) as JsonWebKey
}

export async function identity(): Promise<void> {
  const groups = groupMap.identity
  const subjectID = 'urn:fdc:gov.uk:2022:' + uuidv4()
  const payloads = {
    identityPayload: generateIdentityPayload(subjectID)
  }
  const createJwt = async (key: JsonWebKey, payload: object): Promise<string> => {
    const escdaParam: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
    const importedKey = await crypto.subtle.importKey('jwk', key, escdaParam, true, ['sign'])
    return signJwt('ES256', importedKey, payload, env.keyID)
  }
  const identityJWT = await createJwt(keys.identity, payloads.identityPayload)
  const identityReqBody = JSON.stringify({
    userId: subjectID,
    si: {
      jwt: identityJWT,
      vot: 'P2'
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
    isStatusCode404: r => r.status === 404
  })

  iterationsCompleted.add(1)
}

export async function useridentity(): Promise<void> {
  const groups = groupMap.useridentity
  const subjectID = 'urn:fdc:gov.uk:2022:' + uuidv4()

  iterationsStarted.add(1)
  const options = {
    headers: {
      'x-api-key': env.EVCSStubApiKey
    }
  }
  const jwtTokens = {
    fraud:
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOkNZN1E2TDd4MEFlQWNmYUdlazY2R2FKeVhhM2R4RVhBaDRxWWtETUVzMUUiLCJuYmYiOjE2NTIwMjAxMzIsImlzcyI6Imh0dHBzOi8vcmV2aWV3LWYuYWNjb3VudC5nb3YudWsiLCJ2b3QiOiJQMiIsImV4cCI6MTY4MzYyODEzMiwiaWF0IjoxNjUyMDkyMTMyLCJ2YyI6eyJldmlkZW5jZSI6W3siYWN0aXZpdHlIaXN0b3J5U2NvcmUiOjAsInZhbGlkaXR5U2NvcmUiOjAsInZlcmlmaWNhdGlvblNjb3JlIjowLCJzdHJlbmd0aFNjb3JlIjowLCJ0eG4iOiJ0eG4iLCJpZGVudGl0eUZyYXVkU2NvcmUiOjIsInR5cGUiOiJJZGVudGl0eUNoZWNrIiwiY2hlY2tEZXRhaWxzIjpbeyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoibW9ydGFsaXR5X2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoiaWRlbnRpdHlfdGhlZnRfY2hlY2sifSx7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImZyYXVkQ2hlY2siOiJzeW50aGV0aWNfaWRlbnRpdHlfY2hlY2sifSx7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImZyYXVkQ2hlY2siOiJpbXBlcnNvbmF0aW9uX3Jpc2tfY2hlY2sifV0sImNpIjpbIkYwNCJdfV0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOlt7Im5hbWVQYXJ0cyI6W3sidHlwZSI6IkdpdmVuTmFtZSIsInZhbHVlIjoiSmFuZSJ9LHsidHlwZSI6IkZhbWlseU5hbWUiLCJ2YWx1ZSI6IldyaWdodCJ9XSwidmFsaWRGcm9tIjoiMjAxOS0wNC0wMSJ9LHsidmFsaWRVbnRpbCI6IjIwMjktMDQtMDEiLCJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV19XSwiYmlydGhEYXRlIjpbeyJ2YWx1ZSI6IjE5ODktMDctMDYifV19LCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiSWRlbnRpdHlDaGVja0NyZWRlbnRpYWwiXSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3ZvY2FiLmxvbmRvbi5jbG91ZGFwcHMuZGlnaXRhbC9jb250ZXh0cy9pZGVudGl0eS12MS5qc29ubGQiXX0sInZ0bSI6Imh0dHBzOi8vb2lkYy5hY2NvdW50Lmdvdi51ay90cnVzdG1hcmsifQ.MEQCIHy50XHTu2s0SAtsXs02d4VxUZta5rDuK0KTtv6Ya3oXAiBceSvuMd0n5uddq5QnD0cuvGwk26Oe_i3inH_i5azt6g', // pragma: allowlist secret
    passport:
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOjU3YTI0Yzc5LWJmNWEtNDNiZC1iMWRmLWRhMDRhODhiYTZmZSIsIm5iZiI6MTY1MjAyMDExMCwiaXNzIjoiaHR0cHM6Ly9yZXZpZXctcC5hY2NvdW50Lmdvdi51ayIsInZvdCI6IlAyIiwiZXhwIjoxNjgzNjI4MTEwLCJpYXQiOjE2NTIwOTIxMTAsInZjIjp7ImV2aWRlbmNlIjpbeyJhY3Rpdml0eUhpc3RvcnlTY29yZSI6MCwidmFsaWRpdHlTY29yZSI6MCwidmVyaWZpY2F0aW9uU2NvcmUiOjAsInN0cmVuZ3RoU2NvcmUiOjQsInR4biI6InR4biIsImlkZW50aXR5RnJhdWRTY29yZSI6MCwidHlwZSI6IklkZW50aXR5Q2hlY2siLCJjaGVja0RldGFpbHMiOlt7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImRhdGFDaGVjayI6InJlY29yZF9jaGVjayJ9XSwiZmFpbGVkQ2hlY2tEZXRhaWxzIjpbeyJjaGVja01ldGhvZCI6ImRhdGEiLCJkYXRhQ2hlY2siOiJjYW5jZWxsZWRfY2hlY2sifSx7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImRhdGFDaGVjayI6Imxvc3Rfc3RvbGVuX2NoZWNrIn1dfV0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOlt7Im5hbWVQYXJ0cyI6W3sidHlwZSI6IkdpdmVuTmFtZSIsInZhbHVlIjoiSmFuZSJ9LHsidHlwZSI6IkZhbWlseU5hbWUiLCJ2YWx1ZSI6IldyaWdodCJ9XSwidmFsaWRGcm9tIjoiMjAxOS0wNC0wMSJ9LHsidmFsaWRVbnRpbCI6IjIwMjktMDQtMDEiLCJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV19XSwiYmlydGhEYXRlIjpbeyJ2YWx1ZSI6IjE5ODktMDctMDYifV0sInBhc3Nwb3J0IjpbeyJkb2N1bWVudE51bWJlciI6IjEyMjM0NTY3OCIsImV4cGlyeURhdGUiOiIyMDIyLTAyLTAyIiwiaWNhb0lzc3VlckNvZGUiOiJHQlIifV19LCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiSWRlbnRpdHlDaGVja0NyZWRlbnRpYWwiXSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3ZvY2FiLmxvbmRvbi5jbG91ZGFwcHMuZGlnaXRhbC9jb250ZXh0cy9pZGVudGl0eS12MS5qc29ubGQiXX0sInZ0bSI6Imh0dHBzOi8vb2lkYy5hY2NvdW50Lmdvdi51ay90cnVzdG1hcmsifQ.MEUCIQD3sJmXxyxkcl75_KDhTiytQuywwof7VgGOU9CO3AyikwIgELjpM4zfobUiReVasOM8rVHhB-lOXFoTGOfjBdeTLJs', // pragma: allowlist secret
    kbv: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOlBWUUk3Z0VmR1o2a080X0Z4eDZjaHF0SGNobzVzcjgtazA0MUdxci1YbzQiLCJuYmYiOjE2NTIwMjAxNTMsImlzcyI6Imh0dHBzOi8vcmV2aWV3LWsuYWNjb3VudC5nb3YudWsiLCJ2b3QiOiJQMiIsImV4cCI6MTY4MzYyODE1MywiaWF0IjoxNjUyMDkyMTUzLCJ2YyI6eyJldmlkZW5jZSI6W3siYWN0aXZpdHlIaXN0b3J5U2NvcmUiOjAsInZhbGlkaXR5U2NvcmUiOjAsInZlcmlmaWNhdGlvblNjb3JlIjoyLCJzdHJlbmd0aFNjb3JlIjowLCJ0eG4iOiJ0eG4iLCJpZGVudGl0eUZyYXVkU2NvcmUiOjAsInR5cGUiOiJJZGVudGl0eUNoZWNrIn1dLCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lIjpbeyJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV0sInZhbGlkRnJvbSI6IjIwMTktMDQtMDEifSx7InZhbGlkVW50aWwiOiIyMDI5LTA0LTAxIiwibmFtZVBhcnRzIjpbeyJ0eXBlIjoiR2l2ZW5OYW1lIiwidmFsdWUiOiJKYW5lIn0seyJ0eXBlIjoiRmFtaWx5TmFtZSIsInZhbHVlIjoiV3JpZ2h0In1dfV0sImJpcnRoRGF0ZSI6W3sidmFsdWUiOiIxOTg5LTA3LTA2In1dfSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q2hlY2tDcmVkZW50aWFsIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly92b2NhYi5sb25kb24uY2xvdWRhcHBzLmRpZ2l0YWwvY29udGV4dHMvaWRlbnRpdHktdjEuanNvbmxkIl19LCJ2dG0iOiJodHRwczovL29pZGMuYWNjb3VudC5nb3YudWsvdHJ1c3RtYXJrIn0.MEUCIDb_M_4HbcIce_Vep0Mb-OKjRtTdYi0mM4JVEgVlDKZcAiEAwAsSahrKBmjbGxhES8sRjVRktgxtynXYyO0RDhzFvg8' // pragma: allowlist secret
  }
  const body = JSON.stringify(Object.values(jwtTokens).map(token => generateCreateVCPayload(token, 'CURRENT')))

  // B03_SIS_01_PostVC-StubCall
  timeGroup(groups[0], () => http.post(env.EVCSStubURL + `/vcs/${subjectID}`, body, options), {
    isStatusCode202: r => r.status === 202,
    ...pageContentCheck('messageId')
  })

  //Signing Stored Identity(SIS) payload record
  const payloads = {
    useridentityPayload: generateIdentityPayload(subjectID)
  }
  const createJwt = async (key: JsonWebKey, payload: object): Promise<string> => {
    const escdaParam: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
    const importedKey = await crypto.subtle.importKey('jwk', key, escdaParam, true, ['sign'])
    return signJwt('ES256', importedKey, payload, env.keyID)
  }
  const identityJWT = await createJwt(keys.identity, payloads.useridentityPayload)
  const identityReqBody = JSON.stringify({
    userId: subjectID,
    si: {
      jwt: identityJWT,
      vot: 'P2'
    }
  })
  const params = {
    headers: {
      'x-api-key': env.EVCSStubApiKey
    }
  }
  //B03_SIS_02_PostSISrecord-StubCall
  timeGroup(groups[1], () => http.post(env.EVCSStubURL + '/user-identity', identityReqBody, params), {
    isStatusCode202
  })
  //B03_SIS_03_GetToken-StubCall
  const res: Response = timeGroup(
    groups[2],
    () =>
      http.post(
        env.MockTokenURL + '/generate',
        JSON.stringify({
          sub: subjectID,
          scope: null,
          ttl: 120
        })
      ),
    { isStatusCode200, ...pageContentCheck('token') }
  )
  const token = getToken(res)

  const parameters = {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': env.envUserIdentityApiKey
    }
  }
  const useridentityReqBody = JSON.stringify({
    vtr: 'P2',
    govukSigninJourneyId: subjectID
  })
  // B03_SIS_04_postuserIdentityCall
  timeGroup(groups[3], () => http.post(env.envUserIdentityURL + '/v1/identity', useridentityReqBody, parameters), {
    isStatusCode204
  })

  iterationsCompleted.add(1)
}
/// Additional functions used ///
function getToken(r: Response): string {
  const token = r.json('token')
  if (token !== null && typeof token === 'string') return token
  fail('token not found')
}

type VcState = 'CURRENT' | 'PENDING'
interface CreateVCPayload {
  vc: string
  state: VcState
  provenance: string
}

function generateCreateVCPayload(vcJWT: string, vcState: VcState): CreateVCPayload {
  return {
    vc: vcJWT,
    state: vcState,
    provenance: 'ONLINE'
  }
}
