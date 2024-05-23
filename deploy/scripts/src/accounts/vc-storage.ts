import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { SharedArray } from 'k6/data'
import { uuidv4 } from '../common/utils/jslib'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

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
const groupMap = {
  persistVC: ['R01_PersistVC_01_CreateVC'],
  summariseVC: ['R02_SummariseVC_01_GenerateTokenSummary', 'R02_SummariseVC_02_Summarise']
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
  return open('./data/summariseSubjectID.csv')
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
  envApiKeySummarise: getEnv('ACCOUNT_BRAVO_ID_REUSE_API_KEY_SUMMARISE')
}
export function persistVC(): void {
  const groups = groupMap.persistVC
  const userID = uuidv4()
  const subjectID = `urn:fdc:gov.uk:2022:${userID}`
  iterationsStarted.add(1)
  const options = {
    headers: {
      'x-api-key': env.envApiKey
    }
  }
  const jwtTokens = {
    fraud:
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOkNZN1E2TDd4MEFlQWNmYUdlazY2R2FKeVhhM2R4RVhBaDRxWWtETUVzMUUiLCJuYmYiOjE2NTIwMjAxMzIsImlzcyI6Imh0dHBzOi8vZnJhdWQtY3JpLmFjY291bnQuZ292LnVrIiwidm90IjoiUDIiLCJleHAiOjE2ODM2MjgxMzIsImlhdCI6MTY1MjA5MjEzMiwidmMiOnsiZXZpZGVuY2UiOlt7ImFjdGl2aXR5SGlzdG9yeVNjb3JlIjowLCJ2YWxpZGl0eVNjb3JlIjowLCJ2ZXJpZmljYXRpb25TY29yZSI6MCwic3RyZW5ndGhTY29yZSI6MCwidHhuIjoidHhuIiwiaWRlbnRpdHlGcmF1ZFNjb3JlIjoyLCJ0eXBlIjoiSWRlbnRpdHlDaGVjayIsImNoZWNrRGV0YWlscyI6W3siY2hlY2tNZXRob2QiOiJkYXRhIiwiZnJhdWRDaGVjayI6Im1vcnRhbGl0eV9jaGVjayJ9LHsiY2hlY2tNZXRob2QiOiJkYXRhIiwiZnJhdWRDaGVjayI6ImlkZW50aXR5X3RoZWZ0X2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoic3ludGhldGljX2lkZW50aXR5X2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoiaW1wZXJzb25hdGlvbl9yaXNrX2NoZWNrIn1dLCJjaSI6WyJGMDQiXX1dLCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lIjpbeyJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV0sInZhbGlkRnJvbSI6IjIwMTktMDQtMDEifSx7InZhbGlkVW50aWwiOiIyMDI5LTA0LTAxIiwibmFtZVBhcnRzIjpbeyJ0eXBlIjoiR2l2ZW5OYW1lIiwidmFsdWUiOiJKYW5lIn0seyJ0eXBlIjoiRmFtaWx5TmFtZSIsInZhbHVlIjoiV3JpZ2h0In1dfV0sImJpcnRoRGF0ZSI6W3sidmFsdWUiOiIxOTg5LTA3LTA2In1dfSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q2hlY2tDcmVkZW50aWFsIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly92b2NhYi5sb25kb24uY2xvdWRhcHBzLmRpZ2l0YWwvY29udGV4dHMvaWRlbnRpdHktdjEuanNvbmxkIl19LCJ2dG0iOiJodHRwczovL29pZGMuYWNjb3VudC5nb3YudWsvdHJ1c3RtYXJrIn0.MEQCIGmxCN7yShXAlwU5ZMim1fjVXOWgMgWfoiHnqW-wt6FGAiAL01oZxiu6n9FKpEZQXLUdxWQ-uSFrVb9J5PejaWHFUQ' // pragma: allowlist secret
  }

  const body = JSON.stringify(generateVCPayload(jwtTokens.fraud))

  // R01_PersistVC_01_CreateVC
  timeGroup(groups[0], () => http.post(env.envURL + `/vcs/${subjectID}`, body, options), {
    isStatusCode202: r => r.status === 202,
    ...pageContentCheck('messageId')
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
    () =>
      http.post(
        env.envMock + '/generate',
        JSON.stringify({
          sub: summariseData.subID,
          aud: 'accountManagementAudience',
          ttl: 120
        })
      ),
    { isStatusCode200, ...pageContentCheck('token') }
  )
  const token = getToken(res)

  const options = {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': env.envApiKeySummarise
    }
  }
  // R02_SummariseVC_02_Summarise
  timeGroup(groups[1], () => http.get(env.envURL + `/summarise-vcs/${summariseData.subID}`, options), {
    isStatusCode200,
    ...pageContentCheck('vcs')
  })
  iterationsCompleted.add(1)
}

function getToken(r: Response): string {
  const token = r.json('token')
  if (token !== null && typeof token === 'string') return token
  fail('token not found')
}

interface VCPayload {
  vc: string
  state: string
  metadata: {
    reason: string
    timestampMs: number
    txmaEventId: string
  }
  provenance: string
}

function generateVCPayload(vcJWT: string): VCPayload {
  return {
    vc: vcJWT,
    state: 'PENDING',
    metadata: {
      reason: 'pending verification',
      timestampMs: Math.floor(Date.now()),
      txmaEventId: uuidv4()
    },
    provenance: 'ONLINE'
  }
}
