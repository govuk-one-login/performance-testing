import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import http from 'k6/http'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI3SpikeSignUpScenario,
  createI4PeakTestSignUpScenario
} from '../common/utils/config/load-profiles'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('otg', LoadProfile.smoke)
  },
  load: {
    ...createScenario('otg', LoadProfile.full, 10)
  },
  stress: {
    ...createScenario('otg', LoadProfile.full, 44)
  },
  spikeI2HighTraffic: {
    ...createScenario('otg', LoadProfile.spikeI2HighTraffic, 4, 4)
  },
  spikeI2LowTraffic: {
    ...createScenario('otg', LoadProfile.spikeI2LowTraffic, 1) //rounded to 1 from 0.4 based on the iteration 2 plan
  },
  perf006Iteration2PeakTest: {
    otg: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 1, duration: '1s' },
        { target: 1, duration: '30m' }
      ],
      exec: 'otg'
    }
  },
  perf006Iteration3PeakTest: {
    otg: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 2, duration: '2s' },
        { target: 2, duration: '30m' }
      ],
      exec: 'otg'
    }
  },
  perf006Iteration3SpikeTest: {
    ...createI3SpikeSignUpScenario('otg', 5, 3, 6)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('otg', 2, 3, 3)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  otg: ['B01_OTG_01_GetToken']
}

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
  describeProfile(loadProfile)
}

const environment = getEnv('ENVIRONMENT').toLocaleUpperCase()
const validEnvironments = ['BUILD']
if (!validEnvironments.includes(environment))
  throw new Error(`Environment '${environment}' not in [${validEnvironments.toString()}]`)

const env = {
  otgURL: getEnv(`IDENTITY_${environment}_OTG_URL`)
}

export function otg(): void {
  const groups = groupMap.otg
  iterationsStarted.add(1)

  //B01_OTG_01_GetToken
  timeGroup(groups[0], () => http.get(env.otgURL + '/build/token?tokenType=stub'), {
    isStatusCode200,
    ...pageContentCheck('goodToken')
  })

  iterationsCompleted.add(1)
}
