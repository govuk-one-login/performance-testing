import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile,
  createI4PeakTestSignUpScenario,
  createI4PeakTestSignInScenario,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { getThresholds } from '../common/utils/config/thresholds'
import { updateVC as evcsUpdateVC, summariseVC as evcsSummariseVC } from './vc-storage'
import { identity as sisIdentity, invalidate as sisInvalidate } from './sis'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('updateVC', LoadProfile.smoke),
    ...createScenario('summariseVC', LoadProfile.smoke),
    ...createScenario('identity', LoadProfile.smoke),
    ...createScenario('invalidate', LoadProfile.smoke)
  },
  perf006Iteration8PeakTest: {
    ...createI4PeakTestSignUpScenario('updateVC', 170, 7, 171),
    ...createI4PeakTestSignInScenario('summariseVC', 126, 6, 58),
    ...createI4PeakTestSignUpScenario('identity', 170, 11, 171),
    ...createI4PeakTestSignInScenario('invalidate', 126, 6, 58)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  updateVC: ['R03_UpdateVC_01_CreateVC', 'R03_UpdateVC_02_UpdateVC'],
  summariseVC: ['R02_SummariseVC_01_GenerateTokenSummary', 'R02_SummariseVC_02_Summarise'],
  identity: ['B01_SIS_01_IdentityCall', 'B01_SIS_01_InvalidateCall'],
  invalidate: ['B02_SIS_01_InvalidateCall']
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
  describeProfile(loadProfile)
}

export function updateVC(): void {
  evcsUpdateVC()
}

export function summariseVC(): void {
  evcsSummariseVC()
}

export async function identity(): Promise<void> {
  await sisIdentity()
}

export async function invalidate(): Promise<void> {
  await sisInvalidate()
}
