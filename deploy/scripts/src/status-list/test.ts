import {
  selectProfile,
  createScenario,
  describeProfile,
  LoadProfile,
  type ProfileList
} from '../common/utils/config/load-profiles'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode202 } from '../common/utils/checks/assertions'
import { getEnv } from '../common/utils/config/environment-variables'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { generateIssuePayload, generateRevokePayload } from './generator'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('statusList', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)

const groupMap = {
  statusList: [
    'B01_StatusList_01_IssuePayLoadSign',
    'B01_StatusList_02_IssueSLEntry',
    'B01_StatusList_03_RevokePayloadSign',
    'B01_StatusList_04_RevokeSLEntry'
  ]
}

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'],
    http_req_failed: ['rate<0.05']
  }
}

export function setup(): void {
  describeProfile(loadProfile)
}

const env = {
  mockEnvUrl: getEnv('STATUS_LIST_JWT_MOCK_URL'),
  slEnvUrl: getEnv('STATUS_LIST_URL')
}

const mockParams = {
  headers: {
    'Content-Type': 'application/json',
    Accept: 'applciation/jwt'
  }
}

const slParams = {
  headers: {
    'Content-Type': 'application/jwt',
    Accept: 'application/json'
  }
}
export interface RevokeParams {
  cUrl: string
  idx: number
}
// export interface issueResponse {
//   uri: string
//   idx: number
// }

export function statusList(): void {
  const groups = groupMap.statusList
  let res: Response
  let basePayload = sigV4Sign(generateIssuePayload()) //placeholder function, WIP

  iterationsStarted.add(1)

  //  B01_StatusList_01_IssuePayLoadSign

  res = timeGroup(groups[0], () => http.post(env.mockEnvUrl + 'mock-cri/sign-jwt-payload', basePayload, mockParams), {
    isStatusCode200
  })

  sleepBetween(1, 3)

  // B01_StatusList_02_IssueSLEntry

  res = timeGroup(groups[1], () => http.post(env.slEnvUrl + '/build/issue', res.body, slParams), {
    isStatusCode200
    // candidate for content check?? "uri": "https://crs.account.gov.uk
  })

  // const resData = res.json<issueResponse>()

  sleepBetween(1, 3)

  // 'B01_StatusList_02_RevokePayloadSign',

  basePayload = sigV4Sign(generateRevokePayload(res.body.uri, res.body.idx)) // uri and idx to be passed as arguments..

  res = timeGroup(groups[3], () => http.post(env.mockEnvUrl + 'mock-cri/sign-jwt-payload', basePayload, mockParams), {
    isStatusCode200
  })

  //B01_StatusList_04_RevokeSLEntry

  res = timeGroup(groups[2], () => http.post(env.slEnvUrl + '/build/revoke', res.body, slParams), {
    isStatusCode202
  })

  iterationsCompleted.add(1)
}
