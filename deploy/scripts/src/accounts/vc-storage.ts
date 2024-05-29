import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { fail, sleep } from 'k6'
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
    ...createScenario('summariseVC', LoadProfile.smoke),
    ...createScenario('updateVC', LoadProfile.smoke)
  },
  initialLoad: {
    ...createScenario('persistVC', LoadProfile.full, 30, 15),
    ...createScenario('summariseVC', LoadProfile.full, 30, 15),
    ...createScenario('updateVC', LoadProfile.full, 30, 15)
  },
  load: {
    ...createScenario('persistVC', LoadProfile.full, 100, 15),
    ...createScenario('summariseVC', LoadProfile.full, 1900, 3),
    ...createScenario('updateVC', LoadProfile.full, 100, 15)
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
  summariseVC: ['R02_SummariseVC_01_GenerateTokenSummary', 'R02_SummariseVC_02_Summarise'],
  updateVC: ['R03_UpdateVC_01_CreateVC', 'R03_UpdateVC_02_UpdateVC']
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
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOkNZN1E2TDd4MEFlQWNmYUdlazY2R2FKeVhhM2R4RVhBaDRxWWtETUVzMUUiLCJuYmYiOjE2NTIwMjAxMzIsImlzcyI6Imh0dHBzOi8vZnJhdWQtY3JpLmFjY291bnQuZ292LnVrIiwidm90IjoiUDIiLCJleHAiOjE2ODM2MjgxMzIsImlhdCI6MTY1MjA5MjEzMiwidmMiOnsiZXZpZGVuY2UiOlt7ImFjdGl2aXR5SGlzdG9yeVNjb3JlIjowLCJ2YWxpZGl0eVNjb3JlIjowLCJ2ZXJpZmljYXRpb25TY29yZSI6MCwic3RyZW5ndGhTY29yZSI6MCwidHhuIjoidHhuIiwiaWRlbnRpdHlGcmF1ZFNjb3JlIjoyLCJ0eXBlIjoiSWRlbnRpdHlDaGVjayIsImNoZWNrRGV0YWlscyI6W3siY2hlY2tNZXRob2QiOiJkYXRhIiwiZnJhdWRDaGVjayI6Im1vcnRhbGl0eV9jaGVjayJ9LHsiY2hlY2tNZXRob2QiOiJkYXRhIiwiZnJhdWRDaGVjayI6ImlkZW50aXR5X3RoZWZ0X2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoic3ludGhldGljX2lkZW50aXR5X2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoiaW1wZXJzb25hdGlvbl9yaXNrX2NoZWNrIn1dLCJjaSI6WyJGMDQiXX1dLCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lIjpbeyJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV0sInZhbGlkRnJvbSI6IjIwMTktMDQtMDEifSx7InZhbGlkVW50aWwiOiIyMDI5LTA0LTAxIiwibmFtZVBhcnRzIjpbeyJ0eXBlIjoiR2l2ZW5OYW1lIiwidmFsdWUiOiJKYW5lIn0seyJ0eXBlIjoiRmFtaWx5TmFtZSIsInZhbHVlIjoiV3JpZ2h0In1dfV0sImJpcnRoRGF0ZSI6W3sidmFsdWUiOiIxOTg5LTA3LTA2In1dfSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q2hlY2tDcmVkZW50aWFsIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly92b2NhYi5sb25kb24uY2xvdWRhcHBzLmRpZ2l0YWwvY29udGV4dHMvaWRlbnRpdHktdjEuanNvbmxkIl19LCJ2dG0iOiJodHRwczovL29pZGMuYWNjb3VudC5nb3YudWsvdHJ1c3RtYXJrIn0.MEQCIGmxCN7yShXAlwU5ZMim1fjVXOWgMgWfoiHnqW-wt6FGAiAL01oZxiu6n9FKpEZQXLUdxWQ-uSFrVb9J5PejaWHFUQ', // pragma: allowlist secret
    passport:
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOjU3YTI0Yzc5LWJmNWEtNDNiZC1iMWRmLWRhMDRhODhiYTZmZSIsIm5iZiI6MTY1MjAyMDExMCwiaXNzIjoiaHR0cHM6Ly9wYXNzcG9ydC1jcmkuYWNjb3VudC5nb3YudWsiLCJ2b3QiOiJQMiIsImV4cCI6MTY4MzYyODExMCwiaWF0IjoxNjUyMDkyMTEwLCJ2YyI6eyJldmlkZW5jZSI6W3siYWN0aXZpdHlIaXN0b3J5U2NvcmUiOjAsInZhbGlkaXR5U2NvcmUiOjAsInZlcmlmaWNhdGlvblNjb3JlIjowLCJzdHJlbmd0aFNjb3JlIjo0LCJ0eG4iOiJ0eG4iLCJpZGVudGl0eUZyYXVkU2NvcmUiOjAsInR5cGUiOiJJZGVudGl0eUNoZWNrIiwiY2hlY2tEZXRhaWxzIjpbeyJjaGVja01ldGhvZCI6ImRhdGEiLCJkYXRhQ2hlY2siOiJyZWNvcmRfY2hlY2sifV0sImZhaWxlZENoZWNrRGV0YWlscyI6W3siY2hlY2tNZXRob2QiOiJkYXRhIiwiZGF0YUNoZWNrIjoiY2FuY2VsbGVkX2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJkYXRhQ2hlY2siOiJsb3N0X3N0b2xlbl9jaGVjayJ9XX1dLCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lIjpbeyJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV0sInZhbGlkRnJvbSI6IjIwMTktMDQtMDEifSx7InZhbGlkVW50aWwiOiIyMDI5LTA0LTAxIiwibmFtZVBhcnRzIjpbeyJ0eXBlIjoiR2l2ZW5OYW1lIiwidmFsdWUiOiJKYW5lIn0seyJ0eXBlIjoiRmFtaWx5TmFtZSIsInZhbHVlIjoiV3JpZ2h0In1dfV0sImJpcnRoRGF0ZSI6W3sidmFsdWUiOiIxOTg5LTA3LTA2In1dLCJwYXNzcG9ydCI6W3siZG9jdW1lbnROdW1iZXIiOiIxMjIzNDU2NzgiLCJleHBpcnlEYXRlIjoiMjAyMi0wMi0wMiIsImljYW9Jc3N1ZXJDb2RlIjoiR0JSIn1dfSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q2hlY2tDcmVkZW50aWFsIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly92b2NhYi5sb25kb24uY2xvdWRhcHBzLmRpZ2l0YWwvY29udGV4dHMvaWRlbnRpdHktdjEuanNvbmxkIl19LCJ2dG0iOiJodHRwczovL29pZGMuYWNjb3VudC5nb3YudWsvdHJ1c3RtYXJrIn0.MEUCIQC4skxDIGh4eHyfA-5rNvLwlVIEgJVdVYaSfehI8T78SAIgJN1F52jDNY06D0RIhE_DtZT5h-zae1pBPZ3MDDtKgFI', // pragma: allowlist secret
    kbv: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOlBWUUk3Z0VmR1o2a080X0Z4eDZjaHF0SGNobzVzcjgtazA0MUdxci1YbzQiLCJuYmYiOjE2NTIwMjAxNTMsImlzcyI6Imh0dHBzOi8va2J2LWNyaS5hY2NvdW50Lmdvdi51ayIsInZvdCI6IlAyIiwiZXhwIjoxNjgzNjI4MTUzLCJpYXQiOjE2NTIwOTIxNTMsInZjIjp7ImV2aWRlbmNlIjpbeyJhY3Rpdml0eUhpc3RvcnlTY29yZSI6MCwidmFsaWRpdHlTY29yZSI6MCwidmVyaWZpY2F0aW9uU2NvcmUiOjIsInN0cmVuZ3RoU2NvcmUiOjAsInR4biI6InR4biIsImlkZW50aXR5RnJhdWRTY29yZSI6MCwidHlwZSI6IklkZW50aXR5Q2hlY2sifV0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOlt7Im5hbWVQYXJ0cyI6W3sidHlwZSI6IkdpdmVuTmFtZSIsInZhbHVlIjoiSmFuZSJ9LHsidHlwZSI6IkZhbWlseU5hbWUiLCJ2YWx1ZSI6IldyaWdodCJ9XSwidmFsaWRGcm9tIjoiMjAxOS0wNC0wMSJ9LHsidmFsaWRVbnRpbCI6IjIwMjktMDQtMDEiLCJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV19XSwiYmlydGhEYXRlIjpbeyJ2YWx1ZSI6IjE5ODktMDctMDYifV19LCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiSWRlbnRpdHlDaGVja0NyZWRlbnRpYWwiXSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3ZvY2FiLmxvbmRvbi5jbG91ZGFwcHMuZGlnaXRhbC9jb250ZXh0cy9pZGVudGl0eS12MS5qc29ubGQiXX0sInZ0bSI6Imh0dHBzOi8vb2lkYy5hY2NvdW50Lmdvdi51ay90cnVzdG1hcmsifQ.MEUCIQC8U5VKnsYhlt35vMCaaBLws_3WqfDHMnCnRJIdJ7v_zQIgMdsi_B2UEsD7P_QwLsG7owv4eI_AV5oTpjtmZCeKhs8' // pragma: allowlist secret
  }

  const body = JSON.stringify([
    generateCreateVCPayload(jwtTokens.fraud, 'PENDING'),
    generateCreateVCPayload(jwtTokens.passport, 'PENDING'),
    generateCreateVCPayload(jwtTokens.kbv, 'PENDING')
  ])

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
  const jwtTokens = {
    fraud:
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOkNZN1E2TDd4MEFlQWNmYUdlazY2R2FKeVhhM2R4RVhBaDRxWWtETUVzMUUiLCJuYmYiOjE2NTIwMjAxMzIsImlzcyI6Imh0dHBzOi8vZnJhdWQtY3JpLmFjY291bnQuZ292LnVrIiwidm90IjoiUDIiLCJleHAiOjE2ODM2MjgxMzIsImlhdCI6MTY1MjA5MjEzMiwidmMiOnsiZXZpZGVuY2UiOlt7ImFjdGl2aXR5SGlzdG9yeVNjb3JlIjowLCJ2YWxpZGl0eVNjb3JlIjowLCJ2ZXJpZmljYXRpb25TY29yZSI6MCwic3RyZW5ndGhTY29yZSI6MCwidHhuIjoidHhuIiwiaWRlbnRpdHlGcmF1ZFNjb3JlIjoyLCJ0eXBlIjoiSWRlbnRpdHlDaGVjayIsImNoZWNrRGV0YWlscyI6W3siY2hlY2tNZXRob2QiOiJkYXRhIiwiZnJhdWRDaGVjayI6Im1vcnRhbGl0eV9jaGVjayJ9LHsiY2hlY2tNZXRob2QiOiJkYXRhIiwiZnJhdWRDaGVjayI6ImlkZW50aXR5X3RoZWZ0X2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoic3ludGhldGljX2lkZW50aXR5X2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoiaW1wZXJzb25hdGlvbl9yaXNrX2NoZWNrIn1dLCJjaSI6WyJGMDQiXX1dLCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lIjpbeyJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV0sInZhbGlkRnJvbSI6IjIwMTktMDQtMDEifSx7InZhbGlkVW50aWwiOiIyMDI5LTA0LTAxIiwibmFtZVBhcnRzIjpbeyJ0eXBlIjoiR2l2ZW5OYW1lIiwidmFsdWUiOiJKYW5lIn0seyJ0eXBlIjoiRmFtaWx5TmFtZSIsInZhbHVlIjoiV3JpZ2h0In1dfV0sImJpcnRoRGF0ZSI6W3sidmFsdWUiOiIxOTg5LTA3LTA2In1dfSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q2hlY2tDcmVkZW50aWFsIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly92b2NhYi5sb25kb24uY2xvdWRhcHBzLmRpZ2l0YWwvY29udGV4dHMvaWRlbnRpdHktdjEuanNvbmxkIl19LCJ2dG0iOiJodHRwczovL29pZGMuYWNjb3VudC5nb3YudWsvdHJ1c3RtYXJrIn0.MEQCIGmxCN7yShXAlwU5ZMim1fjVXOWgMgWfoiHnqW-wt6FGAiAL01oZxiu6n9FKpEZQXLUdxWQ-uSFrVb9J5PejaWHFUQ', // pragma: allowlist secret
    passport:
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOjU3YTI0Yzc5LWJmNWEtNDNiZC1iMWRmLWRhMDRhODhiYTZmZSIsIm5iZiI6MTY1MjAyMDExMCwiaXNzIjoiaHR0cHM6Ly9wYXNzcG9ydC1jcmkuYWNjb3VudC5nb3YudWsiLCJ2b3QiOiJQMiIsImV4cCI6MTY4MzYyODExMCwiaWF0IjoxNjUyMDkyMTEwLCJ2YyI6eyJldmlkZW5jZSI6W3siYWN0aXZpdHlIaXN0b3J5U2NvcmUiOjAsInZhbGlkaXR5U2NvcmUiOjAsInZlcmlmaWNhdGlvblNjb3JlIjowLCJzdHJlbmd0aFNjb3JlIjo0LCJ0eG4iOiJ0eG4iLCJpZGVudGl0eUZyYXVkU2NvcmUiOjAsInR5cGUiOiJJZGVudGl0eUNoZWNrIiwiY2hlY2tEZXRhaWxzIjpbeyJjaGVja01ldGhvZCI6ImRhdGEiLCJkYXRhQ2hlY2siOiJyZWNvcmRfY2hlY2sifV0sImZhaWxlZENoZWNrRGV0YWlscyI6W3siY2hlY2tNZXRob2QiOiJkYXRhIiwiZGF0YUNoZWNrIjoiY2FuY2VsbGVkX2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJkYXRhQ2hlY2siOiJsb3N0X3N0b2xlbl9jaGVjayJ9XX1dLCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lIjpbeyJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV0sInZhbGlkRnJvbSI6IjIwMTktMDQtMDEifSx7InZhbGlkVW50aWwiOiIyMDI5LTA0LTAxIiwibmFtZVBhcnRzIjpbeyJ0eXBlIjoiR2l2ZW5OYW1lIiwidmFsdWUiOiJKYW5lIn0seyJ0eXBlIjoiRmFtaWx5TmFtZSIsInZhbHVlIjoiV3JpZ2h0In1dfV0sImJpcnRoRGF0ZSI6W3sidmFsdWUiOiIxOTg5LTA3LTA2In1dLCJwYXNzcG9ydCI6W3siZG9jdW1lbnROdW1iZXIiOiIxMjIzNDU2NzgiLCJleHBpcnlEYXRlIjoiMjAyMi0wMi0wMiIsImljYW9Jc3N1ZXJDb2RlIjoiR0JSIn1dfSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q2hlY2tDcmVkZW50aWFsIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly92b2NhYi5sb25kb24uY2xvdWRhcHBzLmRpZ2l0YWwvY29udGV4dHMvaWRlbnRpdHktdjEuanNvbmxkIl19LCJ2dG0iOiJodHRwczovL29pZGMuYWNjb3VudC5nb3YudWsvdHJ1c3RtYXJrIn0.MEUCIQC4skxDIGh4eHyfA-5rNvLwlVIEgJVdVYaSfehI8T78SAIgJN1F52jDNY06D0RIhE_DtZT5h-zae1pBPZ3MDDtKgFI', // pragma: allowlist secret
    kbv: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOlBWUUk3Z0VmR1o2a080X0Z4eDZjaHF0SGNobzVzcjgtazA0MUdxci1YbzQiLCJuYmYiOjE2NTIwMjAxNTMsImlzcyI6Imh0dHBzOi8va2J2LWNyaS5hY2NvdW50Lmdvdi51ayIsInZvdCI6IlAyIiwiZXhwIjoxNjgzNjI4MTUzLCJpYXQiOjE2NTIwOTIxNTMsInZjIjp7ImV2aWRlbmNlIjpbeyJhY3Rpdml0eUhpc3RvcnlTY29yZSI6MCwidmFsaWRpdHlTY29yZSI6MCwidmVyaWZpY2F0aW9uU2NvcmUiOjIsInN0cmVuZ3RoU2NvcmUiOjAsInR4biI6InR4biIsImlkZW50aXR5RnJhdWRTY29yZSI6MCwidHlwZSI6IklkZW50aXR5Q2hlY2sifV0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOlt7Im5hbWVQYXJ0cyI6W3sidHlwZSI6IkdpdmVuTmFtZSIsInZhbHVlIjoiSmFuZSJ9LHsidHlwZSI6IkZhbWlseU5hbWUiLCJ2YWx1ZSI6IldyaWdodCJ9XSwidmFsaWRGcm9tIjoiMjAxOS0wNC0wMSJ9LHsidmFsaWRVbnRpbCI6IjIwMjktMDQtMDEiLCJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV19XSwiYmlydGhEYXRlIjpbeyJ2YWx1ZSI6IjE5ODktMDctMDYifV19LCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiSWRlbnRpdHlDaGVja0NyZWRlbnRpYWwiXSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3ZvY2FiLmxvbmRvbi5jbG91ZGFwcHMuZGlnaXRhbC9jb250ZXh0cy9pZGVudGl0eS12MS5qc29ubGQiXX0sInZ0bSI6Imh0dHBzOi8vb2lkYy5hY2NvdW50Lmdvdi51ay90cnVzdG1hcmsifQ.MEUCIQC8U5VKnsYhlt35vMCaaBLws_3WqfDHMnCnRJIdJ7v_zQIgMdsi_B2UEsD7P_QwLsG7owv4eI_AV5oTpjtmZCeKhs8' // pragma: allowlist secret
  }

  body = JSON.stringify([
    generateCreateVCPayload(jwtTokens.fraud, 'PENDING'),
    generateCreateVCPayload(jwtTokens.passport, 'PENDING'),
    generateCreateVCPayload(jwtTokens.kbv, 'PENDING')
  ])

  timeGroup(groups[0], () => http.post(env.envURL + `/vcs/${subjectID}`, body, options), {
    isStatusCode202: r => r.status === 202,
    ...pageContentCheck('messageId')
  })

  sleep(1)

  const jwtSignatures = {
    fraud: 'MEQCIGmxCN7yShXAlwU5ZMim1fjVXOWgMgWfoiHnqW-wt6FGAiAL01oZxiu6n9FKpEZQXLUdxWQ-uSFrVb9J5PejaWHFUQ', // pragma: allowlist secret
    passport: 'MEUCIQC4skxDIGh4eHyfA-5rNvLwlVIEgJVdVYaSfehI8T78SAIgJN1F52jDNY06D0RIhE_DtZT5h-zae1pBPZ3MDDtKgFI', // pragma: allowlist secret
    kbv: 'MEUCIQC8U5VKnsYhlt35vMCaaBLws_3WqfDHMnCnRJIdJ7v_zQIgMdsi_B2UEsD7P_QwLsG7owv4eI_AV5oTpjtmZCeKhs8' // pragma: allowlist secret
  }

  body = JSON.stringify([
    generateUpdateVCPayload(jwtSignatures.fraud, 'CURRENT'),
    generateUpdateVCPayload(jwtSignatures.passport, 'CURRENT'),
    generateUpdateVCPayload(jwtSignatures.kbv, 'CURRENT')
  ])

  timeGroup(groups[1], () => http.patch(env.envURL + `/vcs/${subjectID}`, body, options), {
    isStatusCode202: r => r.status === 204,
    ...pageContentCheck('messageId')
  })

  iterationsCompleted.add(1)
}

function getToken(r: Response): string {
  const token = r.json('token')
  if (token !== null && typeof token === 'string') return token
  fail('token not found')
}

interface CreateVCPayload {
  vc: string
  state: string
  provenance: string
}

function generateCreateVCPayload(vcJWT: string, vcState: string): CreateVCPayload {
  return {
    vc: vcJWT,
    state: vcState,
    provenance: 'ONLINE'
  }
}

interface UpdateVCPayload {
  signature: string
  state: string
}

function generateUpdateVCPayload(vcSign: string, vcState: string): UpdateVCPayload {
  return {
    signature: vcSign,
    state: vcState
  }
}
