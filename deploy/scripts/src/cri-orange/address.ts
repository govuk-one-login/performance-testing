import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { fail, sleep } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI3RegressionScenario,
  createI3SpikeSignUpScenario,
  createI4PeakTestSignUpScenario
} from '../common/utils/config/load-profiles'
import { env, encodedCredentials } from './utils/config'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('address', LoadProfile.smoke),
    ...createScenario('addressME', LoadProfile.smoke),
    ...createScenario('internationalAddress', LoadProfile.smoke),
    ...createScenario('addressAdhocScenario', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('address', LoadProfile.short, 10, 20),
    ...createScenario('internationalAddress', LoadProfile.short, 3, 16)
  },
  stress: {
    ...createScenario('address', LoadProfile.full, 65)
  },
  loadMar2025: {
    ...createScenario('address', LoadProfile.short, 13, 20)
  },
  soakMar2025: {
    ...createScenario('address', LoadProfile.soak, 13, 20)
  },
  spikeNFR: {
    ...createScenario('address', LoadProfile.spikeNFRSignUp, 13, 20)
  },
  spikeSudden: {
    ...createScenario('address', LoadProfile.spikeSudden, 13, 20)
  },
  coreStubIsolatedTest: {
    coreStubCall: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '5m', target: 400 },
        { duration: '5m', target: 400 }
      ],
      exec: 'coreStubCall'
    }
  },
  addressVUTest: {
    addressAdhocScenario: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '5m', target: 10 },
        { duration: '15m', target: 10 },
        { duration: '1m', target: 0 }
      ],
      exec: 'addressAdhocScenario'
    }
  },
  lowVolumePERF007Test: {
    address: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 20, duration: '200s' }, // Target to be updated based on the percentage split confirmed by the app team
        { target: 20, duration: '180s' } // Target to be updated based on the percentage split confirmed by the app team
      ],
      exec: 'address'
    }
  },
  perf006Iteration1: {
    address: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 100, duration: '100s' },
        { target: 100, duration: '15m' }
      ],
      exec: 'address'
    }
  },
  spikeI2HighTraffic: {
    ...createScenario('address', LoadProfile.spikeI2HighTraffic, 35, 20)
  },
  perf006Iteration2PeakTest: {
    address: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 120, duration: '121s' },
        { target: 120, duration: '30m' }
      ],
      exec: 'address'
    }
  },
  perf006Iteration3PeakTest: {
    address: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 75,
      maxVUs: 150,
      stages: [
        { target: 100, duration: '101s' },
        { target: 100, duration: '30m' }
      ],
      exec: 'address'
    },
    addressME: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 45,
      maxVUs: 90,
      stages: [
        { target: 0, duration: '101s' }, // Wait until the happy path scenario ramps up to target load
        { target: 60, duration: '61s' }, // Ramp up to target load
        { target: 60, duration: '30m' } // Maintain a steady state at the target load for 30 minutes.
      ],
      exec: 'addressME'
    }
  },
  perf006RegressionTest: {
    ...createI3RegressionScenario('address', 5, 15, 6)
  },
  perf006Iteration3SpikeTest: {
    ...createI3SpikeSignUpScenario('address', 100, 15, 101),
    ...createI3SpikeSignUpScenario('addressME', 390, 15, 391)
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('address', 100, 15, 101),
    addressME: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 278,
      maxVUs: 555,
      stages: [
        { target: 0, duration: '101s' }, // Wait until the happy path scenario ramps up to target load
        { target: 370, duration: '371s' }, // Ramp up to target load
        { target: 370, duration: '30m' } // Maintain a steady state at the target load for 30 minutes.
      ],
      exec: 'addressME'
    }
  },
  perf006Iteration4SpikeTest: {
    ...createI3SpikeSignUpScenario('address', 100, 15, 101),
    ...createI3SpikeSignUpScenario('addressME', 1030, 15, 1031)
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignUpScenario('address', 100, 15, 101),
    ...createI4PeakTestSignUpScenario('internationalAddress', 6, 12, 7),
    addressME: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 349,
      maxVUs: 698,
      stages: [
        { target: 0, duration: '101s' }, // Wait until the happy path scenario ramps up to target load
        { target: 465, duration: '466s' }, // Ramp up to target load
        { target: 465, duration: '30m' } // Maintain a steady state at the target load for 30 minutes.
      ],
      exec: 'addressME'
    }
  },
  perf006Iteration5SpikeTest: {
    ...createI3SpikeSignUpScenario('address', 100, 15, 101),
    ...createI3SpikeSignUpScenario('addressME', 1018, 15, 1019),
    ...createI3SpikeSignUpScenario('internationalAddress', 12, 12, 13)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('address', 100, 15, 101),
    ...createI4PeakTestSignUpScenario('internationalAddress', 2, 12, 3),
    addressME: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 22,
      maxVUs: 43,
      stages: [
        { target: 0, duration: '101s' }, // Wait until the happy path scenario ramps up to target load
        { target: 78, duration: '79s' }, // Ramp up to target load
        { target: 78, duration: '30m' } // Maintain a steady state at the target load for 30 minutes.
      ],
      exec: 'addressME'
    }
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  address: [
    'B02_Address_01_AddressCRIEntryFromStub',
    'B02_Address_01_AddressCRIEntryFromStub::01_CoreStubCall',
    'B02_Address_01_AddressCRIEntryFromStub::02_AddCRICall',
    'B02_Address_02_SearchPostCode',
    'B02_Address_03_SelectAddress',
    'B02_Address_04_VerifyAddress',
    'B02_Address_05_ConfirmDetails',
    'B02_Address_05_ConfirmDetails::01_AddCRICall',
    'B02_Address_05_ConfirmDetails::02_CoreStubCall'
  ],
  addressME: [
    'B02_AddressME_01_AddressCRIEntryFromStub',
    'B02_AddressME_01_AddressCRIEntryFromStub::01_CoreStubCall',
    'B02_AddressME_01_AddressCRIEntryFromStub::02_AddCRICall',
    'B02_AddressME_02_SearchPostCode',
    'B02_AddressME_03_ContinueWithManulEntryPage',
    'B02_AddressME_04_EnterAddressManually',
    'B02_AddressME_05_ConfirmDetails',
    'B02_AddressME_05_ConfirmDetails::01_AddCRICall',
    'B02_AddressME_05_ConfirmDetails::02_CoreStubCall'
  ],
  coreStubCall: ['01_CoreStubCall'],
  internationalAddress: [
    'B03_InternationalAddress_01_CRIEntryFromStub',
    'B03_InternationalAddress_01_CRIEntryFromStub::01_CoreStubCall',
    'B03_InternationalAddress_01_CRIEntryFromStub::02_CRICall',
    'B03_InternationalAddress_02_SelectCountry',
    'B03_InternationalAddress_03_EnterAddress',
    'B03_InternationalAddress_04_VerifyAddressDetails',
    'B03_InternationalAddress_04_VerifyAddressDetails::01_CRICall',
    'B03_InternationalAddress_04_VerifyAddressDetails::02_CoreStubCall'
  ],
  addressAdhocScenario: [
    'B02_Address_01_AddressCRIEntryFromStub',
    'B02_Address_01_AddressCRIEntryFromStub::01_CoreStubCall',
    'B02_Address_01_AddressCRIEntryFromStub::02_AddCRICall',
    'B02_Address_02_SearchPostCode',
    'B02_Address_03_SelectAddress',
    'B02_Address_04_VerifyAddress',
    'B02_Address_05_ConfirmDetails',
    'B02_Address_05_ConfirmDetails::01_AddCRICall'
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

interface Address {
  postcode: string
}

const csvData1: Address[] = new SharedArray('csvDataAddress', () => {
  return open('./data/addressCRIData.csv')
    .split('\n')
    .slice(1)
    .map(postcode => {
      return {
        postcode
      }
    })
})

const csvData2: Address[] = new SharedArray('csvDataAddressME', () => {
  return open('./data/addressMEData.csv')
    .split('\n')
    .slice(1)
    .map(postcode => {
      return {
        postcode
      }
    })
})

export function address(): void {
  const groups = groupMap.address
  let res: Response
  const user1Address = csvData1[exec.scenario.iterationInTest % csvData1.length]
  iterationsStarted.add(1)

  // B02_Address_01_AddressCRIEntryFromStub
  timeGroup(groups[0], () => {
    // 01_CoreStubCall
    res = timeGroup(
      groups[1].split('::')[1],
      () =>
        http.get(env.ipvCoreStub + '/credential-issuer?cri=address-cri-' + env.envName, {
          redirects: 0,
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode302 }
    )
    // 02_AddCRICall
    res = timeGroup(
      groups[2].split('::')[1],
      () => {
        if (env.staticResources) {
          const paths = [
            '/public/stylesheets/application.css',
            '/public/javascripts/all.js',
            '/public/javascripts/analytics.js',
            '/public/fonts/bold-b542beb274-v2.woff2',
            '/public/fonts/light-94a07e06a1-v2.woff2',
            '/public/images/govuk-crest-2x.png'
          ]
          const batchRequests = paths.map(path => env.addressEndPoint + path)
          http.batch(batchRequests)
        }
        return http.get(res.headers.Location)
      },
      {
        isStatusCode200,
        ...pageContentCheck('Find your address')
      }
    )
  })

  sleep(1)

  // B02_Address_02_SearchPostCode
  res = timeGroup(
    groups[3],
    () =>
      res.submitForm({
        fields: { addressSearch: user1Address.postcode },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Choose your address') }
  )

  const fullAddress = res.html().find('select[name=addressResults]>option').last().val() ?? fail('Address not found')

  // B02_Address_03_SelectAddress
  res = timeGroup(
    groups[4],
    () =>
      res.submitForm({
        fields: { addressResults: fullAddress },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Enter your address') }
  )

  sleep(1)

  // B02_Address_04_VerifyAddress
  res = timeGroup(
    groups[5],
    () =>
      res.submitForm({
        fields: { addressYearFrom: '2021' },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Confirm your details') }
  )

  sleep(1)

  // B02_Address_05_ConfirmDetails
  timeGroup(groups[6], () => {
    // 01_AddCRICall
    res = timeGroup(groups[7].split('::')[1], () => res.submitForm({ params: { redirects: 1 } }), {
      isStatusCode302
    })
    // 02_CoreStubCall
    res = timeGroup(
      groups[8].split('::')[1],
      () =>
        http.get(res.headers.Location, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('Verifiable Credentials') }
    )
  })
  iterationsCompleted.add(1)
}

export function addressME(): void {
  const groups = groupMap.addressME
  let res: Response
  const userAddressME = csvData2[exec.scenario.iterationInTest % csvData2.length]
  const manualAddress = enterAddressDetails()
  iterationsStarted.add(1)

  // B02_AddressME_01_AddressCRIEntryFromStub
  timeGroup(groups[0], () => {
    // 01_CoreStubCall
    res = timeGroup(
      groups[1].split('::')[1],
      () =>
        http.get(env.ipvCoreStub + '/credential-issuer?cri=address-cri-' + env.envName, {
          redirects: 0,
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode302 }
    )
    // 02_AddCRICall
    res = timeGroup(groups[2].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Find your address')
    })
  })

  sleep(1)

  // B02_AddressME_02_SearchPostCode
  res = timeGroup(
    groups[3],
    () =>
      res.submitForm({
        fields: { addressSearch: userAddressME.postcode },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('<p>We cannot find any addresses with the postcode <b>E11 3BW') }
  )

  // B02_AddressME_03_ContinueWithManulEntryPage
  res = timeGroup(
    groups[4],
    () =>
      res.submitForm({
        fields: { addressBreak: 'continue' },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Enter your address') }
  )

  sleep(1)

  // B02_AddressME_04_EnterAddressManually
  res = timeGroup(
    groups[5],
    () =>
      res.submitForm({
        fields: {
          addressFlatNumber: `${manualAddress.flatNumber}`,
          addressHouseNumber: '',
          addressHouseName: manualAddress.houseName,
          addressStreetName: manualAddress.streetName,
          addressLocality: manualAddress.locality,
          addressYearFrom: `${manualAddress.year}`
        },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Confirm your details') }
  )

  sleep(1)

  // B02_AddressME_05_ConfirmDetails
  timeGroup(groups[6], () => {
    // 01_AddCRICall
    res = timeGroup(groups[7].split('::')[1], () => res.submitForm({ params: { redirects: 1 } }), {
      isStatusCode302
    })
    // 02_CoreStubCall
    res = timeGroup(
      groups[8].split('::')[1],
      () =>
        http.get(res.headers.Location, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('VerifiableCredential') }
    )
  })
  iterationsCompleted.add(1)
}

export function coreStubCall(): void {
  const groups = groupMap.coreStubCall
  iterationsStarted.add(1)

  // B01_CoreStubCall
  timeGroup(
    groups[0],
    () =>
      http.get(env.ipvCoreStub + '/credential-issuer?cri=address-cri-' + env.envName, {
        redirects: 0,
        headers: { Authorization: `Basic ${encodedCredentials}` }
      }),
    {
      isStatusCode302,
      validateRedirectLocation: r =>
        (r.headers.Location as string).includes(`${env.addressEndPoint}/oauth2/authorize?request=`)
    }
  )
}

export function internationalAddress(): void {
  const groups = groupMap.internationalAddress
  let res: Response
  iterationsStarted.add(1)

  //B03_InternationalAddress_01_CRIEntryFromStub
  timeGroup(groups[0], () => {
    // 01_CoreStubCall
    res = timeGroup(
      groups[1].split('::')[1],
      () =>
        http.get(env.ipvCoreStub + '/credential-issuer?cri=address-cri-build&context=international_user', {
          redirects: 0,
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode302 }
    )
    // 02_CRICall
    res = timeGroup(groups[2].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('What country do you live in?')
    })
  })

  sleepBetween(1, 3)

  // B03_InternationalAddress_02_SelectCountry
  res = timeGroup(
    groups[3],
    () =>
      res.submitForm({
        fields: { country: 'AU' },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Enter your address') }
  )

  sleepBetween(1, 3)

  // B03_InternationalAddress_03_EnterAddress
  res = timeGroup(
    groups[4],
    () =>
      res.submitForm({
        fields: {
          nonUKAddressApartmentNumber: '100',
          nonUKAddressStreetName: 'Main Street',
          nonUKAddressLocality: 'Melbourne',
          nonUKAddressPostalCode: '3000',
          nonUKAddressYearFrom: '2020'
        },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Confirm your details') }
  )

  sleepBetween(1, 3)

  // B03_InternationalAddress_04_VerifyAddressDetails

  timeGroup(groups[5], () => {
    // 01_CRICall
    res = timeGroup(groups[6].split('::')[1], () => res.submitForm({ params: { redirects: 1 } }), {
      isStatusCode302
    })
    //02_CoreStubCall
    res = timeGroup(
      groups[7].split('::')[1],
      () =>
        http.get(res.headers.Location, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('Verifiable Credentials') }
    )
  })
  iterationsCompleted.add(1)
}

export function addressAdhocScenario(): void {
  const groups = groupMap.address
  let res: Response
  const user1Address = csvData1[exec.scenario.iterationInTest % csvData1.length]
  iterationsStarted.add(1)

  // B02_Address_01_AddressCRIEntryFromStub
  timeGroup(groups[0], () => {
    // 01_CoreStubCall
    res = timeGroup(
      groups[1].split('::')[1],
      () =>
        http.get(env.ipvCoreStub + '/credential-issuer?cri=address-cri-' + env.envName, {
          redirects: 0,
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode302 }
    )
    // 02_AddCRICall
    res = timeGroup(groups[2].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Find your address')
    })
  })

  // B02_Address_02_SearchPostCode
  res = timeGroup(
    groups[3],
    () =>
      res.submitForm({
        fields: { addressSearch: user1Address.postcode },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Choose your address') }
  )

  const fullAddress = res.html().find('select[name=addressResults]>option').last().val() ?? fail('Address not found')

  // B02_Address_03_SelectAddress
  res = timeGroup(
    groups[4],
    () =>
      res.submitForm({
        fields: { addressResults: fullAddress },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Enter your address') }
  )

  // B02_Address_04_VerifyAddress
  res = timeGroup(
    groups[5],
    () =>
      res.submitForm({
        fields: { addressYearFrom: '2021' },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Confirm your details') }
  )

  // B02_Address_05_ConfirmDetails
  timeGroup(groups[6], () => {
    // 01_AddCRICall
    res = timeGroup(groups[7].split('::')[1], () => res.submitForm({ params: { redirects: 1 } }), {
      isStatusCode302
    })
    /* // Commenting the final stub call.
    // 02_CoreStubCall
    res = timeGroup(
      groups[8].split('::')[1],
      () =>
        http.get(res.headers.Location, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('Verifiable Credentials') }
    )*/
  })
  iterationsCompleted.add(1)
}

interface AddressME {
  flatNumber: number
  houseName: string
  streetName: string
  locality: string
  year: number
}

function enterAddressDetails(): AddressME {
  return {
    flatNumber: Math.floor(Math.random() * 100) + 1,
    houseName: `RandomBuilding${Math.floor(Math.random() * 99998) + 1}`,
    streetName: `RandomStreet${Math.floor(Math.random() * 99998) + 1}`,
    locality: `RandomCity${Math.floor(Math.random() * 999) + 1}`,
    year: Math.floor(Math.random() * 71) + 1950
  }
}
