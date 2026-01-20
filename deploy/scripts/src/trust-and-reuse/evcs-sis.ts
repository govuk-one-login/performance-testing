import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { fail, sleep } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI4PeakTestSignUpScenario,
  createI4PeakTestSignInScenario
} from '../common/utils/config/load-profiles'
import { SharedArray } from 'k6/data'
import { uuidv4 } from '../common/utils/jslib'
import { timeGroup } from '../common/utils/request/timing'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'
import { isStatusCode200, isStatusCode202, isStatusCode204, pageContentCheck } from '../common/utils/checks/assertions'
import { generateIdentityPayload } from './sis/utils/requestGenerator'
import { signJwt } from '../common/utils/authentication/jwt'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('identity', LoadProfile.smoke),
    ...createScenario('invalidate', LoadProfile.smoke),
    ...createScenario('updateVC', LoadProfile.smoke),
    ...createScenario('summariseVC', LoadProfile.smoke)
  },
  perf006Iteration8PeakTest: {
    ...createI4PeakTestSignUpScenario('identity', 170, 11, 171),
    ...createI4PeakTestSignInScenario('invalidate', 126, 6, 58),
    ...createI4PeakTestSignUpScenario('updateVC', 170, 7, 171),
    ...createI4PeakTestSignInScenario('summariseVC', 126, 6, 58)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  updateVC: ['R03_UpdateVC_01_CreateVC', 'R03_UpdateVC_02_UpdateVC'],
  summariseVC: ['R02_SummariseVC_01_GenerateTokenSummary', 'R02_SummariseVC_02_Summarise'],
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

interface SummariseSubjectID {
  subID: string
}

const csvData: SummariseSubjectID[] = new SharedArray('Summarise Subject ID', function () {
  return open('./evcs-sis/data/summariseSubjectID.csv')
    .split('\n')
    .slice(1)
    .map(subID => {
      return {
        subID
      }
    })
})

const env = {
  envURL: getEnv('ACCOUNT_BRAVO_ID_REUSE_URL'),
  envMock: getEnv('ACCOUNT_BRAVO_ID_REUSE_MOCK'),
  envApiKey: getEnv('ACCOUNT_BRAVO_ID_REUSE_API_KEY'),
  envApiKeySummarise: getEnv('ACCOUNT_BRAVO_ID_REUSE_API_KEY_SUMMARISE'),
  identityURL: getEnv('IDENTITY_SIS_IDENTITY_URL'),
  identityApiKey: getEnv('IDENTITY_SIS_IDENTITY_APIKEY'),
  identityKid: getEnv('IDENTITY_SIS_IDENTITY_KID')
}

const keys = {
  identity: JSON.parse(getEnv('IDENTITY_SIS_IDENTITY_PRIVATEKEY')) as JsonWebKey
}

const jwtTokens = {
  fraud:
    'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOkNZN1E2TDd4MEFlQWNmYUdlazY2R2FKeVhhM2R4RVhBaDRxWWtETUVzMUUiLCJuYmYiOjE2NTIwMjAxMzIsImlzcyI6Imh0dHBzOi8vcmV2aWV3LWYuYWNjb3VudC5nb3YudWsiLCJ2b3QiOiJQMiIsImV4cCI6MTY4MzYyODEzMiwiaWF0IjoxNjUyMDkyMTMyLCJ2YyI6eyJldmlkZW5jZSI6W3siYWN0aXZpdHlIaXN0b3J5U2NvcmUiOjAsInZhbGlkaXR5U2NvcmUiOjAsInZlcmlmaWNhdGlvblNjb3JlIjowLCJzdHJlbmd0aFNjb3JlIjowLCJ0eG4iOiJ0eG4iLCJpZGVudGl0eUZyYXVkU2NvcmUiOjIsInR5cGUiOiJJZGVudGl0eUNoZWNrIiwiY2hlY2tEZXRhaWxzIjpbeyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoibW9ydGFsaXR5X2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoiaWRlbnRpdHlfdGhlZnRfY2hlY2sifSx7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImZyYXVkQ2hlY2siOiJzeW50aGV0aWNfaWRlbnRpdHlfY2hlY2sifSx7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImZyYXVkQ2hlY2siOiJpbXBlcnNvbmF0aW9uX3Jpc2tfY2hlY2sifV0sImNpIjpbIkYwNCJdfV0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOlt7Im5hbWVQYXJ0cyI6W3sidHlwZSI6IkdpdmVuTmFtZSIsInZhbHVlIjoiSmFuZSJ9LHsidHlwZSI6IkZhbWlseU5hbWUiLCJ2YWx1ZSI6IldyaWdodCJ9XSwidmFsaWRGcm9tIjoiMjAxOS0wNC0wMSJ9LHsidmFsaWRVbnRpbCI6IjIwMjktMDQtMDEiLCJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV19XSwiYmlydGhEYXRlIjpbeyJ2YWx1ZSI6IjE5ODktMDctMDYifV19LCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiSWRlbnRpdHlDaGVja0NyZWRlbnRpYWwiXSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3ZvY2FiLmxvbmRvbi5jbG91ZGFwcHMuZGlnaXRhbC9jb250ZXh0cy9pZGVudGl0eS12MS5qc29ubGQiXX0sInZ0bSI6Imh0dHBzOi8vb2lkYy5hY2NvdW50Lmdvdi51ay90cnVzdG1hcmsifQ.MEQCIHy50XHTu2s0SAtsXs02d4VxUZta5rDuK0KTtv6Ya3oXAiBceSvuMd0n5uddq5QnD0cuvGwk26Oe_i3inH_i5azt6g', // pragma: allowlist secret
  passport:
    'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOjU3YTI0Yzc5LWJmNWEtNDNiZC1iMWRmLWRhMDRhODhiYTZmZSIsIm5iZiI6MTY1MjAyMDExMCwiaXNzIjoiaHR0cHM6Ly9yZXZpZXctcC5hY2NvdW50Lmdvdi51ayIsInZvdCI6IlAyIiwiZXhwIjoxNjgzNjI4MTEwLCJpYXQiOjE2NTIwOTIxMTAsInZjIjp7ImV2aWRlbmNlIjpbeyJhY3Rpdml0eUhpc3RvcnlTY29yZSI6MCwidmFsaWRpdHlTY29yZSI6MCwidmVyaWZpY2F0aW9uU2NvcmUiOjAsInN0cmVuZ3RoU2NvcmUiOjQsInR4biI6InR4biIsImlkZW50aXR5RnJhdWRTY29yZSI6MCwidHlwZSI6IklkZW50aXR5Q2hlY2siLCJjaGVja0RldGFpbHMiOlt7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImRhdGFDaGVjayI6InJlY29yZF9jaGVjayJ9XSwiZmFpbGVkQ2hlY2tEZXRhaWxzIjpbeyJjaGVja01ldGhvZCI6ImRhdGEiLCJkYXRhQ2hlY2siOiJjYW5jZWxsZWRfY2hlY2sifSx7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImRhdGFDaGVjayI6Imxvc3Rfc3RvbGVuX2NoZWNrIn1dfV0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOlt7Im5hbWVQYXJ0cyI6W3sidHlwZSI6IkdpdmVuTmFtZSIsInZhbHVlIjoiSmFuZSJ9LHsidHlwZSI6IkZhbWlseU5hbWUiLCJ2YWx1ZSI6IldyaWdodCJ9XSwidmFsaWRGcm9tIjoiMjAxOS0wNC0wMSJ9LHsidmFsaWRVbnRpbCI6IjIwMjktMDQtMDEiLCJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV19XSwiYmlydGhEYXRlIjpbeyJ2YWx1ZSI6IjE5ODktMDctMDYifV0sInBhc3Nwb3J0IjpbeyJkb2N1bWVudE51bWJlciI6IjEyMjM0NTY3OCIsImV4cGlyeURhdGUiOiIyMDIyLTAyLTAyIiwiaWNhb0lzc3VlckNvZGUiOiJHQlIifV19LCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiSWRlbnRpdHlDaGVja0NyZWRlbnRpYWwiXSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3ZvY2FiLmxvbmRvbi5jbG91ZGFwcHMuZGlnaXRhbC9jb250ZXh0cy9pZGVudGl0eS12MS5qc29ubGQiXX0sInZ0bSI6Imh0dHBzOi8vb2lkYy5hY2NvdW50Lmdvdi51ay90cnVzdG1hcmsifQ.MEUCIQD3sJmXxyxkcl75_KDhTiytQuywwof7VgGOU9CO3AyikwIgELjpM4zfobUiReVasOM8rVHhB-lOXFoTGOfjBdeTLJs', // pragma: allowlist secret
  kbv: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOlBWUUk3Z0VmR1o2a080X0Z4eDZjaHF0SGNobzVzcjgtazA0MUdxci1YbzQiLCJuYmYiOjE2NTIwMjAxNTMsImlzcyI6Imh0dHBzOi8vcmV2aWV3LWsuYWNjb3VudC5nb3YudWsiLCJ2b3QiOiJQMiIsImV4cCI6MTY4MzYyODE1MywiaWF0IjoxNjUyMDkyMTUzLCJ2YyI6eyJldmlkZW5jZSI6W3siYWN0aXZpdHlIaXN0b3J5U2NvcmUiOjAsInZhbGlkaXR5U2NvcmUiOjAsInZlcmlmaWNhdGlvblNjb3JlIjoyLCJzdHJlbmd0aFNjb3JlIjowLCJ0eG4iOiJ0eG4iLCJpZGVudGl0eUZyYXVkU2NvcmUiOjAsInR5cGUiOiJJZGVudGl0eUNoZWNrIn1dLCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lIjpbeyJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV0sInZhbGlkRnJvbSI6IjIwMTktMDQtMDEifSx7InZhbGlkVW50aWwiOiIyMDI5LTA0LTAxIiwibmFtZVBhcnRzIjpbeyJ0eXBlIjoiR2l2ZW5OYW1lIiwidmFsdWUiOiJKYW5lIn0seyJ0eXBlIjoiRmFtaWx5TmFtZSIsInZhbHVlIjoiV3JpZ2h0In1dfV0sImJpcnRoRGF0ZSI6W3sidmFsdWUiOiIxOTg5LTA3LTA2In1dfSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q2hlY2tDcmVkZW50aWFsIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly92b2NhYi5sb25kb24uY2xvdWRhcHBzLmRpZ2l0YWwvY29udGV4dHMvaWRlbnRpdHktdjEuanNvbmxkIl19LCJ2dG0iOiJodHRwczovL29pZGMuYWNjb3VudC5nb3YudWsvdHJ1c3RtYXJrIn0.MEUCIDb_M_4HbcIce_Vep0Mb-OKjRtTdYi0mM4JVEgVlDKZcAiEAwAsSahrKBmjbGxhES8sRjVRktgxtynXYyO0RDhzFvg8' // pragma: allowlist secret
}

const jwtSignatures = {
  fraud: 'MEQCIHy50XHTu2s0SAtsXs02d4VxUZta5rDuK0KTtv6Ya3oXAiBceSvuMd0n5uddq5QnD0cuvGwk26Oe_i3inH_i5azt6g', // pragma: allowlist secret
  passport: 'MEUCIQD3sJmXxyxkcl75_KDhTiytQuywwof7VgGOU9CO3AyikwIgELjpM4zfobUiReVasOM8rVHhB-lOXFoTGOfjBdeTLJs', // pragma: allowlist secret
  kbv: 'MEUCIDb_M_4HbcIce_Vep0Mb-OKjRtTdYi0mM4JVEgVlDKZcAiEAwAsSahrKBmjbGxhES8sRjVRktgxtynXYyO0RDhzFvg8' // pragma: allowlist secret
}

export function updateVC(): void {
  let body: string
  const groups = groupMap.updateVC
  const userID = uuidv4()
  const subjectID = `urn:fdc:gov.uk:2022:${userID}`
  iterationsStarted.add(1)
  const options = {
    headers: {
      'x-api-key': env.envApiKey
    }
  }

  body = JSON.stringify(Object.values(jwtTokens).map(token => generateCreateVCPayload(token, 'PENDING')))

  timeGroup(groups[0], () => http.post(env.envURL + `/vcs/${subjectID}`, body, options), {
    isStatusCode202: r => r.status === 202,
    ...pageContentCheck('messageId')
  })

  sleep(1)

  body = JSON.stringify(Object.values(jwtSignatures).map(signature => generateUpdateVCPayload(signature, 'CURRENT')))

  timeGroup(groups[1], () => http.patch(env.envURL + `/vcs/${subjectID}`, body, options), {
    isStatusCode204: r => r.status === 204
  })

  iterationsCompleted.add(1)
}

export function summariseVC(): void {
  const groups = groupMap.summariseVC
  const summariseData = csvData[Math.floor(Math.random() * csvData.length)]
  iterationsStarted.add(1)

  // R02_SummariseVC_01_GenerateTokenSummary
  const res: Response = timeGroup(
    groups[0],
    () => http.post(env.envMock + '/generate', JSON.stringify({ sub: summariseData.subID, scope: null, ttl: 120 })),
    { isStatusCode200, ...pageContentCheck('token') }
  )
  const token = getToken(res)

  const options = { headers: { Authorization: `Bearer ${token}`, 'x-api-key': env.envApiKeySummarise } }

  // R02_SummariseVC_02_Summarise
  timeGroup(groups[1], () => http.get(env.envURL + `/summarise-vcs/${summariseData.subID}`, options), {
    isStatusCode200,
    ...pageContentCheck('vcs')
  })
  iterationsCompleted.add(1)
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
    return signJwt('ES256', importedKey, payload, env.identityKid)
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
      'x-api-key': env.identityApiKey
    }
  }

  iterationsStarted.add(1)
  // B01_SIS_01_IdentityCall
  timeGroup(groups[0], () => http.post(env.identityURL + '/v1/identity', identityReqBody, params), {
    isStatusCode202
  })

  sleep(5)

  // B01_SIS_01_InvalidateCall
  timeGroup(groups[1], () => http.post(env.identityURL + '/v1/identity/invalidate', invalidateReqBody, params), {
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
      'x-api-key': env.identityApiKey
    }
  }

  iterationsStarted.add(1)

  // B02_SIS_01_InvalidateCall
  timeGroup(groups[0], () => http.post(env.identityURL + '/v1/identity/invalidate', invalidateReqBody, params), {
    isStatusCode404: r => r.status === 404
  })

  iterationsCompleted.add(1)
}

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

interface UpdateVCPayload {
  signature: string
  state: VcState
}

function generateUpdateVCPayload(vcSign: string, vcState: VcState): UpdateVCPayload {
  return {
    signature: vcSign,
    state: vcState
  }
}
