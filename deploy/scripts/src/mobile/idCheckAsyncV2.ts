import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import http from 'k6/http'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('idCheckAsyncV2', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  idCheckAsyncV2: ['01_IDCheckAsyncV2_Step1', '01_IDCheckAsyncV2_Step2']
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
  describeProfile(loadProfile)
}

export function idCheckAsyncV2(): void {
  const groups = groupMap.idCheckAsyncV2
  iterationsStarted.add(1)
  timeGroup(groups[0], () => http.get('Endpoint_Step1'), {
    isStatusCode200,
    ...pageContentCheck('Page content to validate')
  })

  sleepBetween(0.5, 1)

  iterationsCompleted.add(1)
}
