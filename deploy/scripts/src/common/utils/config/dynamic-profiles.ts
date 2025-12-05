import { type ScenarioList } from './load-profiles'
import {
  createI4PeakTestSignUpScenario,
  createI4PeakTestSignInScenario,
  createI3SpikeSignUpScenario,
  createI3SpikeSignInScenario
} from './load-profiles'

interface ScenarioConfig {
  target: number
  duration: number
  rampUp: number
  type: 'peakSignUp' | 'peakSignIn' | 'spikeSignUp' | 'spikeSignIn'
}

interface DynamicProfileConfig {
  [scenarioName: string]: ScenarioConfig
}

/**
 * Parses environment variable for scenario configuration
 * Format: "scenarioName:target:duration:rampUp:type,..."
 * Peak Example: "identity:180:42:181:peakSignUp,idReuse:71:6:33:peakSignIn"
 * Spike Example: "identity:540:36:541:spikeSignUp,idReuse:143:6:66:spikeSignIn"
 */
function parseScenarioConfig(configStr: string | undefined): DynamicProfileConfig | null {
  if (!configStr) return null

  const config: DynamicProfileConfig = {}
  const scenarios = configStr.split(',')

  for (const scenario of scenarios) {
    const [name, target, duration, rampUp, type] = scenario.trim().split(':')
    if (!name || !target || !duration || !rampUp || !type) continue

    config[name] = {
      target: parseInt(target),
      duration: parseInt(duration),
      rampUp: parseInt(rampUp),
      type: type as 'peakSignUp' | 'peakSignIn' | 'spikeSignUp' | 'spikeSignIn'
    }
  }

  return Object.keys(config).length > 0 ? config : null
}

/**
 * Creates dynamic scenarios from environment variable configuration
 * @param envVar Environment variable name containing scenario config
 * @returns ScenarioList or null if no config found
 */
export function createDynamicProfile(envVar: string = 'SCENARIO_CONFIG'): ScenarioList | null {
  const configStr = __ENV[envVar]
  const config = parseScenarioConfig(configStr)

  if (!config) return null

  let scenarios: ScenarioList = {}

  for (const [name, params] of Object.entries(config)) {
    let scenarioFunc

    switch (params.type) {
      case 'peakSignUp':
        scenarioFunc = createI4PeakTestSignUpScenario
        break
      case 'peakSignIn':
        scenarioFunc = createI4PeakTestSignInScenario
        break
      case 'spikeSignUp':
        scenarioFunc = createI3SpikeSignUpScenario
        break
      case 'spikeSignIn':
        scenarioFunc = createI3SpikeSignInScenario
        break
      default:
        continue
    }

    scenarios = {
      ...scenarios,
      ...scenarioFunc(name, params.target, params.duration, params.rampUp)
    }
  }

  return scenarios
}
