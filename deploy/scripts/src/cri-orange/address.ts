import { sleep, group, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { Trend } from 'k6/metrics'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { env, encodedCredentials } from './utils/config'
import { isStatusCode200, isStatusCode302, validatePageContent } from './utils/assertions'

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

const transactionDuration = new Trend('duration', true)

export function addressScenario1 (): void {
  let res: Response
  let fullAddress: string
  const user1Address = csvData1[exec.scenario.iterationInTest % csvData1.length]

  group('B02_Address_01_AddressCRIEntryFromStub  GET', () => {
    const startTime = Date.now()
    res = http.get(
      env.ipvCoreStub + '/credential-issuer?cri=address-cri-' + env.envName,
      {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B02_Address_01_AddressCRIEntryFromStub' }
      }
    )
    const endTime = Date.now()
    isStatusCode200(res) && validatePageContent(res, 'Find your address')
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_Address_02_SearchPostCode POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      fields: { addressSearch: user1Address.postcode },
      submitSelector: '#continue',
      params: { tags: { name: 'B02_Address_02_SearchPostCode' } }
    })
    const endTime = Date.now()
    isStatusCode200(res) && validatePageContent(res, 'Choose your address')
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    fullAddress = res.html().find('select[name=addressResults]>option').last().val() ?? fail('Address not found')
  })

  group('B02_Address_03_SelectAddress POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      fields: { addressResults: fullAddress },
      submitSelector: '#continue',
      params: { tags: { name: 'B02_Address_03_SelectAddress' } }
    })
    const endTime = Date.now()
    isStatusCode200(res) && validatePageContent(res, 'Check your address')
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_Address_04_VerifyAddress POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      fields: { addressYearFrom: '2021' },
      submitSelector: '#continue',
      params: { tags: { name: 'B02_Address_04_VerifyAddress' } }
    })
    const endTime = Date.now()
    isStatusCode200(res) && validatePageContent(res, 'Confirm your details')
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_Address_05_ConfirmDetails POST', () => {
    const startTime1 = Date.now()
    res = res.submitForm({
      params: {
        redirects: 1,
        tags: { name: 'B02_Address_05_ConfirmDetails_AddCRI' }
      }
    })
    const endTime1 = Date.now()
    isStatusCode302(res)
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location,
      {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B02_Address_05_ConfirmDetails_CoreStub' }
      }
    )
    const endTime2 = Date.now()
    isStatusCode200(res) && validatePageContent(res, 'Verifiable Credentials')
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })
}
