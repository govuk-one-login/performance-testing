import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI3SpikeSignUpScenario,
  createI4PeakTestSignUpScenario
} from '../common/utils/config/load-profiles'
import { env, encodedCredentials } from './utils/config'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('kbv', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('kbv', LoadProfile.short, 5)
  },
  stress: {
    ...createScenario('kbv', LoadProfile.full, 14)
  },
  lowVolumePERF007Test: {
    kbv: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 20, duration: '200s' }, // Target to be updated based on the percentage split confirmed by the app team
        { target: 20, duration: '180s' } // Target to be updated based on the percentage split confirmed by the app team
      ],
      exec: 'kbv'
    }
  },
  perf006Iteration1: {
    kbv: {
      executor: 'ramping-arrival-rate',
      startRate: 6,
      timeUnit: '1m',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 156, duration: '27s' },
        { target: 156, duration: '15m' }
      ],
      exec: 'kbv'
    }
  },
  spikeI2LowTraffic: {
    ...createScenario('kbv', LoadProfile.spikeI2LowTraffic, 4) //rounded to 4 from 3.5
  },

  perf006Iteration2PeakTest: {
    kbv: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 12, duration: '13s' },
        { target: 12, duration: '30m' }
      ],
      exec: 'kbv'
    }
  },
  perf006Iteration3PeakTest: {
    kbv: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 16, duration: '17s' },
        { target: 16, duration: '30m' }
      ],
      exec: 'kbv'
    }
  },
  perf006Iteration3SpikeTest: {
    ...createI3SpikeSignUpScenario('kbv', 49, 12, 50)
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('kbv', 47, 12, 48)
  },
  perf006Iteration4SpikeTest: {
    ...createI3SpikeSignUpScenario('kbv', 113, 12, 114)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('kbv', 18, 12, 19)
  },
  perf006Iteration8PeakTest: {
    ...createI4PeakTestSignUpScenario('kbv', 20, 12, 21)
  },
  perf006Iteration8SpikeTest: {
    ...createI3SpikeSignUpScenario('kbv', 63, 12, 64)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  kbv: [
    'B01_KBV_01_CoreStubEditUserContinue',
    'B01_KBV_01_CoreStubEditUserContinue::01_CoreStubCall',
    'B01_KBV_01_CoreStubEditUserContinue::02_KBVCRICall',
    'B01_KBV_02_KBVQuestion1',
    'B01_KBV_03_KBVQuestion2',
    'B01_KBV_04_KBVQuestion3',
    'B01_KBV_04_KBVQuestion3::01_KBVCRICall',
    'B01_KBV_04_KBVQuestion3::02_CoreStubCall'
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

const kbvAnswersOBJ = {
  kbvAnswers: getEnv('IDENTITY_KBV_ANSWERS')
}

export function kbv(): void {
  const groups = groupMap.kbv
  let res: Response
  interface KbvAnswers {
    kbvAns1: string
    kbvAns2: string
    kbvAns3: string
  }
  const kbvAnsJSON: KbvAnswers = JSON.parse(kbvAnswersOBJ.kbvAnswers)
  iterationsStarted.add(1)

  // B01_KBV_01_CoreStubEditUserContinue
  timeGroup(groups[0], () => {
    //01_CoreStubCall
    res = timeGroup(
      groups[1].split('::')[1],
      () =>
        http.get(env.ipvCoreStub + '/authorize?cri=kbv-cri-' + env.envName + '&rowNumber=197', {
          headers: { Authorization: `Basic ${encodedCredentials}` },
          redirects: 0
        }),
      { isStatusCode302 }
    )
    //02_KBVCRICall
    res = timeGroup(groups[2].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('You can find this amount on your loan agreement')
    })
  })

  sleepBetween(1, 3)

  // B01_KBV_02_KBVQuestion1
  res = timeGroup(
    groups[3],
    () =>
      res.submitForm({
        fields: { Q00042: kbvAnsJSON.kbvAns1 },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('This includes any interest') }
  )

  sleepBetween(1, 3)

  // B01_KBV_03_KBVQuestion2
  res = timeGroup(
    groups[4],
    () =>
      res.submitForm({
        fields: { Q00015: kbvAnsJSON.kbvAns2 },
        submitSelector: '#continue'
      }),
    {
      isStatusCode200,
      ...pageContentCheck('Think about the amount you agreed to pay back every month')
    }
  )

  sleepBetween(1, 3)

  // B01_KBV_04_KBVQuestion3
  timeGroup(groups[5], () => {
    // 01_KBVCRICall
    res = timeGroup(
      groups[6].split('::')[1],
      () =>
        res.submitForm({
          fields: { Q00018: kbvAnsJSON.kbvAns3 },
          params: { redirects: 2 },
          submitSelector: '#continue'
        }),
      { isStatusCode302 }
    )
    // 02_CoreStubCall
    res = timeGroup(
      groups[7].split('::')[1],
      () =>
        http.get(res.headers.Location, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      {
        isStatusCode200,
        ...pageContentCheck('verificationScore&quot;: 2')
      }
    )
  })
  iterationsCompleted.add(1)
}
