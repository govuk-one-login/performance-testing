import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { group } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { selectProfile, type ProfileList, describeProfile, createScenario, LoadProfile } from '../common/utils/config/load-profiles'
import { b64encode } from 'k6/encoding'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { bankingPayload } from './data/BAVdata'
import { getAuthorizeauthorizeLocation, getClientID, getCodeFromUrl, getAccessToken } from './utils/authorization'
import { getEnv } from '../common/utils/config/environment-variables'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('BAV', LoadProfile.smoke)
  },
  load: {
    ...createScenario('BAV', LoadProfile.full, 10)
  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'], // 95th percentile response time <=1000ms, 99th percentile response time <=2500ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
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
  let res: Response
  const testAccountNumber = '00111111'
  const testSortCode = '12-34-56'
  iterationsStarted.add(1)

  res = group('B01_BAV_01_IPVStubCall POST', () =>
    timeRequest(() => http.post(env.BAV.ipvStub + '/start',
      JSON.stringify({ bankingPayload }),
      {
        tags: { name: 'B01_BAV_01_IPVStubCall' }
      }),
    {
      'is status 201': (r) => r.status === 201,
      ...pageContentCheck(b64encode('{"alg":"RSA', 'rawstd'))
    }))
  const authorizeLocation = getAuthorizeauthorizeLocation(res)
  const clientId = getClientID(res)

  res = group('B01_BAV_02_Authorize GET', () =>
    timeRequest(() => http.get(authorizeLocation, {
      tags: { name: 'B01_BAV_02_Authorize' }
    }),
    { isStatusCode200, ...pageContentCheck('Continue to your bank or building society account details') }))

  res = group('B01_BAV_03_Continue POST', () =>
    timeRequest(() =>
      res.submitForm({
        params: { tags: { name: 'B01_BAV_03_Continue' } },
        submitSelector: '#landingPageContinue'
      }),
    { isStatusCode200, ...pageContentCheck('Enter your account details') }))

  sleepBetween(1, 3)

  res = group('B01_BAV_04_BankDetails POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: {
          sortCode: testSortCode,
          accountNumber: testAccountNumber
        },
        params: { tags: { name: 'B01_BAV_04_BankDetails' } },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Check your details match with your bank or building society account') }))

  sleepBetween(1, 3)

  res = group('B01_BAV_05_CheckDetails POST', () =>
    timeRequest(() =>
      res.submitForm({
        params: { tags: { name: 'B01_BAV_05_CheckDetails' } },
        submitSelector: '#submitDetails'
      }),
    {
      'verify url body': (r) =>
        (r.url).includes(clientId)
    }))
  const codeUrl = getCodeFromUrl(res.url)

  sleepBetween(1, 3)

  res = group('B01_BAV_06_SendAuthorizationCode POST', () =>
    timeRequest(() => http.post(env.BAV.target + '/token', {
      grant_type: 'authorization_code',
      code: codeUrl,
      redirect_uri: env.BAV.ipvStub + '/redirect?id=bav'
    }, {
      tags: { name: 'B01_BAV_06_SendAuthorizationCode' }
    }),
    { isStatusCode200, 'verify response body': (r) => (r.body as string).includes('access_token') }))

  const accessToken = getAccessToken(res)

  sleepBetween(1, 3)

  const authHeader = `Bearer ${accessToken}`
  const options = {
    headers: { Authorization: authHeader },
    tags: { name: 'B01_BAV_07_SendBearerToken' }
  }
  res = group('B01_BAV_07_SendBearerToken POST', () =>
    timeRequest(() => http.post(env.BAV.target + '/userinfo', {}, options),
      { isStatusCode200, 'verify response body': (r) => (r.body as string).includes('credentialJWT') }))
  iterationsCompleted.add(1)
}
