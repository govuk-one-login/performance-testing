import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import http from 'k6/http'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('frontEndScaling', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('frontEndScaling', LoadProfile.full, 30)
  },
  load: {
    ...createScenario('frontEndScaling', LoadProfile.full, 1000)
  },
  stress: {
    ...createScenario('frontEndScaling', LoadProfile.full, 2000)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  frontEndScaling: [
    'B01_FEScaling_01_CallDemoAPI'
  ]
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
  describeProfile(loadProfile)
}

const env = {
  apiURL: getEnv('DEMO_NODE_ENDPOINT')
}

export function frontEndScaling(): void {
  const groups = groupMap.frontEndScaling
  iterationsStarted.add(1)

  // B01_FEScaling_01_CallDemoAPI
  timeGroup(groups[0], () => http.get(env.apiURL + '/toy'), {
    isStatusCode200,
    ...pageContentCheck('We need to ask you about your favourite toy')
  })
  iterationsCompleted.add(1)
}

