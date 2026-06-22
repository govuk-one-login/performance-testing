import { Scenario } from 'k6/options'

type TestConfig = {
  testType: 'peak' | 'soak' | 'spike' | 'stress'
  signUpTargetThroughput: number
  signInTargetThroughput: number
  iterationDurationSignUp: number
  iterationDurationSignIn: number
  signUpGrowthRate: number
  signInGrowthRate: number
  steadyStateDuration: number
  increments: number
  spikeRampUpNFR: number
  signUpRampUpDuration: number
  signInRampUpDuration: number
  signUpRampDownDuration: number
  signInRampDownDuration: number
  totalDurationPerIncrement?: number
}

type Stage = { target: number; duration: string }

type ScenarioList = Record<string, Scenario>

// retrieves a value from the K6 `__ENV` object
function getEnvValue(name: string, defaultValue?: string | number): string | number | undefined {
  const envValue = __ENV[name]
  if (envValue === undefined && defaultValue !== undefined) {
    console.warn(`[Config] Environment variable '${name}' not found. Using default value: ${defaultValue}`)
    return defaultValue
  }
  return envValue
}

function getEnvFromConfig(name: string, defaultValue: number): number {
  const envValue = getEnvValue(name, defaultValue)
  return parseFloat(String(envValue))
}

// Generates the K6 stages array for a given load profile.
function generateStages(
  config: TestConfig,
  targetThroughput: number,
  rampUpDuration: number,
  rampDownDuration: number,
  growthRate: number
): Stage[] {
  switch (config.testType) {
    case 'stress': {
      const { increments, totalDurationPerIncrement = 461 } = config
      const stages: Stage[] = []
      const stepThroughput = targetThroughput / increments

      console.log(
        `[Stress Profile] Generating ${increments} steps, each with a fixed total duration of ${totalDurationPerIncrement}s, up to ${targetThroughput} iter/s.`
      )
      const rampUpTargetPerIncrement = stepThroughput

      const stepRampUpDuration = Math.max(1, Math.round(rampUpTargetPerIncrement / growthRate + 1))
      const stepSteadyStateDuration = Math.max(1, totalDurationPerIncrement - stepRampUpDuration)
      console.log(
        `        -> Calculated per-step ramp-up: ${stepRampUpDuration}s, per-step steady-state: ${stepSteadyStateDuration}s`
      )

      for (let i = 1; i <= increments; i++) {
        const currentTarget = Math.round(stepThroughput * i)
        console.log(
          `        -> Increment ${i}/${increments}: Ramping to ${currentTarget} iter/s for ${stepRampUpDuration}s, then holding for ${stepSteadyStateDuration}s.`
        )

        stages.push({ target: currentTarget, duration: `${stepRampUpDuration}s` })
        stages.push({ target: currentTarget, duration: `${stepSteadyStateDuration}s` })
      }

      stages.push({ target: 0, duration: `${rampDownDuration}s` })
      return stages
    }

    case 'spike': {
      const baseThroughput = Math.round(targetThroughput / 3)
      const spikeRampUpDuration = Math.max(1, Math.ceil(rampUpDuration / 5))

      return [
        { target: baseThroughput, duration: '4m' },
        { target: baseThroughput, duration: '5m' },
        { target: targetThroughput, duration: `${spikeRampUpDuration}s` },
        { target: targetThroughput, duration: '5m' },
        { target: baseThroughput, duration: '1s' },
        { target: baseThroughput, duration: '5m' },
        { target: targetThroughput, duration: `${rampUpDuration}s` },
        { target: targetThroughput, duration: '5m' },
        { target: 0, duration: `${rampDownDuration}s` }
      ]
    }

    case 'peak':
    case 'soak':
    default: {
      const { steadyStateDuration = 300 } = config

      return [
        { target: targetThroughput, duration: `${rampUpDuration}s` },
        { target: targetThroughput, duration: `${steadyStateDuration}s` },
        { target: 0, duration: `${rampDownDuration}s` }
      ]
    }
  }
}

