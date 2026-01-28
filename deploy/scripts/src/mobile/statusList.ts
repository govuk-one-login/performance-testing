import {
  selectProfile,
  createScenario,
  describeProfile,
  LoadProfile,
  type ProfileList,
  createI4PeakTestSignInScenario,
  createI3SpikeSignInScenario
} from '../common/utils/config/load-profiles'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode202, pageContentCheck } from '../common/utils/checks/assertions'
import { getEnv } from '../common/utils/config/environment-variables'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { generateIssuePayload, generateRevokePayload } from './status-list/payloadGen/generator'
import { signRequest } from './utils/signatureV4'
import { AssumeRoleOutput } from '../common/utils/aws/types'
import { getURI, getIDX } from './status-list/utils/issueResponseValidation'
import { environment, config } from './status-list/utils/config'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('statusList', LoadProfile.smoke)
  },
  loadTest: {
    ...createI4PeakTestSignInScenario('statusList', 28, 18, 14)
  },
  perf006Iteration7SpikeTest: {
    ...createI3SpikeSignInScenario('statusList', 140, 18, 65)
  }
}

const loadProfile = selectProfile(profiles)

const groupMap = {
  statusList: [
    'B01_StatusList_01_SignIssuePayLoad',
    'B01_StatusList_02_IssueAPICallViaProxy',
    'B01_StatusList_03_IssueAPICallViaPrivateAPI',
    'B01_StatusList_04_SignRevokePayload',
    'B01_StatusList_05_RevokeCallViaProxy',
    'B01_StatusList_06_RevokeCallViaPrivateAPI',
    'B01_StatusList_07_GetStatusList'
  ]
}
interface StatusListData {
  statusListId: string
}

const statusListIds: StatusListData[] = new SharedArray('statusListIds', function () {
  return open('./status-list/data/statusListIds.csv')
    .split('\n')
    .slice(1)
    .filter(line => line.trim())
    .map(line => ({ statusListId: line.trim() }))
})

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
  describeProfile(loadProfile)
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
  const issuePayload = JSON.stringify(generateIssuePayload(config.clientID))
  const environmentName = environment.toLowerCase()

  const signedRequestMockIssue = signRequest(
    getEnv('AWS_REGION'),
    credentials,
    'POST',
    config.mockURL.split('https://')[1],
    '/mock-cri/sign-jwt-payload',
    {
      'Content-Type': 'application/json',
      Accept: 'application/jwt'
    },
    issuePayload
  )

  iterationsStarted.add(1)

  //  B01_StatusList_01_SignIssuePayLoad
  res = timeGroup(
    groups[0],
    () => http.post(signedRequestMockIssue.url, issuePayload, { headers: signedRequestMockIssue.headers }),
    {
      isStatusCode200
    }
  )

  sleepBetween(1, 3)

  if (config.isProxy === 'True') {
    const signedRequestProxyIssue = signRequest(
      getEnv('AWS_REGION'),
      credentials,
      'POST',
      config.envURL.split('https://')[1],
      '/issue',
      {
        'Content-Type': 'application/jwt'
      },
      res.body as string
    )

    //  B01_StatusList_02_IssueAPICallViaProxy
    res = timeGroup(
      groups[1],
      () => http.post(signedRequestProxyIssue.url, res.body, { headers: signedRequestProxyIssue.headers }),
      {
        isStatusCode200,
        ...pageContentCheck('idx')
      }
    )
  } else {
    // B01_StatusList_03_IssueAPICallViaPrivateAPI
    res = timeGroup(
      groups[2],
      () => http.post(`${config.envURL}/${environmentName}/issue`, res.body, statusListHeaders),
      {
        isStatusCode200,
        ...pageContentCheck('idx')
      }
    )
  }

  const uriValue = getURI(res)
  const idxValue = getIDX(res)
  const issuePayloadJSON = JSON.parse(issuePayload)
  const revokePayload = JSON.stringify(generateRevokePayload(config.clientID, issuePayloadJSON.iat, uriValue, idxValue))

  const signedRequestMockRevoke = signRequest(
    getEnv('AWS_REGION'),
    credentials,
    'POST',
    config.mockURL.split('https://')[1],
    '/mock-cri/sign-jwt-payload',
    {
      'Content-Type': 'application/json',
      Accept: 'application/jwt'
    },
    revokePayload
  )

  sleepBetween(1, 3)

  // 90% of the users call /revoke

  if (Math.random() <= 0.9) {
    // B01_StatusList_04_SignRevokePayload
    res = timeGroup(
      groups[3],
      () => http.post(signedRequestMockRevoke.url, revokePayload, { headers: signedRequestMockRevoke.headers }),
      {
        isStatusCode200
      }
    )
    sleepBetween(1, 3)

    if (config.isProxy === 'True') {
      const signedRequestProxyRevoke = signRequest(
        getEnv('AWS_REGION'),
        credentials,
        'POST',
        config.envURL.split('https://')[1],
        '/revoke',
        {
          'Content-Type': 'application/jwt'
        },
        res.body as string
      )

      // B01_StatusList_05_RevokeCallViaProxy
      res = timeGroup(
        groups[4],
        () => http.post(signedRequestProxyRevoke.url, res.body, { headers: signedRequestProxyRevoke.headers }),
        {
          isStatusCode202,
          ...pageContentCheck('Request processed for revocation')
        }
      )
    } else {
      //B01_StatusList_06_RevokeCallViaPrivateAPI
      res = timeGroup(
        groups[5],
        () => http.post(`${config.envURL}/${environmentName}/revoke`, res.body, statusListHeaders),
        {
          isStatusCode202,
          ...pageContentCheck('Request processed for revocation')
        }
      )
    }
  }
  sleepBetween(1, 3)

  // B01_StatusList_07_GetStatusList
  const statusListData = statusListIds[exec.scenario.iterationInTest % statusListIds.length]
  timeGroup(groups[6], () => http.get(`${config.crsURL}/${statusListData.statusListId}`), {
    isStatusCode200
  })

  iterationsCompleted.add(1)
}
