import { type Scenario } from 'k6/options'

export type ScenarioList = Record<string, Scenario>
export type ProfileList = Record<string, ScenarioList>
export interface Profile {
  name: string
  scenarios: ScenarioList
}
export interface ProfileConfig {
  profile: string
  scenario?: string
}

/**
 * Returns a single load profile from a list of load profiles
 * Intended to work with CLI flags e.g. '--env PROFILE=smoke'
 * @param {ProfileList} profiles List of load profiles to select from
 * @param {string} profileName Profile name to select
 * @returns {Profile} Selected load profile
 */
export function getProfile (profiles: ProfileList, profileName: string): Profile {
  if (profileName == null) throw new Error('No profile specified')
  if (profileName in profiles) {
    return {
      name: profileName,
      scenarios: profiles[profileName]
    }
  }
  throw new Error(`Selection '${profileName}' does not exist. Valid options are '${Object.keys(profiles).toString()}'`)
}

/**
 * Returns a subset of scenarios based on a comma seperated list of selections
 * Intended to work with CLI flags e.g. '--env SCENARIO=sign_in,sign_up'
 * If selections parameter is not specified then all scenarios are enabled
 * @param {ScenarioList} scenarios List of scenarios to select from
 * @param {string | undefined} selections Scenario selection string to use, defaults to selecting all scenarios
 * @returns {ScenarioList} Subset of scenarios as defined by the selection string
 */
export function getScenarios (scenarios: ScenarioList, selections: string | undefined): ScenarioList {
  let enabled: ScenarioList = {}
  selections == null || selections === '' || selections.toLowerCase() === 'all' // Enable all scenarios is selection string is null, empty or set to 'all'
    ? enabled = scenarios
    : selections.split(',').forEach(scenario => { enabled[scenario] = scenarios[scenario] })
  return enabled
}

/**
 * Default config uses the CLI flags
 * - `--env PROFILE` specifies the load profile to use, defaults to `smoke`
 * - `--env SCENARIO` specifies which scenarios within the load profile to use, defaults to `all`
 */
export const defaultConfig: ProfileConfig = {
  profile: __ENV.PROFILE ?? 'smoke',
  scenario: __ENV.SCENARIO ?? 'all'
}

/**
 * Selects load profile and scenarios based on config selections
 * @param {ProfileList} profiles Object containing all the load profile and scenario definitions
 * @param {ProfileConfig} config Object containing the `profile` and `scenario` selection strings,
 * defaults to `defaultConfig` which uses the environment variables
 * @returns {Profile} Object containing the selected load profile and scenarios
 */
export function selectProfile (profiles: ProfileList, config: ProfileConfig = defaultConfig): Profile {
  const profile = getProfile(profiles, config.profile)
  return {
    name: profile.name,
    scenarios: getScenarios(profile.scenarios, config.scenario)
  }
}

/**
 * Prints a description of the load profile running to the standard console log
 * @param {Profile} profile Load profile to be used in the test
 * @example
 * const loadProfile = selectProfile(profiles)
 * export function setup (): void {
 *   describeProfile(loadProfile)
 * }
 */
export function describeProfile (profile: Profile): void {
  console.log(`Load Profile: <\x1b[32m${profile.name}\x1b[0m>`)
  console.log(`Scenarios: <\x1b[34m${Object.keys(profile.scenarios).join('\x1b[0m|\x1b[34m')}\x1b[0m>`)
}
