import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { startJourney } from './testSteps/frontend'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('authorize', LoadProfile.smoke)
  },
  load: {
    ...createScenario('authorize', LoadProfile.full, 100, 3)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  authorize: ['POST test client /start', 'GET /authorize']
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
  describeProfile(loadProfile)
}

export function authorize(): void {
  iterationsStarted.add(1)
  startJourney()
  iterationsCompleted.add(1)
}
