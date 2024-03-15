import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { group, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { selectProfile, type ProfileList, describeProfile, createScenario, LoadProfile } from '../common/utils/config/load-profiles'
import { SharedArray } from 'k6/data'
import { uuidv4 } from '../common/utils/jslib'
import { timeRequest } from '../common/utils/request/timing'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { getEnv } from '../common/utils/config/environment-variables'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('persistVC', LoadProfile.smoke),
    ...createScenario('summariseVC', LoadProfile.smoke)
  },
  initialLoad: {
    ...createScenario('persistVC', LoadProfile.full, 30, 15),
    ...createScenario('summariseVC', LoadProfile.full, 30, 15)
  },
  load: {
    ...createScenario('persistVC', LoadProfile.full, 100, 15),
    ...createScenario('summariseVC', LoadProfile.full, 1900, 3)
  },
  dataCreationForSummarise: {
    persistVC: {
      executor: 'per-vu-iterations',
      vus: 250,
      iterations: 200,
      maxDuration: '120m',
      exec: 'persistVC'
    }
  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'], // 95th percentile response time <=1000ms, 99th percentile response time <=2500ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
}

export function setup (): void {
  describeProfile(loadProfile)
}

interface SummariseSubjectID {
  subID: string
}

const csvData: SummariseSubjectID[] = new SharedArray('Summarise Subject ID', function () {
  return open('./data/summariseSubjectID.csv').split('\n').slice(1).map((subID) => {
    return {
      subID
    }
  })
})

const env = {
  envURL: getEnv('ACCOUNT_BRAVO_ID_REUSE_URL'),
  envMock: getEnv('ACCOUNT_BRAVO_ID_REUSE_MOCK'),
  envApiKey: getEnv('ACCOUNT_BRAVO_ID_REUSE_API_KEY'),
  envApiKeySummarise: getEnv('ACCOUNT_BRAVO_ID_REUSE_API_KEY_SUMMARISE')
}
export function persistVC (): void {
  let res: Response
  const userID = uuidv4()
  const subjectID = `urn:fdc:gov.uk:2022:${userID}`
  iterationsStarted.add(1)
  res = group('R01_PersistVC_01_GenerateToken POST', () =>
    timeRequest(() => http.post(env.envMock + '/generate',
      JSON.stringify({
        sub: subjectID
      }),
      {
        tags: { name: 'R01_PersistVC_01_GenerateToken' }
      }),
    { isStatusCode200, ...pageContentCheck('token') }))
  const token = getToken(res)

  sleepBetween(1, 3)

  const options = {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': env.envApiKey
    },
    tags: { name: 'R01_PersistVC_02_CreateVC' }
  }
  const body = JSON.stringify([
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.LeLQg33PXWySMBwXi0KnJsKwO3Cb7a2pd501orGEyEo', // pragma: allowlist secret
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvbiBEb2UiLCJpYXQiOjE1MTYyMzkwMjJ9.6PIinUiv_RExeCq3XlTQqIAPqLv_jkpeFtqDc1PcWwQ', // pragma: allowlist secret
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c' // pragma: allowlist secret
  ])
  res = group('R01_PersistVC_02_CreateVC POST', () =>
    timeRequest(() => http.post(env.envURL + `/vcs/${subjectID}`, body, options),
      {
        isStatusCode202: (r) => r.status === 202,
        ...pageContentCheck('messageId')
      }))
  iterationsCompleted.add(1)
}

export function summariseVC (): void {
  let res: Response
  const summariseData = csvData[Math.floor(Math.random() * csvData.length)]
  iterationsStarted.add(1)

  res = group('R02_SummariseVC_01_GenerateTokenSummary POST', () =>
    timeRequest(() => http.post(env.envMock + '/generate',
      JSON.stringify({
        sub: summariseData.subID,
        aud: 'accountManagementAudience',
        ttl: 120
      }),
      {
        tags: { name: 'R02_SummariseVC_01_GenerateTokenSummary' }
      }),
    { isStatusCode200, ...pageContentCheck('token') }))
  const token = getToken(res)

  const options = {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': env.envApiKeySummarise
    },
    tags: { name: 'R02_SummariseVC_02_Summarise' }
  }
  res = group('R02_SummariseVC_02_Summarise GET', () =>
    timeRequest(() => http.get(env.envURL + `/summarise-vcs/${summariseData.subID}`, options),
      { isStatusCode200, ...pageContentCheck('vcs') }))
  iterationsCompleted.add(1)
}

function getToken (r: Response): string {
  const token = r.json('token')
  if (token !== null && typeof token === 'string') return token
  fail('token not found')
}
