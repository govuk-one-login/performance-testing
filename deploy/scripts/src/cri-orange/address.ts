import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { group, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import { selectProfile, type ProfileList, describeProfile, createScenario, LoadProfile } from '../common/utils/config/load-profiles'
import { env, encodedCredentials } from './utils/config'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('address', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('address', LoadProfile.short, 30)
  },
  stress: {
    ...createScenario('address', LoadProfile.full, 65)
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

interface Address {
  postcode: string
}

const csvData1: Address[] = new SharedArray('csvDataAddress', () => {
  return open('./data/addressCRIData.csv').split('\n').slice(1).map((postcode) => {
    return {
      postcode
    }
  })
})

export function address (): void {
  let res: Response
  const user1Address = csvData1[exec.scenario.iterationInTest % csvData1.length]
  iterationsStarted.add(1)

  res = group('B02_Address_01_AddressCRIEntryFromStub  GET', () =>
    timeRequest(() => http.get(
      env.ipvCoreStub + '/credential-issuer?cri=address-cri-' + env.envName,
      {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B02_Address_01_AddressCRIEntryFromStub' }
      }),
    { isStatusCode200, ...pageContentCheck('Find your address') }))

  sleepBetween(1, 3)

  res = group('B02_Address_02_SearchPostCode POST', () =>
    timeRequest(() => res.submitForm({
      fields: { addressSearch: user1Address.postcode },
      submitSelector: '#continue',
      params: { tags: { name: 'B02_Address_02_SearchPostCode' } }
    }),
    { isStatusCode200, ...pageContentCheck('Choose your address') }))

  const fullAddress = res.html().find('select[name=addressResults]>option').last().val() ?? fail('Address not found')

  res = group('B02_Address_03_SelectAddress POST', () =>
    timeRequest(() => res.submitForm({
      fields: { addressResults: fullAddress },
      submitSelector: '#continue',
      params: { tags: { name: 'B02_Address_03_SelectAddress' } }
    }),
    { isStatusCode200, ...pageContentCheck('Check your address') }))

  sleepBetween(1, 3)

  res = group('B02_Address_04_VerifyAddress POST', () =>
    timeRequest(() => res.submitForm({
      fields: { addressYearFrom: '2021' },
      submitSelector: '#continue',
      params: { tags: { name: 'B02_Address_04_VerifyAddress' } }
    }),
    { isStatusCode200, ...pageContentCheck('Confirm your details') }))

  sleepBetween(1, 3)

  group('B02_Address_05_ConfirmDetails POST', () => {
    res = timeRequest(() => res.submitForm({
      params: {
        redirects: 1,
        tags: { name: 'B02_Address_05_ConfirmDetails_AddCRI' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location,
      {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B02_Address_05_ConfirmDetails_CoreStub' }
      }),
    { isStatusCode200, ...pageContentCheck('Verifiable Credentials') })
  })
  iterationsCompleted.add(1)
}
