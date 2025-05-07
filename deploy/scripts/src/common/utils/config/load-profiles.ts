import { type Stage, type Scenario } from 'k6/options'

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
export function getProfile(profiles: ProfileList, profileName: string): Profile {
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
export function getScenarios(scenarios: ScenarioList, selections: string | undefined): ScenarioList {
  let enabled: ScenarioList = {}
  // Enable all scenarios is selection string is null, empty or set to 'all'
  if (selections == null || selections === '' || selections.toLowerCase() === 'all') {
    enabled = scenarios
  } else {
    selections.split(',').forEach(scenario => {
      enabled[scenario] = scenarios[scenario]
    })
  }
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
export function selectProfile(profiles: ProfileList, config: ProfileConfig = defaultConfig): Profile {
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
export function describeProfile(profile: Profile): void {
  console.log(`Load Profile: <\x1b[32m${profile.name}\x1b[0m>`)
  console.log(`Scenarios: <\x1b[34m${Object.keys(profile.scenarios).join('\x1b[0m|\x1b[34m')}\x1b[0m>`)
}

export enum LoadProfile {
  smoke,
  short,
  full,
  deployment,
  rampOnly,
  incremental,
  soak,
  spikeNFRSignUp,
  spikeNFRSignIn,
  spikeSudden,
  spikeNFRSignUpL2,
  spikeNFRSignInL2,
  spikeI2LowTraffic,
  spikeI2HighTraffic,
  steadyStateOnly
}
function createStages(type: LoadProfile, target: number): Stage[] {
  switch (type) {
    case LoadProfile.smoke:
      return [
        { target, duration: '60s' } // 1 minute smoke test
      ]
    case LoadProfile.short:
      return [
        { target, duration: '5m' }, // Ramps up to target throughput in 5 minutes
        { target, duration: '15m' }, // Maintain steady state at target throughput for 15 minutes
        { target: 0, duration: '5m' } // Ramp down over 5 minutes
      ]
    case LoadProfile.full:
      return [
        { target, duration: '15m' }, // Ramps up to target throughput in 15 minutes
        { target, duration: '15m' }, // Maintain steady state at target throughput for 15 minutes
        { target: 0, duration: '5m' } // Ramp down over 5 minutes
      ]
    case LoadProfile.deployment:
      return [
        { target, duration: '5m' }, // Ramp up to target throughput over 5 minutes
        { target, duration: '20m' }, // Maintain steady state at target throughput for 20 minutes
        { target: 0, duration: '5m' } // Ramp down over 5 minutes
      ]
    case LoadProfile.rampOnly:
      return [
        { target, duration: '15m' }, // Ramp up to target throughput over 15 minutes
        { target, duration: '5m' }, // Maintain steady state at target throughput for 5 minutes
        { target, duration: '5m' } // Ramp down over 5 minutes
      ]
    case LoadProfile.incremental: {
      const step = Math.round(target / 4)
      return [
        { target: step, duration: '4m' }, // Ramp up to 25% target throughput over 4 minutes
        { target: step, duration: '10m' }, // Maintain steady state at 25% target throughput for 10 minutes
        { target: step * 2, duration: '4m' }, // Ramp up to 50% target throughput over 4 minutes
        { target: step * 2, duration: '10m' }, // Maintain steady state at 50% target throughput for 10 minutes
        { target: step * 3, duration: '4m' }, // Ramp up to 75% target throughput over 4 minutes
        { target: step * 3, duration: '10m' }, // Maintain steady state at 75% target throughput for 10 minutes
        { target, duration: '4m' }, // Ramp up to target throughput over 4 minutes
        { target, duration: '10m' } // Maintain steady state at target throughput for 10 minutes
      ]
    }
    case LoadProfile.soak:
      return [
        { target, duration: '10m' }, // Ramp up to target throughput over 10 minutes
        { target, duration: '60m' }, // Maintain steady state at target throughput for 60 minutes
        { target, duration: '5m' } // Ramp down over 5 minutes
      ]
    case LoadProfile.spikeNFRSignUp: {
      const step = Math.round(target / 2)
      return [
        { target: step, duration: '4m' }, // Ramp up to 50% target throughput over 4 minutes
        { target: step, duration: '10m' }, // Maintain steady state at 50% target throughput for 10 minutes
        { target: step * 2, duration: '4m' }, // Ramp up to 100% target throughput over 4 minutes
        { target: step * 2, duration: '10m' }, // Maintain steady state at 100% target throughput for 10 minutes
        { target: 0, duration: '5m' } // Ramp down over 5 minutes
      ]
    }
    case LoadProfile.spikeNFRSignIn: {
      const step = Math.round(target / 2)
      return [
        { target: step, duration: '15s' }, // Ramp up to 50% target throughput over 15 seconds
        { target: step, duration: '10m' }, // Maintain steady state at 50% target throughput for 10 minutes
        { target: step * 2, duration: '15s' }, // Ramp up to 100% target throughput over 15 seconds
        { target: step * 2, duration: '10m' }, // Maintain steady state at 100% target throughput for 10 minutes
        { target: 0, duration: '5m' } // Ramp down over 5 minutes
      ]
    }
    case LoadProfile.spikeSudden: {
      const step = Math.round(target / 3)
      return [
        { target: step, duration: '5m' }, // Ramp up to 33% target throughput over 5 minutes
        { target: step, duration: '10m' }, // Maintain steady state at 50% target throughput for 10 minutes
        { target: step * 3, duration: '1s' }, // Ramp up to 100% target throughput over 1 second
        { target: step * 3, duration: '10m' }, // Maintain steady state at 100% target throughput for 10 minutes
        { target: 0, duration: '5m' } // Ramp down over 5 minutes
      ]
    }
    case LoadProfile.spikeNFRSignUpL2: {
      const step = Math.round(target / 2)
      return [
        { target: step, duration: '8m' }, // Ramp up to 50% target throughput over 8 minutes
        { target: step, duration: '10m' }, // Maintain steady state at 50% target throughput for 10 minutes
        { target: step * 2, duration: '8m' }, // Ramp up to 100% target throughput over 8 minutes
        { target: step * 2, duration: '10m' }, // Maintain steady state at 100% target throughput for 10 minutes
        { target: 0, duration: '5m' } // Ramp down over 5 minutes
      ]
    }
    case LoadProfile.spikeNFRSignInL2: {
      const step = Math.round(target / 2)
      return [
        { target: step, duration: '30s' }, // Ramp up to 50% target throughput over 30 seconds
        { target: step, duration: '10m' }, // Maintain steady state at 50% target throughput for 10 minutes
        { target: step * 2, duration: '30s' }, // Ramp up to 100% target throughput over 30 seconds
        { target: step * 2, duration: '10m' }, // Maintain steady state at 100% target throughput for 10 minutes
        { target: 0, duration: '5m' } // Ramp down over 5 minutes
      ]
    }
    case LoadProfile.spikeI2LowTraffic: {
      return [
        { target, duration: '1s' }, // Ramp up to 100% target throughput over 1 second
        { target, duration: '1m' }, // Maintain steady state at 100% target throughput for 1 minute
        { target: 0, duration: '1s' }, // Ramp down to 0 over 1 second
        { target: 0, duration: '5m' }, // Maintain steady state at 0% target throughput for 5 minutes
        { target, duration: '1s' }, // Ramp up to 100% target throughput over 1 second
        { target, duration: '5m' }, // Maintain steady state at 100% target throughput for 5 minutes
        { target: 0, duration: '1s' } // Ramp down over 1 second
      ]
    }
    case LoadProfile.spikeI2HighTraffic: {
      const step = Math.round(target / 3)
      return [
        { target: step, duration: '5m' }, // Ramp up to 33% target throughput over 5 minutes
        { target: step, duration: '5m' }, // Maintain steady state at 33% target throughput for 5 minutes
        { target, duration: '1s' }, // Ramp up to 100% target throughput over 1 second
        { target, duration: '1m' }, // Maintain steady state at 100% target throughput for 1 minute
        { target: step, duration: '1s' }, // Ramp down to 33% over 1 second
        { target: step, duration: '5m' }, // Maintain steady state at 33% target throughput for 5 minutes
        { target, duration: '1s' }, // Ramp up to 100% target throughput over 1 second
        { target, duration: '5m' }, // Maintain steady state at 100% target throughput for 5 minutes
        { target: 0, duration: '1s' } // Ramp down over 1 second
      ]
    }
    case LoadProfile.steadyStateOnly: {
      return [
        { target, duration: '1s' }, // Ramp-up to 100% volume in 1 second
        { target, duration: '6m' } // Maintain 100% volume for 6 minutes
      ]
    }
  }
}

/**
 * Creates a valid load profile scenario
 * @param {string} exec Name of the scenario to execute, must match exported function in script. `Scenario.exec`
 * @param {LoadProfile} type Enum of the load profile to use e.g. `LoadProfile.smoke`
 * @param {number} [target] Target iterations per second, defaults to `1`
 * @param {number} [duration] Max iteration duration in seconds, defaults to `30`
 * @returns {ScenarioList} ScenarioList with the single scenario specified
 * @example
 * const profiles: ProfileList = {
 *  smoke: {
 *    ...createScenario('signIn', LoadProfile.smoke),
 *    ...createScenario('signUp', LoadProfile.smoke)
 *  },
 *  load: {
 *    ...createScenario('signIn', LoadProfile.full, 100, 15),
 *    ...createScenario('signUp', LoadProfile.full, 20)
 *  }
 * }
 */
export function createScenario(
  exec: string,
  type: LoadProfile,
  target: number = 1,
  duration: number = 30
): ScenarioList {
  const list: ScenarioList = {}
  const smoke = type === LoadProfile.smoke
  const preAllocatedVUs = smoke ? 1 : (target * duration) / 2
  const maxVUs = smoke ? 1 : target * duration
  list[exec] = {
    executor: 'ramping-arrival-rate',
    startRate: 1,
    timeUnit: '1s',
    preAllocatedVUs,
    maxVUs,
    stages: createStages(type, target),
    exec
  }
  return list
}

export function createI3SpikeSignUpScenario(
  exec: string,
  target: number = 1,
  iterationDuration: number = 30,
  rampUpNFR: number
): ScenarioList {
  const list: ScenarioList = {}
  const preAllocatedVUs = Math.round(((target / 10) * iterationDuration) / 2)
  const maxVUs = Math.round((target / 10) * iterationDuration)
  const step = Math.round(target / 3)
  const spikeRamp = Math.round(rampUpNFR / 5)
  list[exec] = {
    executor: 'ramping-arrival-rate',
    startRate: 1,
    timeUnit: '10s',
    preAllocatedVUs,
    maxVUs,
    stages: [
      { target: step, duration: '4m' }, // Ramp up to 33% target throughput over 4 minutes
      { target: step, duration: '5m' }, // Maintain steady state at 33% target throughput for 5 minutes
      { target, duration: `${spikeRamp}s` }, // Ramp up to 100% target throughput at 5 X PERF008 growth rate
      { target, duration: '5m' }, // Maintain steady state at 100% target throughput for 5 minutes
      { target: step, duration: '1s' }, // Ramp down to 33% over 1 second
      { target: step, duration: '5m' }, // Maintain steady state at 33% target throughput for 5 minutes
      { target, duration: `${rampUpNFR}s` }, // Ramp up to 100% target throughput at the rate defined in PERF008
      { target, duration: '5m' } // Maintain steady state at 100% target throughput for 5 minutes
    ],
    exec
  }
  return list
}

export function createI3SpikeSignInScenario(
  exec: string,
  target: number = 1,
  iterationDuration: number = 30,
  rampUpNFR: number
): ScenarioList {
  const list: ScenarioList = {}
  const preAllocatedVUs = Math.round((target * iterationDuration) / 2)
  const maxVUs = target * iterationDuration
  const step = Math.round(target / 3)
  const spikeRamp = Math.round(rampUpNFR / 5)
  list[exec] = {
    executor: 'ramping-arrival-rate',
    startRate: 2,
    timeUnit: '1s',
    preAllocatedVUs,
    maxVUs,
    stages: [
      { target: step, duration: '4m' }, // Ramp up to 33% target throughput over 4 minutes
      { target: step, duration: '5m' }, // Maintain steady state at 33% target throughput for 5 minutes
      { target, duration: `${spikeRamp}s` }, // Ramp up to 100% target throughput at 5 X PERF008 growth rate
      { target, duration: '5m' }, // Maintain steady state at 100% target throughput for 5 minutes
      { target: step, duration: '1s' }, // Ramp down to 33% over 1 second
      { target: step, duration: '5m' }, // Maintain steady state at 33% target throughput for 5 minutes
      { target, duration: `${rampUpNFR}s` }, // Ramp up to 100% target throughput at the rate defined in PERF008
      { target, duration: '5m' } // Maintain steady state at 100% target throughput for 5 minutes
    ],
    exec
  }
  return list
}

export function createI4PeakTestSignUpScenario(
  exec: string,
  target: number,
  iterationDuration: number,
  rampUpDuration: number
): ScenarioList {
  const list: ScenarioList = {}
  const preAllocatedVUs = Math.round((target * iterationDuration) / 2)
  const maxVUs = target * iterationDuration * 2

  list[exec] = {
    executor: 'ramping-arrival-rate',
    startRate: 1,
    timeUnit: '10s',
    preAllocatedVUs,
    maxVUs,
    stages: [
      { target, duration: `${rampUpDuration}s` },
      { target, duration: `30m` }
    ],
    exec
  }

  return list
}

export function createI4PeakTestSignInScenario(
  exec: string,
  target: number,
  iterationDuration: number,
  rampUpDuration: number
): ScenarioList {
  const list: ScenarioList = {}
  const preAllocatedVUs = Math.round((target * iterationDuration) / 2)
  const maxVUs = target * iterationDuration * 2

  list[exec] = {
    executor: 'ramping-arrival-rate',
    startRate: 2,
    timeUnit: '1s',
    preAllocatedVUs,
    maxVUs,
    stages: [
      { target, duration: `${rampUpDuration}s` },
      { target, duration: `30m` }
    ],
    exec
  }

  return list
}

export function createI3SpikeOLHScenario(
  exec: string,
  target: number = 1,
  iterationDuration: number = 30,
  rampUpNFR: number
): ScenarioList {
  const list: ScenarioList = {}
  const preAllocatedVUs = Math.round((target * iterationDuration) / 2)
  const maxVUs = target * iterationDuration
  const step = Math.round(target / 3)
  const spikeRamp = Math.round(rampUpNFR / 5)
  list[exec] = {
    executor: 'ramping-arrival-rate',
    startRate: 120,
    timeUnit: '1m',
    preAllocatedVUs,
    maxVUs,
    stages: [
      { target: step, duration: '4m' }, // Ramp up to 33% target throughput over 4 minutes
      { target: step, duration: '5m' }, // Maintain steady state at 33% target throughput for 5 minutes
      { target, duration: `${spikeRamp}s` }, // Ramp up to 100% target throughput at 5 X PERF008 growth rate
      { target, duration: '5m' }, // Maintain steady state at 100% target throughput for 5 minutes
      { target: step, duration: '1s' }, // Ramp down to 33% over 1 second
      { target: step, duration: '5m' }, // Maintain steady state at 33% target throughput for 5 minutes
      { target, duration: `${rampUpNFR}s` }, // Ramp up to 100% target throughput at the rate defined in PERF008
      { target, duration: '5m' } // Maintain steady state at 100% target throughput for 5 minutes
    ],
    exec
  }
  return list
}

export function createI3RegressionScenario(
  exec: string,
  target: number = 1,
  iterationDuration: number = 5,
  rampUpNFR: number
): ScenarioList {
  const list: ScenarioList = {}
  const preAllocatedVUs = Math.round((target * iterationDuration) / 2)
  const maxVUs = target * iterationDuration
  list[exec] = {
    executor: 'ramping-arrival-rate',
    startRate: 1,
    timeUnit: '10s',
    preAllocatedVUs,
    maxVUs,
    stages: [
      { target, duration: `${rampUpNFR}s` }, // Ramp up to 100% target throughput at the rate defined in PERF008
      { target, duration: '5m' } // Maintain steady state at 100% target throughput for 5 minutes
    ],
    exec
  }
  return list
}
