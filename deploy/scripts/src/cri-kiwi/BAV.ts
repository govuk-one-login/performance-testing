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
import { b64encode } from 'k6/encoding'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { bankingPayload } from './data/BAVdata'
import { getAuthorizeauthorizeLocation, getclientassertion, getClientID, getCodeFromUrl } from './utils/authorization'
import { getAccessToken } from '../common/utils/authorization/authorization'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('BAV', LoadProfile.smoke)
  },
  load: {
    ...createScenario('BAV', LoadProfile.full, 5)
  },
  spikeI2LowTraffic: {
    ...createScenario('BAV', LoadProfile.spikeI2LowTraffic, 1) //rounded to 1 from 0.4 based on the iteration 2 plan
  },
  perf006Iteration2PeakTest: {
    BAV: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 10,
      maxVUs: 100,
      stages: [
        { target: 1, duration: '1s' },
        { target: 1, duration: '30m' }
      ],
      exec: 'BAV'
    }
  },
  perf006Iteration3PeakTest: {
    BAV: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 10,
      maxVUs: 100,
      stages: [
        { target: 2, duration: '3s' }, //Rounded to 0.2 for the 0.16 target
        { target: 2, duration: '30m' }
      ],
      exec: 'BAV'
    }
  },
  perf006Iteration3SpikeTest: {
    ...createI3SpikeSignUpScenario('BAV', 5, 21, 6)
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('BAV', 5, 24, 6)
  },
  perf006Iteration4SpikeTest: {
    ...createI3SpikeSignUpScenario('BAV', 11, 24, 12)
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignUpScenario('BAV', 6, 24, 7)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('BAV', 2, 24, 3)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  BAV: [
    'B01_BAV_01_IPVStubCall',
    'B01_BAV_02_Authorize',
    'B01_BAV_03_Continue',
    'B01_BAV_04_BankDetails',
    'B01_BAV_05_CheckDetails',
    'B01_BAV_05_CheckDetails::01_BAVCall',
    'B01_BAV_05_CheckDetails::02_IPVStubCall',
    'B01_BAV_06_getClientAssertion_IPVStubCall',
    'B01_BAV_07_SendAuthorizationCode',
    'B01_BAV_08_SendBearerToken'
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

const env = {
  BAV: {
    ipvStub: getEnv('IDENTITY_KIWI_BAV_STUB_URL'),
    target: getEnv('IDENTITY_KIWI_BAV_TARGET')
  }
}

export function BAV(): void {
  const groups = groupMap.BAV
  let res: Response
  const testAccountNumber = '00111111'
  const testSortCode = '12-34-56'
  iterationsStarted.add(1)

  // B01_BAV_01_IPVStubCall
  res = timeGroup(groups[0], () => http.post(env.BAV.ipvStub + '/start', JSON.stringify({ bankingPayload })), {
    isStatusCode200,
    ...pageContentCheck(b64encode('{"alg":"RSA', 'rawstd'))
  })
  const authorizeLocation = getAuthorizeauthorizeLocation(res)
  const clientId = getClientID(res)

  // B01_BAV_02_Authorize
  res = timeGroup(groups[1], () => http.get(authorizeLocation), {
    isStatusCode200,
    ...pageContentCheck('Continue to enter your bank or building society account details')
  })

  // B01_BAV_03_Continue
  res = timeGroup(
    groups[2],
    () =>
      res.submitForm({
        submitSelector: '#landingPageContinue'
      }),
    { isStatusCode200, ...pageContentCheck('Enter your account details') }
  )

  sleepBetween(1, 3)

  // B01_BAV_04_BankDetails
  res = timeGroup(
    groups[3],
    () =>
      res.submitForm({
        fields: {
          sortCode: testSortCode,
          accountNumber: testAccountNumber
        },
        submitSelector: '#continue'
      }),
    {
      isStatusCode200,
      ...pageContentCheck('Check your details match with your bank or building society account')
    }
  )

  sleepBetween(1, 3)

  // B01_BAV_05_CheckDetails
  timeGroup(groups[4], () => {
    //01_BAVCall
    res = timeGroup(
      groups[5].split('::')[1],
      () =>
        res.submitForm({
          submitSelector: '#submitDetails',
          params: { redirects: 2 }
        }),
      { isStatusCode302 }
    )

    //02_IPVStubCall
    res = timeGroup(groups[6].split('::')[1], () => http.get(res.headers.Location), {
      'verify url body': r => r.url.includes(clientId)
    })
  })
  const codeUrl = getCodeFromUrl(res.url)

  sleepBetween(1, 3)

  // B01_BAV_06_getClientAssertion_IPVStubCall
  res = timeGroup(groups[7], () => http.post(env.BAV.ipvStub + '/generate-token-request'), {
    isStatusCode200
  })
  const client_assertion = getclientassertion(res)

  // B01_BAV_07_SendAuthorizationCodes
  res = timeGroup(
    groups[8],
    () =>
      http.post(env.BAV.target + '/token', {
        grant_type: 'authorization_code',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: client_assertion,
        code: codeUrl,
        redirect_uri: env.BAV.ipvStub + '/redirect?id=bav'
      }),
    { isStatusCode200, ...pageContentCheck('access_token') }
  )

  const accessToken = getAccessToken(res)

  sleepBetween(1, 3)

  const authHeader = `Bearer ${accessToken}`
  const options = {
    headers: { Authorization: authHeader }
  }
  // B01_BAV_08_SendBearerToken
  res = timeGroup(groups[9], () => http.post(env.BAV.target + '/userinfo', {}, options), {
    isStatusCode200,
    ...pageContentCheck('credentialJWT')
  })
  iterationsCompleted.add(1)
}
