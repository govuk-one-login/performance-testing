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
    ...createScenario('otg', LoadProfile.smoke)
  },
  load: {
    ...createScenario('otg', LoadProfile.full, 10)
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