// The main entry point for creating a dynamic test profile.
export function createDynamicTestProfile(testType: 'peak' | 'soak' | 'spike' | 'stress'): ScenarioList {
  const baseConfig = {
    testType: testType,
    signUpTargetThroughput: getEnvFromConfig(`${testType.toUpperCase()}_SIGNUP_TARGET`, 1),
    signInTargetThroughput: getEnvFromConfig(`${testType.toUpperCase()}_SIGNIN_TARGET`, 1),
    iterationDurationSignUp: getEnvFromConfig(`${testType.toUpperCase()}_SIGNUP_ITERATION_DURATION`, 30),
    iterationDurationSignIn: getEnvFromConfig(`${testType.toUpperCase()}_SIGNIN_ITERATION_DURATION`, 30),
    steadyStateDuration: getEnvFromConfig(`${testType.toUpperCase()}_STEADY_DURATION`, 300),
    totalDurationPerIncrement: getEnvFromConfig(`${testType.toUpperCase()}_TOTAL_DURATION_PER_INCREMENT`, 461),
    signUpGrowthRate: getEnvFromConfig(`${testType.toUpperCase()}_SIGNUP_GROWTH_RATE`, 0.1),
    signInGrowthRate: getEnvFromConfig(`${testType.toUpperCase()}_SIGNIN_GROWTH_RATE`, 2.2),
    rampDownDuration: getEnvFromConfig(`${testType.toUpperCase()}_RAMP_DOWN`, 30),
    increments: getEnvFromConfig(`${testType.toUpperCase()}_INCREMENTS`, 6),
    spikeRampUpNFR: getEnvFromConfig(`${testType.toUpperCase()}_RAMP_UP_NFR`, 30)
  }

  const calculatedSignUpRampUp = Math.ceil(baseConfig.signUpTargetThroughput / baseConfig.signUpGrowthRate + 1)
  const calculatedSignInRampUp = Math.ceil(baseConfig.signInTargetThroughput / baseConfig.signInGrowthRate + 1)

  const fullConfig: TestConfig = {
    ...baseConfig,
    signUpRampUpDuration: calculatedSignUpRampUp,
    signInRampUpDuration: calculatedSignInRampUp,
    signUpRampDownDuration: getEnvFromConfig(`${testType.toUpperCase()}_SIGNUP_RAMP_DOWN`, baseConfig.rampDownDuration),
    signInRampDownDuration: getEnvFromConfig(`${testType.toUpperCase()}_SIGNIN_RAMP_DOWN`, baseConfig.rampDownDuration)
  }

  console.log(`[Profile] FINAL Config for '${testType}':\n${JSON.stringify(fullConfig, null, 2)}`)

  const scaledSignUpTarget = Math.round(fullConfig.signUpTargetThroughput / 10)

  console.log(
    `[Profile] Scaled SignUp target from ${fullConfig.signUpTargetThroughput} iter/min to ${scaledSignUpTarget} iter/10s.`
  )

  const preAllocatedVUsSignUp = Math.round(
    ((baseConfig.signUpTargetThroughput / 10) * baseConfig.iterationDurationSignUp) / 2
  )
  const preAllocatedVUsSignIn = Math.round((baseConfig.signInTargetThroughput * baseConfig.iterationDurationSignIn) / 2)

  const scenarios: ScenarioList = {
    signUp: {
      executor: 'ramping-arrival-rate',
      exec: 'signUp',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: Math.max(2, preAllocatedVUsSignUp),
      maxVUs: Math.max(10, preAllocatedVUsSignUp * 2),
      stages: generateStages(
        fullConfig,
        //fullConfig.signUpTargetThroughput,
        scaledSignUpTarget,
        fullConfig.signUpRampUpDuration,
        fullConfig.signUpRampDownDuration,
        fullConfig.signUpGrowthRate
      )
    },
    signIn: {
      executor: 'ramping-arrival-rate',
      exec: 'signIn',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: Math.max(5, preAllocatedVUsSignIn),
      maxVUs: Math.max(20, preAllocatedVUsSignIn * 2),
      stages: generateStages(
        fullConfig,
        fullConfig.signInTargetThroughput,
        fullConfig.signInRampUpDuration,
        fullConfig.signInRampDownDuration,
        fullConfig.signInGrowthRate
      )
    }
  }

  return scenarios
}
