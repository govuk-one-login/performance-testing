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
import { createSession } from './testSteps/createSession'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('idCheckAsync', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)
export const groupMap = {
  idCheckAsync: ['01 POST /async/token', '02 POST /async/credential']
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
  describeProfile(loadProfile)
}

export function idCheckAsync(): void {
  iterationsStarted.add(1)
  createSession()
  iterationsCompleted.add(1)
}

