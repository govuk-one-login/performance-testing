import { sleep } from 'k6'
import { type Options } from 'k6/options'
import {
  describeProfile,
  type ProfileList,
  selectProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'

import {
  postSelectDevice,
  postSelectSmartphone,
  postValidPassport,
  postBiometricChip,
  postIphoneModel,
  getRedirect,
  postIdCheckApp,
  getAbortCommand,
  startJourney,
  getSessionIdFromCookieJar
} from './testSteps/frontend'

import {
  postVerifyAuthorizeRequest,
  postResourceOwnerDocumentGroups,
  //getRedirect,
  postToken,
  postUserInfoV2
} from './testSteps/backend'

import { getBiometricTokenV2, postFinishBiometricSession } from './testSteps/backend'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('febecombine', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('febecombine', LoadProfile.full, 10, 40)
  },
  load: {
    ...createScenario('febecombine', LoadProfile.full, 40, 40)
  },
  nfrload: {
    ...createScenario('febecombine', LoadProfile.full, 95, 40)
  },
  deploy: {
    ...createScenario('febecombine', LoadProfile.deployment, 1, 40)
  },
  incrementalSmallVolumes: {
    ...createScenario('febecombine', LoadProfile.incremental, 40)
  },
  incrementalLoad: {
    ...createScenario('febecombine', LoadProfile.incremental, 100)
  },
  lowVolumePERF007Test: {
    febecombine: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 20, duration: '200s' },
        { target: 20, duration: '180s' }
      ],
      exec: 'febecombine'
    }
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  febecombine: [
    'POST test client /start', //FE
    'GET /authorize', //FE
    'POST /selectDevice', //FE
    'POST /selectSmartphone', //FE
    'POST /validPassport', //FE
    'POST /biometricChip', //FE
    'POST /iphoneModel', //FE
    'POST /idCheckApp', //FE
    //'GET /appInfo' //BE
    'GET /biometricToken/v2', //BE
    //'POST /writeTxma', //BE
    'POST /finishBiometricSession', //BE
    'GET /redirect', //FE
    'POST /token', //BE
    'POST /userinfo/v2' //BE
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

export function febecombine(): void {
  iterationsStarted.add(1)
  startJourney()
  simulateUserWait()
  postSelectDevice()
  simulateUserWait()
  postSelectSmartphone()
  simulateUserWait()
  postValidPassport()
  simulateUserWait()
  postBiometricChip()
  simulateUserWait()
  postIphoneModel()
  simulateUserWait()
  postIdCheckApp()
  // BE Get /appInfo
  simulateUserWait()
  if (Math.random() <= 0.8) {
    // Approximately 80% of users complete journey successfully
    const sessionId = getSessionIdFromCookieJar()
    getBiometricTokenV2(sessionId)
    sleep(1)
    postwriteTxma() //define this in the fe-be-combine.ts
    postFinishBiometricSession(sessionId)
    sleep(1)
    getRedirect()
    sleep(1)
    postToken() //BE 'POST /token'
  } else {
    // Approximately 20% of users abort journey
    getAbortCommand()
  }
  simulateUserWait()
  iterationsCompleted.add(1)
}

function simulateUserWait(): void {
  sleepBetween(1, 2) // Simulate random time between 1s and 2s for user to stay on page
}

/****************************************Backend Tests Profile**********************************/

export function backendJourney(): void {
  iterationsStarted.add(1)
  const sessionId = postVerifyAuthorizeRequest()
  sleep(1)
  postResourceOwnerDocumentGroups(sessionId)
  sleep(1)
  getBiometricTokenV2(sessionId)
  sleep(1)
  postFinishBiometricSession(sessionId)
  sleep(1)
  const { authorizationCode, redirectUri } = getRedirect(sessionId)
  sleep(1)
  const accessToken = postToken(authorizationCode, redirectUri)
  sleep(1)
  postUserInfoV2(accessToken)
  iterationsCompleted.add(1)
}
