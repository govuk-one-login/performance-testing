import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { fail } from 'k6'
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
  createMeasureScenario
} from '../common/utils/config/load-profiles'
import { env, encodedCredentials } from './utils/config'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('address', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('address', LoadProfile.short, 5)
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
  measure:  {
    ...createMeasureScenario('address', 3000 )
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
  ]
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
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

export function address(): void {
  let res: Response
  const user1Address = csvData1[exec.scenario.iterationInTest % csvData1.length]
  iterationsStarted.add(1)

  // B02_Address_01_AddressCRIEntryFromStub
res = http.get(env.ipvCoreStub + '/credential-issuer?cri=address-cri-' + env.envName, {
        redirects: 0,
        headers: { Authorization: `Basic ${encodedCredentials}` }
    }),
    { isStatusCode302 }
// 02_AddCRICall
res = http.get(res.headers.Location),
    {
    isStatusCode200,
    ...pageContentCheck('Find your address')
    }
  // B02_Address_02_SearchPostCode
res = res.submitForm({
    fields: { addressSearch: user1Address.postcode },
    submitSelector: '#continue'
    }),
    { isStatusCode200, ...pageContentCheck('Choose your address') }

const fullAddress = res.html().find('select[name=addressResults]>option').last().val() ?? fail('Address not found')
console.log(fullAddress);
//?? fail('Address not found')

res = res.submitForm({
    fields: { addressResults: fullAddress },
      submitSelector: '#continue'
    }),
    { isStatusCode200, ...pageContentCheck('Check your address') }

res = res.submitForm({
    fields: { addressYearFrom: '2021' },
    submitSelector: '#continue'
    }),
    { isStatusCode200, ...pageContentCheck('Confirm your details') }


  // B02_Address_05_ConfirmDetails
    // 01_AddCRICall
res = res.submitForm({ params: { redirects: 1 } }), {
      isStatusCode302
    }
    // 02_CoreStubCall
    res =  http.get(res.headers.Location, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('Verifiable Credentials') }

  iterationsCompleted.add(1)
}

export default address;