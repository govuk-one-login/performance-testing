import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { group, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { SharedArray } from 'k6/data'
import { uuidv4 } from '../common/utils/jslib'
import { timeRequest } from '../common/utils/request/timing'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { getEnv } from '../common/utils/config/environment-variables'

const profiles: ProfileList = {
  smoke: {
    persistVC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'persistVC'
    },

    summariseVC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'summariseVC'
    }

  },
  initialLoad: {
    persistVC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 400,
      stages: [
        { target: 30, duration: '15m' }, // Ramps up to target load
        { target: 30, duration: '30m' }, // Steady State of 15 minutes at the ramp up load i.e. 30 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'persistVC'
    },

    summariseVC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 400,
      stages: [
        { target: 30, duration: '15m' }, // Ramps up to target load
        { target: 30, duration: '30m' }, // Steady State of 15 minutes at the ramp up load i.e. 30 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'summariseVC'
    }

  },
  load: {
    persistVC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1900,
      stages: [
        { target: 100, duration: '15m' }, // Ramps up to target load
        { target: 100, duration: '30m' }, // Steady State of 15 minutes at the ramp up load i.e. 100 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'persistVC'
    },

    summariseVC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 5000,
      stages: [
        { target: 1900, duration: '15m' }, // Ramps up to target load
        { target: 1900, duration: '30m' }, // Steady State of 15 minutes at the ramp up load i.e. 1900 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'summariseVC'
    }

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
    'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOkNZN1E2TDd4MEFlQWNmYUdlazY2R2FKeVhhM2R4RVhBaDRxWWtETUVzMUUiLCJuYmYiOjE2NTIwMjAxMzIsImlzcyI6Imh0dHBzOi8vZnJhdWQtY3JpLmFjY291bnQuZ292LnVrIiwidm90IjoiUDIiLCJleHAiOjE2ODM2MjgxMzIsImlhdCI6MTY1MjA5MjEzMiwidmMiOnsiZXZpZGVuY2UiOlt7ImFjdGl2aXR5SGlzdG9yeVNjb3JlIjowLCJ2YWxpZGl0eVNjb3JlIjowLCJ2ZXJpZmljYXRpb25TY29yZSI6MCwic3RyZW5ndGhTY29yZSI6MCwidHhuIjoidHhuIiwiaWRlbnRpdHlGcmF1ZFNjb3JlIjoyLCJ0eXBlIjoiSWRlbnRpdHlDaGVjayIsImNoZWNrRGV0YWlscyI6W3siY2hlY2tNZXRob2QiOiJkYXRhIiwiZnJhdWRDaGVjayI6Im1vcnRhbGl0eV9jaGVjayJ9LHsiY2hlY2tNZXRob2QiOiJkYXRhIiwiZnJhdWRDaGVjayI6ImlkZW50aXR5X3RoZWZ0X2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoic3ludGhldGljX2lkZW50aXR5X2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoiaW1wZXJzb25hdGlvbl9yaXNrX2NoZWNrIn1dLCJjaSI6WyJGMDQiXX1dLCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lIjpbeyJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV0sInZhbGlkRnJvbSI6IjIwMTktMDQtMDEifSx7InZhbGlkVW50aWwiOiIyMDI5LTA0LTAxIiwibmFtZVBhcnRzIjpbeyJ0eXBlIjoiR2l2ZW5OYW1lIiwidmFsdWUiOiJKYW5lIn0seyJ0eXBlIjoiRmFtaWx5TmFtZSIsInZhbHVlIjoiV3JpZ2h0In1dfV0sImJpcnRoRGF0ZSI6W3sidmFsdWUiOiIxOTg5LTA3LTA2In1dfSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q2hlY2tDcmVkZW50aWFsIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly92b2NhYi5sb25kb24uY2xvdWRhcHBzLmRpZ2l0YWwvY29udGV4dHMvaWRlbnRpdHktdjEuanNvbmxkIl19LCJ2dG0iOiJodHRwczovL29pZGMuYWNjb3VudC5nb3YudWsvdHJ1c3RtYXJrIn0.MEQCIGmxCN7yShXAlwU5ZMim1fjVXOWgMgWfoiHnqW-wt6FGAiAL01oZxiu6n9FKpEZQXLUdxWQ-uSFrVb9J5PejaWHFUQ', // pragma: allowlist secret
    'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOjU3YTI0Yzc5LWJmNWEtNDNiZC1iMWRmLWRhMDRhODhiYTZmZSIsIm5iZiI6MTY1MjAyMDExMCwiaXNzIjoiaHR0cHM6Ly9wYXNzcG9ydC1jcmkuYWNjb3VudC5nb3YudWsiLCJ2b3QiOiJQMiIsImV4cCI6MTY4MzYyODExMCwiaWF0IjoxNjUyMDkyMTEwLCJ2YyI6eyJldmlkZW5jZSI6W3siYWN0aXZpdHlIaXN0b3J5U2NvcmUiOjAsInZhbGlkaXR5U2NvcmUiOjAsInZlcmlmaWNhdGlvblNjb3JlIjowLCJzdHJlbmd0aFNjb3JlIjo0LCJ0eG4iOiJ0eG4iLCJpZGVudGl0eUZyYXVkU2NvcmUiOjAsInR5cGUiOiJJZGVudGl0eUNoZWNrIiwiY2hlY2tEZXRhaWxzIjpbeyJjaGVja01ldGhvZCI6ImRhdGEiLCJkYXRhQ2hlY2siOiJyZWNvcmRfY2hlY2sifV0sImZhaWxlZENoZWNrRGV0YWlscyI6W3siY2hlY2tNZXRob2QiOiJkYXRhIiwiZGF0YUNoZWNrIjoiY2FuY2VsbGVkX2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJkYXRhQ2hlY2siOiJsb3N0X3N0b2xlbl9jaGVjayJ9XX1dLCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lIjpbeyJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV0sInZhbGlkRnJvbSI6IjIwMTktMDQtMDEifSx7InZhbGlkVW50aWwiOiIyMDI5LTA0LTAxIiwibmFtZVBhcnRzIjpbeyJ0eXBlIjoiR2l2ZW5OYW1lIiwidmFsdWUiOiJKYW5lIn0seyJ0eXBlIjoiRmFtaWx5TmFtZSIsInZhbHVlIjoiV3JpZ2h0In1dfV0sImJpcnRoRGF0ZSI6W3sidmFsdWUiOiIxOTg5LTA3LTA2In1dLCJwYXNzcG9ydCI6W3siZG9jdW1lbnROdW1iZXIiOiIxMjIzNDU2NzgiLCJleHBpcnlEYXRlIjoiMjAyMi0wMi0wMiIsImljYW9Jc3N1ZXJDb2RlIjoiR0JSIn1dfSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q2hlY2tDcmVkZW50aWFsIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly92b2NhYi5sb25kb24uY2xvdWRhcHBzLmRpZ2l0YWwvY29udGV4dHMvaWRlbnRpdHktdjEuanNvbmxkIl19LCJ2dG0iOiJodHRwczovL29pZGMuYWNjb3VudC5nb3YudWsvdHJ1c3RtYXJrIn0.MEUCIQC4skxDIGh4eHyfA-5rNvLwlVIEgJVdVYaSfehI8T78SAIgJN1F52jDNY06D0RIhE_DtZT5h-zae1pBPZ3MDDtKgFI', // pragma: allowlist secret
    'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOlBWUUk3Z0VmR1o2a080X0Z4eDZjaHF0SGNobzVzcjgtazA0MUdxci1YbzQiLCJuYmYiOjE2NTIwMjAxNTMsImlzcyI6Imh0dHBzOi8va2J2LWNyaS5hY2NvdW50Lmdvdi51ayIsInZvdCI6IlAyIiwiZXhwIjoxNjgzNjI4MTUzLCJpYXQiOjE2NTIwOTIxNTMsInZjIjp7ImV2aWRlbmNlIjpbeyJhY3Rpdml0eUhpc3RvcnlTY29yZSI6MCwidmFsaWRpdHlTY29yZSI6MCwidmVyaWZpY2F0aW9uU2NvcmUiOjIsInN0cmVuZ3RoU2NvcmUiOjAsInR4biI6InR4biIsImlkZW50aXR5RnJhdWRTY29yZSI6MCwidHlwZSI6IklkZW50aXR5Q2hlY2sifV0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOlt7Im5hbWVQYXJ0cyI6W3sidHlwZSI6IkdpdmVuTmFtZSIsInZhbHVlIjoiSmFuZSJ9LHsidHlwZSI6IkZhbWlseU5hbWUiLCJ2YWx1ZSI6IldyaWdodCJ9XSwidmFsaWRGcm9tIjoiMjAxOS0wNC0wMSJ9LHsidmFsaWRVbnRpbCI6IjIwMjktMDQtMDEiLCJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV19XSwiYmlydGhEYXRlIjpbeyJ2YWx1ZSI6IjE5ODktMDctMDYifV19LCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiSWRlbnRpdHlDaGVja0NyZWRlbnRpYWwiXSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3ZvY2FiLmxvbmRvbi5jbG91ZGFwcHMuZGlnaXRhbC9jb250ZXh0cy9pZGVudGl0eS12MS5qc29ubGQiXX0sInZ0bSI6Imh0dHBzOi8vb2lkYy5hY2NvdW50Lmdvdi51ay90cnVzdG1hcmsifQ.MEUCIQC8U5VKnsYhlt35vMCaaBLws_3WqfDHMnCnRJIdJ7v_zQIgMdsi_B2UEsD7P_QwLsG7owv4eI_AV5oTpjtmZCeKhs8' // pragma: allowlist secret
  ])
  res = group('R01_PersistVC_02_CreateVC POST', () =>
    timeRequest(() => http.post(env.envURL + `/vcs/${subjectID}`, body, options),
      {
        isStatusCode202: (r) => r.status === 202,
        ...pageContentCheck('messageId')
      }))
  iterationsCompleted.add(1)
  console.log(subjectID)
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
