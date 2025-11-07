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
  createI3SpikeSignUpScenario,
  createI3SpikeSignInScenario,
  createI4PeakTestSignUpScenario,
  createI4PeakTestSignInScenario
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
  },
  spikeI2HighTraffic: {
    ...createScenario('persistVC', LoadProfile.spikeI2HighTraffic, 35, 16),
    ...createScenario('updateVC', LoadProfile.spikeI2HighTraffic, 35, 16),
    ...createScenario('summariseVC', LoadProfile.spikeI2HighTraffic, 32, 15)
  },
  perf006Iteration2PeakTest: {
    persistVC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 30,
      maxVUs: 36,
      stages: [
        { target: 120, duration: '121s' },
        { target: 120, duration: '30m' }
      ],
      exec: 'persistVC'
    },
    updateVC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 30,
      maxVUs: 36,
      stages: [
        { target: 120, duration: '121s' },
        { target: 120, duration: '30m' }
      ],
      exec: 'updateVC'
    },
    summariseVC: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 66,
      stages: [
        { target: 11, duration: '6s' },
        { target: 11, duration: '30m' }
      ],
      exec: 'summariseVC'
    }
  },
  perf006Iteration3PeakTest: {
    persistVC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 30,
      maxVUs: 48,
      stages: [
        { target: 160, duration: '161s' },
        { target: 160, duration: '30m' }
      ],
      exec: 'persistVC'
    },
    updateVC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 30,
      maxVUs: 96,
      stages: [
        { target: 160, duration: '161s' },
        { target: 160, duration: '30m' }
      ],
      exec: 'updateVC'
    },
    summariseVC: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 144,
      stages: [
        { target: 24, duration: '12s' },
        { target: 24, duration: '30m' }
      ],
      exec: 'summariseVC'
    }
  },
  perf006Iteration3SpikeTest: {
    ...createI3SpikeSignUpScenario('persistVC', 490, 5, 491),
    ...createI3SpikeSignUpScenario('updateVC', 490, 7, 491),
    ...createI3SpikeSignInScenario('summariseVC', 71, 6, 33)
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('persistVC', 470, 5, 471),
    ...createI4PeakTestSignUpScenario('updateVC', 470, 7, 471),
    ...createI4PeakTestSignInScenario('summariseVC', 43, 6, 21)
  },
  perf006Iteration4SpikeTest: {
    ...createI3SpikeSignUpScenario('persistVC', 1130, 5, 1131),
    ...createI3SpikeSignUpScenario('updateVC', 1130, 7, 1131),
    ...createI3SpikeSignInScenario('summariseVC', 129, 6, 60)
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignUpScenario('updateVC', 570, 7, 571),
    ...createI4PeakTestSignInScenario('summariseVC', 65, 6, 30)
  },
  perf006Iteration5SpikeTest: {
    ...createI3SpikeSignUpScenario('updateVC', 1130, 7, 1131),
    ...createI3SpikeSignInScenario('summariseVC', 162, 6, 74)
  },
  perf006Iteration6PeakTest: {
    ...createI4PeakTestSignUpScenario('updateVC', 920, 7, 921),
    ...createI4PeakTestSignInScenario('summariseVC', 104, 6, 48)
  },
  perf006Iteration6SpikeTest: {
    ...createI3SpikeSignUpScenario('updateVC', 570, 7, 571),
    ...createI3SpikeSignInScenario('summariseVC', 260, 6, 119)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('updateVC', 180, 7, 181),
    ...createI4PeakTestSignInScenario('summariseVC', 71, 6, 33)
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
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOkNZN1E2TDd4MEFlQWNmYUdlazY2R2FKeVhhM2R4RVhBaDRxWWtETUVzMUUiLCJuYmYiOjE2NTIwMjAxMzIsImlzcyI6Imh0dHBzOi8vcmV2aWV3LWYuYWNjb3VudC5nb3YudWsiLCJ2b3QiOiJQMiIsImV4cCI6MTY4MzYyODEzMiwiaWF0IjoxNjUyMDkyMTMyLCJ2YyI6eyJldmlkZW5jZSI6W3siYWN0aXZpdHlIaXN0b3J5U2NvcmUiOjAsInZhbGlkaXR5U2NvcmUiOjAsInZlcmlmaWNhdGlvblNjb3JlIjowLCJzdHJlbmd0aFNjb3JlIjowLCJ0eG4iOiJ0eG4iLCJpZGVudGl0eUZyYXVkU2NvcmUiOjIsInR5cGUiOiJJZGVudGl0eUNoZWNrIiwiY2hlY2tEZXRhaWxzIjpbeyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoibW9ydGFsaXR5X2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoiaWRlbnRpdHlfdGhlZnRfY2hlY2sifSx7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImZyYXVkQ2hlY2siOiJzeW50aGV0aWNfaWRlbnRpdHlfY2hlY2sifSx7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImZyYXVkQ2hlY2siOiJpbXBlcnNvbmF0aW9uX3Jpc2tfY2hlY2sifV0sImNpIjpbIkYwNCJdfV0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOlt7Im5hbWVQYXJ0cyI6W3sidHlwZSI6IkdpdmVuTmFtZSIsInZhbHVlIjoiSmFuZSJ9LHsidHlwZSI6IkZhbWlseU5hbWUiLCJ2YWx1ZSI6IldyaWdodCJ9XSwidmFsaWRGcm9tIjoiMjAxOS0wNC0wMSJ9LHsidmFsaWRVbnRpbCI6IjIwMjktMDQtMDEiLCJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV19XSwiYmlydGhEYXRlIjpbeyJ2YWx1ZSI6IjE5ODktMDctMDYifV19LCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiSWRlbnRpdHlDaGVja0NyZWRlbnRpYWwiXSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3ZvY2FiLmxvbmRvbi5jbG91ZGFwcHMuZGlnaXRhbC9jb250ZXh0cy9pZGVudGl0eS12MS5qc29ubGQiXX0sInZ0bSI6Imh0dHBzOi8vb2lkYy5hY2NvdW50Lmdvdi51ay90cnVzdG1hcmsifQ.MEQCIHy50XHTu2s0SAtsXs02d4VxUZta5rDuK0KTtv6Ya3oXAiBceSvuMd0n5uddq5QnD0cuvGwk26Oe_i3inH_i5azt6g', // pragma: allowlist secret
    passport:
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOjU3YTI0Yzc5LWJmNWEtNDNiZC1iMWRmLWRhMDRhODhiYTZmZSIsIm5iZiI6MTY1MjAyMDExMCwiaXNzIjoiaHR0cHM6Ly9yZXZpZXctcC5hY2NvdW50Lmdvdi51ayIsInZvdCI6IlAyIiwiZXhwIjoxNjgzNjI4MTEwLCJpYXQiOjE2NTIwOTIxMTAsInZjIjp7ImV2aWRlbmNlIjpbeyJhY3Rpdml0eUhpc3RvcnlTY29yZSI6MCwidmFsaWRpdHlTY29yZSI6MCwidmVyaWZpY2F0aW9uU2NvcmUiOjAsInN0cmVuZ3RoU2NvcmUiOjQsInR4biI6InR4biIsImlkZW50aXR5RnJhdWRTY29yZSI6MCwidHlwZSI6IklkZW50aXR5Q2hlY2siLCJjaGVja0RldGFpbHMiOlt7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImRhdGFDaGVjayI6InJlY29yZF9jaGVjayJ9XSwiZmFpbGVkQ2hlY2tEZXRhaWxzIjpbeyJjaGVja01ldGhvZCI6ImRhdGEiLCJkYXRhQ2hlY2siOiJjYW5jZWxsZWRfY2hlY2sifSx7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImRhdGFDaGVjayI6Imxvc3Rfc3RvbGVuX2NoZWNrIn1dfV0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOlt7Im5hbWVQYXJ0cyI6W3sidHlwZSI6IkdpdmVuTmFtZSIsInZhbHVlIjoiSmFuZSJ9LHsidHlwZSI6IkZhbWlseU5hbWUiLCJ2YWx1ZSI6IldyaWdodCJ9XSwidmFsaWRGcm9tIjoiMjAxOS0wNC0wMSJ9LHsidmFsaWRVbnRpbCI6IjIwMjktMDQtMDEiLCJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV19XSwiYmlydGhEYXRlIjpbeyJ2YWx1ZSI6IjE5ODktMDctMDYifV0sInBhc3Nwb3J0IjpbeyJkb2N1bWVudE51bWJlciI6IjEyMjM0NTY3OCIsImV4cGlyeURhdGUiOiIyMDIyLTAyLTAyIiwiaWNhb0lzc3VlckNvZGUiOiJHQlIifV19LCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiSWRlbnRpdHlDaGVja0NyZWRlbnRpYWwiXSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3ZvY2FiLmxvbmRvbi5jbG91ZGFwcHMuZGlnaXRhbC9jb250ZXh0cy9pZGVudGl0eS12MS5qc29ubGQiXX0sInZ0bSI6Imh0dHBzOi8vb2lkYy5hY2NvdW50Lmdvdi51ay90cnVzdG1hcmsifQ.MEUCIQD3sJmXxyxkcl75_KDhTiytQuywwof7VgGOU9CO3AyikwIgELjpM4zfobUiReVasOM8rVHhB-lOXFoTGOfjBdeTLJs', // pragma: allowlist secret
    kbv: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOlBWUUk3Z0VmR1o2a080X0Z4eDZjaHF0SGNobzVzcjgtazA0MUdxci1YbzQiLCJuYmYiOjE2NTIwMjAxNTMsImlzcyI6Imh0dHBzOi8vcmV2aWV3LWsuYWNjb3VudC5nb3YudWsiLCJ2b3QiOiJQMiIsImV4cCI6MTY4MzYyODE1MywiaWF0IjoxNjUyMDkyMTUzLCJ2YyI6eyJldmlkZW5jZSI6W3siYWN0aXZpdHlIaXN0b3J5U2NvcmUiOjAsInZhbGlkaXR5U2NvcmUiOjAsInZlcmlmaWNhdGlvblNjb3JlIjoyLCJzdHJlbmd0aFNjb3JlIjowLCJ0eG4iOiJ0eG4iLCJpZGVudGl0eUZyYXVkU2NvcmUiOjAsInR5cGUiOiJJZGVudGl0eUNoZWNrIn1dLCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lIjpbeyJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV0sInZhbGlkRnJvbSI6IjIwMTktMDQtMDEifSx7InZhbGlkVW50aWwiOiIyMDI5LTA0LTAxIiwibmFtZVBhcnRzIjpbeyJ0eXBlIjoiR2l2ZW5OYW1lIiwidmFsdWUiOiJKYW5lIn0seyJ0eXBlIjoiRmFtaWx5TmFtZSIsInZhbHVlIjoiV3JpZ2h0In1dfV0sImJpcnRoRGF0ZSI6W3sidmFsdWUiOiIxOTg5LTA3LTA2In1dfSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q2hlY2tDcmVkZW50aWFsIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly92b2NhYi5sb25kb24uY2xvdWRhcHBzLmRpZ2l0YWwvY29udGV4dHMvaWRlbnRpdHktdjEuanNvbmxkIl19LCJ2dG0iOiJodHRwczovL29pZGMuYWNjb3VudC5nb3YudWsvdHJ1c3RtYXJrIn0.MEUCIDb_M_4HbcIce_Vep0Mb-OKjRtTdYi0mM4JVEgVlDKZcAiEAwAsSahrKBmjbGxhES8sRjVRktgxtynXYyO0RDhzFvg8' // pragma: allowlist secret
  }

  const body = JSON.stringify(Object.values(jwtTokens).map(token => generateCreateVCPayload(token, 'CURRENT')))

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
          scope: null,
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
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOkNZN1E2TDd4MEFlQWNmYUdlazY2R2FKeVhhM2R4RVhBaDRxWWtETUVzMUUiLCJuYmYiOjE2NTIwMjAxMzIsImlzcyI6Imh0dHBzOi8vcmV2aWV3LWYuYWNjb3VudC5nb3YudWsiLCJ2b3QiOiJQMiIsImV4cCI6MTY4MzYyODEzMiwiaWF0IjoxNjUyMDkyMTMyLCJ2YyI6eyJldmlkZW5jZSI6W3siYWN0aXZpdHlIaXN0b3J5U2NvcmUiOjAsInZhbGlkaXR5U2NvcmUiOjAsInZlcmlmaWNhdGlvblNjb3JlIjowLCJzdHJlbmd0aFNjb3JlIjowLCJ0eG4iOiJ0eG4iLCJpZGVudGl0eUZyYXVkU2NvcmUiOjIsInR5cGUiOiJJZGVudGl0eUNoZWNrIiwiY2hlY2tEZXRhaWxzIjpbeyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoibW9ydGFsaXR5X2NoZWNrIn0seyJjaGVja01ldGhvZCI6ImRhdGEiLCJmcmF1ZENoZWNrIjoiaWRlbnRpdHlfdGhlZnRfY2hlY2sifSx7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImZyYXVkQ2hlY2siOiJzeW50aGV0aWNfaWRlbnRpdHlfY2hlY2sifSx7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImZyYXVkQ2hlY2siOiJpbXBlcnNvbmF0aW9uX3Jpc2tfY2hlY2sifV0sImNpIjpbIkYwNCJdfV0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOlt7Im5hbWVQYXJ0cyI6W3sidHlwZSI6IkdpdmVuTmFtZSIsInZhbHVlIjoiSmFuZSJ9LHsidHlwZSI6IkZhbWlseU5hbWUiLCJ2YWx1ZSI6IldyaWdodCJ9XSwidmFsaWRGcm9tIjoiMjAxOS0wNC0wMSJ9LHsidmFsaWRVbnRpbCI6IjIwMjktMDQtMDEiLCJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV19XSwiYmlydGhEYXRlIjpbeyJ2YWx1ZSI6IjE5ODktMDctMDYifV19LCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiSWRlbnRpdHlDaGVja0NyZWRlbnRpYWwiXSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3ZvY2FiLmxvbmRvbi5jbG91ZGFwcHMuZGlnaXRhbC9jb250ZXh0cy9pZGVudGl0eS12MS5qc29ubGQiXX0sInZ0bSI6Imh0dHBzOi8vb2lkYy5hY2NvdW50Lmdvdi51ay90cnVzdG1hcmsifQ.MEQCIHy50XHTu2s0SAtsXs02d4VxUZta5rDuK0KTtv6Ya3oXAiBceSvuMd0n5uddq5QnD0cuvGwk26Oe_i3inH_i5azt6g', // pragma: allowlist secret
    passport:
      'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOjU3YTI0Yzc5LWJmNWEtNDNiZC1iMWRmLWRhMDRhODhiYTZmZSIsIm5iZiI6MTY1MjAyMDExMCwiaXNzIjoiaHR0cHM6Ly9yZXZpZXctcC5hY2NvdW50Lmdvdi51ayIsInZvdCI6IlAyIiwiZXhwIjoxNjgzNjI4MTEwLCJpYXQiOjE2NTIwOTIxMTAsInZjIjp7ImV2aWRlbmNlIjpbeyJhY3Rpdml0eUhpc3RvcnlTY29yZSI6MCwidmFsaWRpdHlTY29yZSI6MCwidmVyaWZpY2F0aW9uU2NvcmUiOjAsInN0cmVuZ3RoU2NvcmUiOjQsInR4biI6InR4biIsImlkZW50aXR5RnJhdWRTY29yZSI6MCwidHlwZSI6IklkZW50aXR5Q2hlY2siLCJjaGVja0RldGFpbHMiOlt7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImRhdGFDaGVjayI6InJlY29yZF9jaGVjayJ9XSwiZmFpbGVkQ2hlY2tEZXRhaWxzIjpbeyJjaGVja01ldGhvZCI6ImRhdGEiLCJkYXRhQ2hlY2siOiJjYW5jZWxsZWRfY2hlY2sifSx7ImNoZWNrTWV0aG9kIjoiZGF0YSIsImRhdGFDaGVjayI6Imxvc3Rfc3RvbGVuX2NoZWNrIn1dfV0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOlt7Im5hbWVQYXJ0cyI6W3sidHlwZSI6IkdpdmVuTmFtZSIsInZhbHVlIjoiSmFuZSJ9LHsidHlwZSI6IkZhbWlseU5hbWUiLCJ2YWx1ZSI6IldyaWdodCJ9XSwidmFsaWRGcm9tIjoiMjAxOS0wNC0wMSJ9LHsidmFsaWRVbnRpbCI6IjIwMjktMDQtMDEiLCJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV19XSwiYmlydGhEYXRlIjpbeyJ2YWx1ZSI6IjE5ODktMDctMDYifV0sInBhc3Nwb3J0IjpbeyJkb2N1bWVudE51bWJlciI6IjEyMjM0NTY3OCIsImV4cGlyeURhdGUiOiIyMDIyLTAyLTAyIiwiaWNhb0lzc3VlckNvZGUiOiJHQlIifV19LCJ0eXBlIjpbIlZlcmlmaWFibGVDcmVkZW50aWFsIiwiSWRlbnRpdHlDaGVja0NyZWRlbnRpYWwiXSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3ZvY2FiLmxvbmRvbi5jbG91ZGFwcHMuZGlnaXRhbC9jb250ZXh0cy9pZGVudGl0eS12MS5qc29ubGQiXX0sInZ0bSI6Imh0dHBzOi8vb2lkYy5hY2NvdW50Lmdvdi51ay90cnVzdG1hcmsifQ.MEUCIQD3sJmXxyxkcl75_KDhTiytQuywwof7VgGOU9CO3AyikwIgELjpM4zfobUiReVasOM8rVHhB-lOXFoTGOfjBdeTLJs', // pragma: allowlist secret
    kbv: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1cm46ZmRjOmdvdi51azoyMDIyOlBWUUk3Z0VmR1o2a080X0Z4eDZjaHF0SGNobzVzcjgtazA0MUdxci1YbzQiLCJuYmYiOjE2NTIwMjAxNTMsImlzcyI6Imh0dHBzOi8vcmV2aWV3LWsuYWNjb3VudC5nb3YudWsiLCJ2b3QiOiJQMiIsImV4cCI6MTY4MzYyODE1MywiaWF0IjoxNjUyMDkyMTUzLCJ2YyI6eyJldmlkZW5jZSI6W3siYWN0aXZpdHlIaXN0b3J5U2NvcmUiOjAsInZhbGlkaXR5U2NvcmUiOjAsInZlcmlmaWNhdGlvblNjb3JlIjoyLCJzdHJlbmd0aFNjb3JlIjowLCJ0eG4iOiJ0eG4iLCJpZGVudGl0eUZyYXVkU2NvcmUiOjAsInR5cGUiOiJJZGVudGl0eUNoZWNrIn1dLCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lIjpbeyJuYW1lUGFydHMiOlt7InR5cGUiOiJHaXZlbk5hbWUiLCJ2YWx1ZSI6IkphbmUifSx7InR5cGUiOiJGYW1pbHlOYW1lIiwidmFsdWUiOiJXcmlnaHQifV0sInZhbGlkRnJvbSI6IjIwMTktMDQtMDEifSx7InZhbGlkVW50aWwiOiIyMDI5LTA0LTAxIiwibmFtZVBhcnRzIjpbeyJ0eXBlIjoiR2l2ZW5OYW1lIiwidmFsdWUiOiJKYW5lIn0seyJ0eXBlIjoiRmFtaWx5TmFtZSIsInZhbHVlIjoiV3JpZ2h0In1dfV0sImJpcnRoRGF0ZSI6W3sidmFsdWUiOiIxOTg5LTA3LTA2In1dfSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIklkZW50aXR5Q2hlY2tDcmVkZW50aWFsIl0sIkBjb250ZXh0IjpbImh0dHBzOi8vd3d3LnczLm9yZy8yMDE4L2NyZWRlbnRpYWxzL3YxIiwiaHR0cHM6Ly92b2NhYi5sb25kb24uY2xvdWRhcHBzLmRpZ2l0YWwvY29udGV4dHMvaWRlbnRpdHktdjEuanNvbmxkIl19LCJ2dG0iOiJodHRwczovL29pZGMuYWNjb3VudC5nb3YudWsvdHJ1c3RtYXJrIn0.MEUCIDb_M_4HbcIce_Vep0Mb-OKjRtTdYi0mM4JVEgVlDKZcAiEAwAsSahrKBmjbGxhES8sRjVRktgxtynXYyO0RDhzFvg8' // pragma: allowlist secret
  }

  body = JSON.stringify(Object.values(jwtTokens).map(token => generateCreateVCPayload(token, 'PENDING')))

  timeGroup(groups[0], () => http.post(env.envURL + `/vcs/${subjectID}`, body, options), {
    isStatusCode202: r => r.status === 202,
    ...pageContentCheck('messageId')
  })

  sleep(1)

  const jwtSignatures = {
    fraud: 'MEQCIHy50XHTu2s0SAtsXs02d4VxUZta5rDuK0KTtv6Ya3oXAiBceSvuMd0n5uddq5QnD0cuvGwk26Oe_i3inH_i5azt6g', // pragma: allowlist secret
    passport: 'MEUCIQD3sJmXxyxkcl75_KDhTiytQuywwof7VgGOU9CO3AyikwIgELjpM4zfobUiReVasOM8rVHhB-lOXFoTGOfjBdeTLJs', // pragma: allowlist secret
    kbv: 'MEUCIDb_M_4HbcIce_Vep0Mb-OKjRtTdYi0mM4JVEgVlDKZcAiEAwAsSahrKBmjbGxhES8sRjVRktgxtynXYyO0RDhzFvg8' // pragma: allowlist secret
  }

  body = JSON.stringify(Object.values(jwtSignatures).map(signature => generateUpdateVCPayload(signature, 'CURRENT')))

  timeGroup(groups[1], () => http.patch(env.envURL + `/vcs/${subjectID}`, body, options), {
    isStatusCode204: r => r.status === 204
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
