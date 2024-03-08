import { type Threshold, type Options } from 'k6/options'
import { defaultConfig } from './load-profiles'

export interface NFRs {
  errors: Threshold[]
  rt: Threshold[]
}
export const nfrs: NFRs = {
  errors: ['rate<0.05'], // Error rate <5%
  rt: [
    'p(95)<=1000', // 95th percentile response time <=1000ms
    'p(99)<=2500' //  99th percentile response time <=2500ms
  ]
}
export type Thresholds = Options['thresholds']
export type GroupMap = Record<string, readonly string[]>

/**
 * TODO: Add JSDocs
 */
export function getThresholds (groupMap: GroupMap, selections: string | undefined = defaultConfig.scenario): Thresholds {
  const thresholds: Thresholds = {
    http_req_duration: nfrs.rt,
    http_req_failed: nfrs.errors
  }
  const addThresholds = (names: readonly string[]): void => {
    names.forEach(name => {
      thresholds[`duration{group:::${name}}`] = nfrs.rt
    })
  }

  if (selections == null || selections === '' || selections.toLowerCase() === 'all') { // Enable all scenarios is selection string is null, empty or set to 'all'
    Object.values(groupMap).forEach(groupNames => {
      addThresholds(groupNames)
    })
  } else {
    selections.split(',').forEach(scenario => {
      const groupNames = groupMap[scenario]
      if (groupNames === undefined) {
        console.warn(`Warning: Scenario '${scenario}' does not exist in group name map. Duration thresholds by group will not be applied`)
        return
      }
      addThresholds(groupNames)
    })
  }

  return thresholds
}
