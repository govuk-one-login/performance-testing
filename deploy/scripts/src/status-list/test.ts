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
import { isStatusCode200 } from '../common/utils/checks/assertions'
import { getEnv } from '../common/utils/config/environment-variables'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { generateIssuePayload } from './generate-payload'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('statusList', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)

const groupMap = {
  statusList: ['B01_StatusList_00_PayLoadSign', 'B01_StatusList_01_IssueSLEntry', 'B01_StatusList_02_RevokeSLEntry']
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

// const slParams = {
//   headers: {
//     'Content-Type': 'application/jwt',
//     Accept: 'application/json'
//   }
// }

export function statusList(): void {
  const groups = groupMap.statusList
  let res: Response
  const signedPayload = sig4SignRequest(generateIssuePayload()) //WIP progress -- Sign the 'payload' with  AWS protect SigV4

  iterationsStarted.add(1)

  //B01_StatusList_00_SignPayload
  res = timeGroup(groups[0], () => http.post(env.mockEnvUrl + 'mock-cri/sign-jwt-payload', signedPayload, mockParams), {
    isStatusCode200
  })

  sleepBetween(1, 3)

  //B01_StatusList_01_IssueSLEntry
  // res = timeGroup(groups[1],() => http.post(env.slEnvUrl + '/build/issue', xxxx, slParams)){
  //     isStatusCode200
  // }

  sleepBetween(1, 3)

  //B01_StatusList_02_RevokeSLEntry
  // res = timeGroup(groups[2],() => http.post(env.slEnvUrl + '/build/revoke', xxx)){
  //     isStatusCode202
  // }

  iterationsCompleted.add(1)
}
