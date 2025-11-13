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
import { generateIdentityPayload } from './utils/requestGenerator'
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
  identity: ['B01_SIS_01_IdentityCall', 'B01_SIS_01_InvalidateCall'],
  invalidate: ['B02_SIS_01_InvalidateCall'],
  useridentity: [
    'B03_SIS_01_PersistVCStubCall',
    'B03_SIS_02_IdentityStubCall',
    'B03_SIS_03_GetMockToken',
    'B03_SIS_04_UserIdentityCall'
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
  identityURL: getEnv('IDENTITY_SIS_IDENTITY_URL'),
  identityApiKey: getEnv('IDENTITY_SIS_IDENTITY_APIKEY'),
  identityKid: getEnv('IDENTITY_SIS_IDENTITY_KID'),
  evcsStubApiKey: getEnv('IDENTITY_SIS_EVCSSTUB_APIKEY'),
  evcsStubUrl: getEnv('IDENTITY_SIS_EVCSSTUB_URL'),
  mockTokenUrl: getEnv('IDENTITY_SIS_MOCKTOKEN_URL'),
  userIdentityUrl: getEnv('IDENTITY_SIS_USERIDENTITY_URL'),
  userIdentityApiKey: getEnv('IDENTITY_SIS_USERIDENTITY_APIKEY'),
  userIdentityKid: getEnv('IDENTITY_SIS_USERIDENTITY_KID')
}
const keys = {
  identity: JSON.parse(getEnv('IDENTITY_SIS_IDENTITY_PRIVATEKEY')) as JsonWebKey,
  useridentity: JSON.parse(getEnv('IDENTITY_SIS_USERIDENTITY_PRIVATEKEY')) as JsonWebKey
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

export async function useridentity(): Promise<void> {
  let res: Response
  const groups = groupMap.useridentity
  const subjectID = 'urn:fdc:gov.uk:2022:' + uuidv4()

  iterationsStarted.add(1)
  const persistVCHeaders = {
    headers: {
      'x-api-key': env.evcsStubApiKey
    }
  }
  const persistVCJWTTokens = {
    fraud:
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOkNZN1E2TDd4MEFlQWNmYUdlazY2R2FKeVhhM2R4RVhBaDRxWWtETUVzMUUiLCJuYmYiOjE3NjAyOTk1ODcsImlzcyI6Imh0dHBzOi8vcmV2aWV3LWYuZGV2LmFjY291bnQuZ292LnVrIiwidm90IjoiUDIiLCJleHAiOjE3Nzg2MTYzODcsImlhdCI6MTc2MDI5OTU4NywidmMiOnsiZXZpZGVuY2UiOlt7ImFjdGl2aXR5SGlzdG9yeVNjb3JlIjowLCJ2YWxpZGl0eVNjb3JlIjowLCJ2ZXJpZmljYXRpb25TY29yZSI6MCwic3RyZW5ndGhTY29yZSI6MCwidHhuIjoidHhuIiwiaWRlbnRpdHlGcmF1ZFNjb3JlIjoyLCJ0eXBlIjoiSWRlbnRpdHlDaGVjayIsImNoZWNrRGV0YWlscyI6W3siY2hlY2tNZXRob2QiOiJkYXRhIiwiZnJhdWRDaGVjayI6Im1vcnRhbGl0eV9jaGVjayJ9LHsiY2hlY2tNZXRob2QiOiJkYXRhIiwiZnJhdWRDaGVjayI6ImlkZW50aXR5X3RoZWZ0X2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoic3ludGhldGljX2lkZW50aXR5X2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoiaW1wZXJzb25hdGlvbl9yaXNrX2NoZWNrIn1dLCJjaSI6WyJGMDQiXX1dLCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lIjpbeyJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV0sInZhbGlkRnJvbSI6IjIwMTktMDQtMDEifSx7InZhbGlkVW50aWwiOiIyMDI5LTA0LTAxIiwibmFtZVBhcnRzIjpbeyJ0eXBlIjoiR2l2ZW5OYW1lIiwidmFsdWUiOiJKYW5lIn0seyJ0eXBlIjoiRmFtaWx5TmFtZSIsInZhbHVlIjoiV3JpZ2h0In1dfV0sImJpcnRoRGF0ZSI6W3sidmFsdWUiOiIxOTg5LTA3LTA2In1dfSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q2hlY2tDcmVkZW50aWFsIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly92b2NhYi5sb25kb24uY2xvdWRhcHBzLmRpZ2l0YWwvY29udGV4dHMvaWRlbnRpdHktdjEuanNvbmxkIl19LCJ2dG0iOiJodHRwczovL29pZGMuYWNjb3VudC5nb3YudWsvdHJ1c3RtYXJrIn0.xUPW2AvpVTBzeFrJSwrJz47N4RA3Eveyr-uWgCYfxSoNmpSPvuQQgenfS7lxBzs4esP8NSch999SrS6IFTkl-g', // pragma: allowlist secret
    passport:
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOjU3YTI0Yzc5LWJmNWEtNDNiZC1iMWRmLWRhMDRhODhiYTZmZSIsIm5iZiI6MTc2MDI5OTU4NywiaXNzIjoiaHR0cHM6Ly9yZXZpZXctcC5hY2NvdW50Lmdvdi51ayIsInZvdCI6IlAyIiwiZXhwIjoxNzc4NjE2Mzg3LCJpYXQiOjE3NjAyOTk1ODcsInZjIjp7ImV2aWRlbmNlIjpbeyJhY3Rpdml0eUhpc3RvcnlTY29yZSI6MCwidmFsaWRpdHlTY29yZSI6MCwidmVyaWZpY2F0aW9uU2NvcmUiOjAsInN0cmVuZ3RoU2NvcmUiOjQsInR4biI6InR4biIsImlkZW50aXR5RnJhdWRTY29yZSI6MCwidHlwZSI6IklkZW50aXR5Q2hlY2siLCJjaGVja0RldGFpbHMiOlt7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImRhdGFDaGVjayI6InJlY29yZF9jaGVjayJ9XSwiZmFpbGVkQ2hlY2tEZXRhaWxzIjpbeyJjaGVja01ldGhvZCI6ImRhdGEiLCJkYXRhQ2hlY2siOiJjYW5jZWxsZWRfY2hlY2sifSx7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImRhdGFDaGVjayI6Imxvc3Rfc3RvbGVuX2NoZWNrIn1dfV0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOlt7Im5hbWVQYXJ0cyI6W3sidHlwZSI6IkdpdmVuTmFtZSIsInZhbHVlIjoiSmFuZSJ9LHsidHlwZSI6IkZhbWlseU5hbWUiLCJ2YWx1ZSI6IldyaWdodCJ9XSwidmFsaWRGcm9tIjoiMjAxOS0wNC0wMSJ9LHsidmFsaWRVbnRpbCI6IjIwMjktMDQtMDEiLCJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV19XSwiYmlydGhEYXRlIjpbeyJ2YWx1ZSI6IjE5ODktMDctMDYifV0sInBhc3Nwb3J0IjpbeyJkb2N1bWVudE51bWJlciI6IjEyMjM0NTY3OCIsImV4cGlyeURhdGUiOiIyMDIyLTAyLTAyIiwiaWNhb0lzc3VlckNvZGUiOiJHQlIifV19LCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiSWRlbnRpdHlDaGVja0NyZWRlbnRpYWwiXSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3ZvY2FiLmxvbmRvbi5jbG91ZGFwcHMuZGlnaXRhbC9jb250ZXh0cy9pZGVudGl0eS12MS5qc29ubGQiXX0sInZ0bSI6Imh0dHBzOi8vb2lkYy5hY2NvdW50Lmdvdi51ay90cnVzdG1hcmsifQ.ZcXdVTWbkurRCl854IkYWCZHqAAn2y5WVhoqXs1p-n8pbEyS3xWFCog-_cVtBVrYQdkxtIQJN4jr6265bbTohA', // pragma: allowlist secret
    kbv: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOlBWUUk3Z0VmR1o2a080X0Z4eDZjaHF0SGNobzVzcjgtazA0MUdxci1YbzQiLCJuYmYiOjE3NjAyOTk1ODcsImlzcyI6Imh0dHBzOi8vcmV2aWV3LWsuYWNjb3VudC5nb3YudWsiLCJ2b3QiOiJQMiIsImV4cCI6MTc3ODYxNjM4NywiaWF0IjoxNzYwMjk5NTg3LCJ2YyI6eyJldmlkZW5jZSI6W3siYWN0aXZpdHlIaXN0b3J5U2NvcmUiOjAsInZhbGlkaXR5U2NvcmUiOjAsInZlcmlmaWNhdGlvblNjb3JlIjoyLCJzdHJlbmd0aFNjb3JlIjowLCJ0eG4iOiJ0eG4iLCJpZGVudGl0eUZyYXVkU2NvcmUiOjAsInR5cGUiOiJJZGVudGl0eUNoZWNrIn1dLCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lIjpbeyJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV0sInZhbGlkRnJvbSI6IjIwMTktMDQtMDEifSx7InZhbGlkVW50aWwiOiIyMDI5LTA0LTAxIiwibmFtZVBhcnRzIjpbeyJ0eXBlIjoiR2l2ZW5OYW1lIiwidmFsdWUiOiJKYW5lIn0seyJ0eXBlIjoiRmFtaWx5TmFtZSIsInZhbHVlIjoiV3JpZ2h0In1dfV0sImJpcnRoRGF0ZSI6W3sidmFsdWUiOiIxOTg5LTA3LTA2In1dfSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q2hlY2tDcmVkZW50aWFsIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly92b2NhYi5sb25kb24uY2xvdWRhcHBzLmRpZ2l0YWwvY29udGV4dHMvaWRlbnRpdHktdjEuanNvbmxkIl19LCJ2dG0iOiJodHRwczovL29pZGMuYWNjb3VudC5nb3YudWsvdHJ1c3RtYXJrIn0.g610xpaS5QmLBWihiC9yc9iNcLIlm7U3BGvcqZGwj4PiLA1r5trOdSBZnJbk845INCAUXhMgn4TiIKmRk3g1cA' // pragma: allowlist secret
  }
  const persistVCReqBody = JSON.stringify(
    Object.values(persistVCJWTTokens).map(token => generateCreateVCPayload(token, 'CURRENT'))
  )

  // B03_SIS_01_PersistVCStubCall
  res = timeGroup(
    groups[0],
    () => http.post(env.evcsStubUrl + `/vcs/${subjectID}`, persistVCReqBody, persistVCHeaders),
    {
      isStatusCode202: r => r.status === 202,
      ...pageContentCheck('messageId')
    }
  )

  //Signing Stored Identity(SIS) payload record
  const payloads = {
    identityPayload: generateIdentityPayload(subjectID)
  }
  const createJwt = async (key: JsonWebKey, payload: object): Promise<string> => {
    const escdaParam: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
    const importedKey = await crypto.subtle.importKey('jwk', key, escdaParam, true, ['sign'])
    return signJwt('ES256', importedKey, payload, env.userIdentityKid)
  }
  const identityJWT = await createJwt(keys.useridentity, payloads.identityPayload)
  //B03_SIS_02_IdentityStubCall
  const identityReqBody = JSON.stringify({
    userId: subjectID,
    si: {
      jwt: identityJWT,
      vot: 'P2'
    }
  })
  const identityHeaders = {
    headers: {
      'x-api-key': env.evcsStubApiKey
    }
  }

  res = timeGroup(groups[1], () => http.post(env.evcsStubUrl + '/v1/identity', identityReqBody, identityHeaders), {
    isStatusCode202
  })

  // B03_SIS_03_GetMockToken
  res = timeGroup(
    groups[2],
    () =>
      http.post(
        env.mockTokenUrl + '/generate',
        JSON.stringify({
          sub: subjectID,
          scope: null,
          ttl: 120
        })
      ),
    { isStatusCode200, ...pageContentCheck('token') }
  )
  const token = getToken(res)

  const userIdentityHeaders = {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': env.userIdentityApiKey
    }
  }
  const useridentityReqBody = JSON.stringify({
    vtr: ['P2'],
    govukSigninJourneyId: uuidv4()
  })

  // B03_SIS_04_UserIdentityCall
  res = timeGroup(
    groups[3],
    () => http.post(env.userIdentityUrl + '/user-identity', useridentityReqBody, userIdentityHeaders),
    {
      isStatusCode204
    }
  )

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
