import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { group } from 'k6'
import { SharedArray } from 'k6/data'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import exec from 'k6/execution'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'

const profiles: ProfileList = {
  smoke: {
    ninoScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '30s' } // Ramps up to target load
      ],
      exec: 'ninoScenario1'
    }
  },
  lowVolumeTest: {
    ninoScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 900,
      stages: [
        { target: 30, duration: '5m' }, // Ramp up to 30 iterations per second in 5 minutes
        { target: 30, duration: '15m' }, // Maintain steady state at 30 iterations per second for 15 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'ninoScenario1'
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

interface nino {
  niNumber: string
}

const csvData1: nino[] = new SharedArray('csvDataNino', () => {
  return open('./data/ninoCRIData.csv').split('\n').slice(1).map(niNumber => {
    return { niNumber }
  })
})

export function ninoScenario1 (): void {
  let res: Response
  const user1Nino = csvData1[exec.scenario.iterationInTest % csvData1.length]
  iterationsStarted.add(1)

  res = group('B02_Nino_01_EntryFromLocal  GET', () =>
    timeRequest(() => {
      const res = http.get('http://localhost:5010/oauth2/authorize?request=lorem&client_id=success', { redirects: 1 })
      const jar = http.cookieJar()
      const cookie = res.cookies.service_session[0]
      jar.set(res.url, cookie.name, cookie.value)
      return http.get('http://localhost:5010' + res.headers.Location, { jar })
    },
    { isStatusCode200, ...pageContentCheck('national insurance') })
  )

  sleepBetween(1, 3)

  res = group('B02_Nino_02_SearchNiNo POST', () =>
    timeRequest(() => res.submitForm({
      fields: { nationalInsuranceNumber: user1Nino.niNumber },
      submitSelector: '#continue',
      params: { tags: { name: 'B02_Nino_02_SearchNiNo' } }
    }),
    { isStatusCode200, ...pageContentCheck('Example Domain') }))

  iterationsCompleted.add(1)
}
