import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { group } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { b64encode } from 'k6/encoding'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { bankingPayload } from './data/BAVdata'
import { getAuthorizeauthorizeLocation, getClientID, getCodeFromUrl, getAccessToken } from './utils/authorization'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    BAV: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'BAV'
    }
  },
  load: {
    BAV: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 300,
      stages: [
        { target: 10, duration: '15m' }, // Ramps up to target load
        { target: 10, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 10 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'BAV'
    }
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
    'B01_BAV_06_SendAuthorizationCode',
    'B01_BAV_07_SendBearerToken'
  ]
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup (): void {
  describeProfile(loadProfile)
}

const env = {
  BAV: {
    ipvStub: getEnv('IDENTITY_KIWI_BAV_STUB_URL'),
    target: getEnv('IDENTITY_KIWI_BAV_TARGET')
  }
}

export function BAV (): void {
  const groups = groupMap.BAV
  let res: Response
  const testAccountNumber = '31926819'
  const testSortCode = '12-34-56'
  iterationsStarted.add(1)

  res = group(groups[0], () => timeRequest(() => // B01_BAV_01_IPVStubCall
    http.post(env.BAV.ipvStub + '/start',
      JSON.stringify({ bankingPayload })),
  {
    'is status 201': (r) => r.status === 201,
    ...pageContentCheck(b64encode('{"alg":"RSA', 'rawstd'))
  }))
  const authorizeLocation = getAuthorizeauthorizeLocation(res)
  const clientId = getClientID(res)

  res = group(groups[1], () => timeRequest(() => // B01_BAV_02_Authorize
    http.get(authorizeLocation),
  { isStatusCode200, ...pageContentCheck('Continue to your bank or building society account details') }))

  res = group(groups[2], () => timeRequest(() => // B01_BAV_03_Continue
    res.submitForm({
      submitSelector: '#landingPageContinue'
    }),
  { isStatusCode200, ...pageContentCheck('Enter your account details') }))

  sleepBetween(1, 3)

  res = group(groups[3], () => timeRequest(() => // B01_BAV_04_BankDetails
    res.submitForm({
      fields: {
        sortCode: testSortCode,
        accountNumber: testAccountNumber
      },
      submitSelector: '#continue'
    }),
  { isStatusCode200, ...pageContentCheck('Check your details match with your bank or building society account') }))

  sleepBetween(1, 3)

  res = group(groups[4], () => timeRequest(() => // B01_BAV_05_CheckDetails
    res.submitForm({
      submitSelector: '#submitDetails'
    }),
  {
    'verify url body': (r) =>
      (r.url).includes(clientId)
  }))
  const codeUrl = getCodeFromUrl(res.url)

  sleepBetween(1, 3)

  res = group(groups[5], () => timeRequest(() => // B01_BAV_06_SendAuthorizationCode
    http.post(env.BAV.target + '/token', {
      grant_type: 'authorization_code',
      code: codeUrl,
      redirect_uri: env.BAV.ipvStub + '/redirect?id=bav'
    }),
  { isStatusCode200, 'verify response body': (r) => (r.body as string).includes('access_token') }))

  const accessToken = getAccessToken(res)

  sleepBetween(1, 3)

  const authHeader = `Bearer ${accessToken}`
  const options = {
    headers: { Authorization: authHeader }
  }
  res = group(groups[6], () => timeRequest(() => // B01_BAV_07_SendBearerToken
    http.post(env.BAV.target + '/userinfo', {}, options),
  { isStatusCode200, 'verify response body': (r) => (r.body as string).includes('credentialJWT') }))
  iterationsCompleted.add(1)
}
