import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { group, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { env, encodedCredentials } from './utils/config'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    addressScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '30s' } // Ramps up to target load
      ],
      exec: 'addressScenario1'
    }
  },
  lowVolumeTest: {
    addressScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 900,
      stages: [
        { target: 30, duration: '5m' }, // Ramp up to 30 iterations per second in 5 minutes
        { target: 30, duration: '15m' }, // Maintain steady state at 30 iterations per second for 15 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'addressScenario1'
    }
  },
  stress: {
    addressScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1935,
      stages: [
        { target: 65, duration: '15m' }, // Ramp up to 65 iterations per second in 15 minutes
        { target: 65, duration: '30m' }, // Maintain steady state at 65 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'addressScenario1'
    }
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  addressScenario1: [
    'B02_Address_01_AddressCRIEntryFromStub',
    'B02_Address_02_SearchPostCode',
    'B02_Address_03_SelectAddress',
    'B02_Address_04_VerifyAddress',
    'B02_Address_05_ConfirmDetails',
    'B02_Address_05_ConfirmDetails::01_AddCRICall',
    'B02_Address_05_ConfirmDetails::02_CoreStubCall'
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

export function addressScenario1 (): void {
  const groups = groupMap.addressScenario1
  let res: Response
  const user1Address = csvData1[exec.scenario.iterationInTest % csvData1.length]
  iterationsStarted.add(1)

  res = group(groups[0], () => timeRequest(() => // B02_Address_01_AddressCRIEntryFromStub
    http.get(
      env.ipvCoreStub + '/credential-issuer?cri=address-cri-' + env.envName,
      {
        headers: { Authorization: `Basic ${encodedCredentials}` }
      }),
  { isStatusCode200, ...pageContentCheck('Find your address') }))

  sleepBetween(1, 3)

  res = group(groups[1], () => timeRequest(() => // B02_Address_02_SearchPostCode
    res.submitForm({
      fields: { addressSearch: user1Address.postcode },
      submitSelector: '#continue'
    }),
  { isStatusCode200, ...pageContentCheck('Choose your address') }))

  const fullAddress = res.html().find('select[name=addressResults]>option').last().val() ?? fail('Address not found')

  res = group(groups[2], () => timeRequest(() => // B02_Address_03_SelectAddress
    res.submitForm({
      fields: { addressResults: fullAddress },
      submitSelector: '#continue'
    }),
  { isStatusCode200, ...pageContentCheck('Check your address') }))

  sleepBetween(1, 3)

  res = group(groups[3], () => timeRequest(() => // B02_Address_04_VerifyAddress
    res.submitForm({
      fields: { addressYearFrom: '2021' },
      submitSelector: '#continue'
    }),
  { isStatusCode200, ...pageContentCheck('Confirm your details') }))

  sleepBetween(1, 3)

  group(groups[4], () => { // B02_Address_05_ConfirmDetails
    timeRequest(() => {
      res = group(groups[5].split('::')[1], () => timeRequest(() => // 01_AddCRICall
        res.submitForm({ params: { redirects: 1 } }), { isStatusCode302 }))
      res = group(groups[6].split('::')[1], () => timeRequest(() => // 02_CoreStubCall
        http.get(res.headers.Location, { headers: { Authorization: `Basic ${encodedCredentials}` } }),
      { isStatusCode200, ...pageContentCheck('Verifiable Credentials') }))
    }, {})
  })
  iterationsCompleted.add(1)
}
