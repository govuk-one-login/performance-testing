import { AWSConfig } from '../../common/utils/jslib/aws-sqs'
import { getEnv } from '../../common/utils/config/environment-variables'
import type { AssumeRoleOutput } from '../../common/utils/aws/types'
import { initializeApp } from 'firebase/app'
import { getLimitedUseToken, initializeAppCheck, CustomProvider } from 'firebase/app-check'

import {
  createScenario,
  describeProfile,
  LoadProfile,
  ProfileList,
  selectProfile
} from '../../common/utils/config/load-profiles'
import { Options } from 'k6/options'
import { getThresholds } from '../../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../../common/utils/custom_metric/counter'
import { SecretsManagerClient } from '../../common/utils/jslib/aws-secrets-manager'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('getClientAttestation', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)
export const groupMap = {
  getClientAttestation: [
    // TODO: Add steps here
  ]
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
  describeProfile(loadProfile)
}

export async function getClientAttestation(): Promise<void> {
  await generateFirebaseDebugToken()

  iterationsStarted.add(1)
  iterationsCompleted.add(1)
}

const credentials = (JSON.parse(getEnv('EXECUTION_CREDENTIALS')) as AssumeRoleOutput).Credentials
const awsConfig = new AWSConfig({
  region: getEnv('AWS_REGION'),
  accessKeyId: credentials.AccessKeyId,
  secretAccessKey: credentials.SecretAccessKey,
  sessionToken: credentials.SessionToken
})
const secretsManagerClient = new SecretsManagerClient(awsConfig)

const global: { [key: string]: string } = {}

export async function generateFirebaseDebugToken() {
  console.log('FETCHING SECRET', getEnv('MOBILE_BACKEND_DEV_FIREBASE_IOS_DEBUG_TOKEN_SECRET_LOCATION'))
  global.FIREBASE_APPCHECK_DEBUG_TOKEN = (
    await secretsManagerClient.getSecret(getEnv('MOBILE_BACKEND_DEV_FIREBASE_IOS_DEBUG_TOKEN_SECRET_LOCATION'))
  ).name
  const firebaseApiKey = (
    await secretsManagerClient.getSecret(getEnv('MOBILE_BACKEND_DEV_FIREBASE_FIREBASE_API_KEY_SECRET_LOCATION'))
  ).name

  const app = initializeApp({
    appId: getEnv('FIREBASE_IOS_APP_ID'),
    projectId: getEnv('FIREBASE_PROJECT_NUMBER'),
    apiKey: firebaseApiKey
  })

  const appCheck = initializeAppCheck(app, {
    provider: new CustomProvider({
      getToken: async () => {
        return {
          // Response does not matter, as we are enabling debug anyway
          token: 'mock-token',
          expireTimeMillis: 0
        }
      }
    })
  })

  const tokenResponse = await getLimitedUseToken(appCheck)

  return tokenResponse.token
}
