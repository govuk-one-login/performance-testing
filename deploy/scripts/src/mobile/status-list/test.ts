import {
  selectProfile,
  createScenario,
  describeProfile,
  LoadProfile,
  type ProfileList
} from '../../common/utils/config/load-profiles'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { iterationsCompleted, iterationsStarted } from '../../common/utils/custom_metric/counter'
import { timeGroup } from '../../common/utils/request/timing'
import { isStatusCode200, isStatusCode202 } from '../../common/utils/checks/assertions'
import { getEnv } from '../../common/utils/config/environment-variables'
import { sleepBetween } from '../../common/utils/sleep/sleepBetween'
import { generateIssuePayload, generateRevokePayload } from './payloadGen/generator'
import { signRequest } from '../utils/signatureV4'
import { AssumeRoleOutput } from '../../common/utils/aws/types'
import { getURI, getIDX } from './utils/issueResponse'

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
const environment = getEnv('ENVIRONMENT').toLocaleUpperCase()
const validEnvironments = ['BUILD', 'DEV']
if (!validEnvironments.includes(environment))
  throw new Error(`Environment '${environment}' not in [${validEnvironments.toString()}]`)

const env = {
  mockURL: getEnv('STATUS_LIST_JWT_MOCK_URL'),
  envURL: getEnv('STATUS_LIST_URL'),
  clientID: getEnv('STATUS_LIST_CLIENT_ID')
}

const statusListHeaders = {
  headers: {
    'Content-Type': 'application/jwt'
  }
}
const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials

export function statusList(): void {
  const groups = groupMap.statusList
  let res: Response
  const issuePayload = JSON.stringify(generateIssuePayload(env.clientID))

  const signedRequestIssue = signRequest(
    getEnv('AWS_REGION'),
    credentials,
    'POST',
    env.mockURL.split('https://')[1],
    '/mock-cri/sign-jwt-payload',
    {
      'Content-Type': 'application/json',
      Accept: 'application/jwt'
    },
    issuePayload
  )

  console.log(JSON.parse(issuePayload))

  iterationsStarted.add(1)

  console.log(signedRequestIssue.url)
  console.log(signedRequestIssue.headers)

  //  B01_StatusList_01_IssuePayLoadSign

  res = timeGroup(
    groups[0],
    () => http.post(signedRequestIssue.url, issuePayload, { headers: signedRequestIssue.headers }),
    {
      isStatusCode200
    }
  )

  sleepBetween(1, 3)

  console.log(res.body)

  // B01_StatusList_02_IssueSLEntry
  /*
  res = timeGroup(groups[1], () => http.post(`${env.envURL}/${environment}/issue`, res.body, statusListHeaders), {
    isStatusCode200
  })*/

  res = timeGroup(groups[1], () => http.post(`${env.envURL}/issue`, res.body, statusListHeaders), {
    isStatusCode200
  })

  const uriValue = getURI(res)
  const idxValue = getIDX(res)

  console.log(uriValue)

  console.log(idxValue)

  /*const issuePayload = JSON.stringify(generateRevokePayload(env.clientID))

  const signedRequestIssue = signRequest(
    getEnv('AWS_REGION'),
    credentials,
    'POST',
    env.mockURL.split('https://')[1],
    '/mock-cri/sign-jwt-payload',
    {
      'Content-Type': 'application/json',
      Accept: 'application/jwt'
    },
    issuePayload
  )

  sleepBetween(1, 3)

  // 'B01_StatusList_02_RevokePayloadSign',



  res = timeGroup(groups[3], () => http.post(env.mockEnvUrl + 'mock-cri/sign-jwt-payload', basePayload, mockParams), {
    isStatusCode200
  })

  //B01_StatusList_04_RevokeSLEntry

  res = timeGroup(groups[2], () => http.post(env.slEnvUrl + '/build/revoke', res.body, slParams), {
    isStatusCode202
  })*/

  iterationsCompleted.add(1)
}
