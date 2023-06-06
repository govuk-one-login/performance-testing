import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import encoding from 'k6/encoding'
import { Trend } from 'k6/metrics'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'

const profiles: ProfileList = {
  smoke: {
    kbvScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'kbvScenario1'
    },

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
  load: {
    kbvScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1500,
      stages: [
        { target: 30, duration: '10m' } // Ramp up to 30 iterations per second in 10 minutes
      ],
      exec: 'kbvScenario1'
    },

    addressScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1500,
      stages: [
        { target: 30, duration: '10m' } // Ramp up to 30 iterations per second in 10 minutes
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

const env = {
  ipvCoreStub: __ENV.CORE_STUB_URL,
  kbvEndPoint: __ENV.KBV_URL,
  addressEndPoint: __ENV.ADDRESS_URL,
  kbvEnvName: __ENV.KBV_ENV_NAME,
  addressEnvName: __ENV.ADDRESS_ENV_NAME
}

const stubCreds = {
  userName: __ENV.CORE_STUB_USERNAME,
  password: __ENV.CORE_STUB_PASSWORD
}

interface Address {
  postcode: string
}

const csvData1: Address[] = new SharedArray('csvDataAddress', function () {
  return open('./data/addressCRIData.csv').split('\n').slice(1).map((postcode) => {
    return {
      postcode
    }
  })
})

const transactionDuration = new Trend('duration')

export function kbvScenario1 (): void {
  let res: Response
  let csrfToken: string
  const userDetails = getUserDetails()
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)

  group(
    'B01_KBV_01_CoreStubEditUserContinue POST',
    function () {
      const startTime = Date.now()
      res = http.post(
        env.ipvCoreStub + '/edit-user',
        {
          cri: env.kbvEnvName,
          rowNumber: '197',
          firstName: userDetails.firstName,
          surname: userDetails.lastName,
          'dateOfBirth-day': `${userDetails.day}`,
          'dateOfBirth-month': `${userDetails.month}`,
          'dateOfBirth-year': `${userDetails.year}`,
          buildingNumber: `${userDetails.buildNum}`,
          buildingName: userDetails.buildName,
          street: userDetails.street,
          townCity: userDetails.city,
          postCode: userDetails.postCode,
          validFromDay: '26',
          validFromMonth: '02',
          validFromYear: '2021',
          validUntilDay: '',
          validUntilMonth: '',
          validUntilYear: '',
          'SecondaryUKAddress.buildingNumber': '',
          'SecondaryUKAddress.buildingName': '',
          'SecondaryUKAddress.street': '',
          'SecondaryUKAddress.townCity': '',
          'SecondaryUKAddress.postCode': '',
          'SecondaryUKAddress.validFromDay': '',
          'SecondaryUKAddress.validFromMonth': '',
          'SecondaryUKAddress.validFromYear': '',
          'SecondaryUKAddress.validUntilDay': '',
          'SecondaryUKAddress.validUntilMonth': '',
          'SecondaryUKAddress.validUntilYear': ''
        },
        {
          headers: { Authorization: `Basic ${encodedCredentials}` },
          tags: { name: 'B01_KBV_01_CoreStubEditUserContinue' }
        }
      )
      const endTime = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('Question 1')
      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')

      csrfToken = getCSRF(res)
    }
  )

  sleep(Math.random() * 3)

  group('B01_KBV_02_KBVQuestion1 POST', function () {
    const startTime = Date.now()
    res = http.post(
      env.kbvEndPoint + '/kbv/question',
      {
        Q00001: 'Correct 1',
        continue: '',
        'x-csrf-token': csrfToken
      },
      {
        tags: { name: 'B01_KBV_02_KBVQuestion1' }
      }
    )
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('User data incorrect')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B01_KBV_02_KBVQuestion2 POST', function () {
    const startTime1 = Date.now()
    res = http.post(
      env.kbvEndPoint + '/kbv/question',
      {
        Q00002: 'Correct 2',
        continue: '',
        'x-csrf-token': csrfToken
      },
      {
        redirects: 2,
        tags: { name: 'B01_KBV_02_KBVQuestion2_KBVCall' }
      }
    )
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location,
      {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B01_KBV_02_KBVQuestion2_CoreStubCall' }
      }
    )
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Verifiable Credentials')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })
}

export function addressScenario1 (): void {
  let res: Response
  let csrfToken: string
  let fullAddress: string
  let addDetails: any
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)

  const user1Address = csvData1[exec.scenario.iterationInTest % csvData1.length]

  group(
    'B02_Address_01_AddressCRIEntryFromStub  GET',
    function () {
      const startTime = Date.now()
      res = http.get(
        env.ipvCoreStub + `/credential-issuer?cri=${env.addressEnvName}`,
        {
          headers: { Authorization: `Basic ${encodedCredentials}` },
          tags: { name: 'B02_Address_01_AddressCRIEntryFromStub' }
        }
      )
      const endTime = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('Find your address')
      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')

      csrfToken = getCSRF(res)
    }
  )

  sleep(Math.random() * 3)

  group('B02_Address_02_SearchPostCode POST', function () {
    const startTime = Date.now()
    res = http.post(
      env.addressEndPoint + '/search',
      {
        addressSearch: user1Address.postcode,
        continue: '',
        'x-csrf-token': csrfToken
      },
      {
        tags: { name: 'B02_Address_02_SearchPostCode' }
      }
    )
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Choose your address')
    }
    )
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    fullAddress = res.html().find('select[name=addressResults]>option').last().val() ?? fail('Address not found')

    csrfToken = getCSRF(res)
  })

  group('B02_Address_03_SelectAddress POST', function () {
    const startTime = Date.now()
    res = http.post(
      env.addressEndPoint + '/results',
      {
        addressResults: fullAddress,
        continue: '',
        'x-csrf-token': csrfToken
      },
      {
        tags: { name: 'B02_Address_03_SelectAddress' }
      }
    )
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Check your address')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    addDetails = getAddressDetails(res)
    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B02_Address_04_VerifyAddress POST', function () {
    const startTime = Date.now()
    res = http.post(
      env.addressEndPoint + '/address',
      {
        addressFlatNumber: addDetails.flatNumber,
        addressHouseNumber: addDetails.houseNumber,
        addressHouseName: addDetails.houseName,
        adddressStreetName: addDetails.streetName,
        addressLocality: addDetails.town,
        addressYearFrom: '2021',
        continue: '',
        'x-csrf-token': csrfToken
      },
      {
        tags: { name: 'B02_Address_04_VerifyAddress' }
      }
    )
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Confirm your details')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B02_Address_05_ConfirmDetails POST', function () {
    const startTime1 = Date.now()
    res = http.post(
      env.addressEndPoint + '/summary/confirm',
      {
        'x-csrf-token': csrfToken
      },
      {
        redirects: 1,
        tags: { name: 'B02_Address_05_ConfirmDetails_AddCRICall' }
      }
    )
    const endTime1 = Date.now()

    check(res, {
      'is status 302': (r) => r.status === 302
    })
      ? transactionDuration.add(endTime1 - startTime1)
      : fail('Response Validation Failed')

    const startTime2 = Date.now()
    res = http.get(res.headers.Location,
      {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B02_Address_05_ConfirmDetails_CoreStubCall' }
      }
    )
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Verifiable Credentials')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })
}

function getCSRF (r: Response): string {
  return r.html().find("input[name='x-csrf-token']").val() ?? ''
}

interface AddressDetails {
  flatNumber: string
  houseNumber: string
  houseName: string
  streetName: string
  town: string
}

function getAddressDetails (r: Response): AddressDetails {
  const html = r.html()
  return {
    flatNumber: html.find("input[name='addressFlatNumber']").val() ?? '',
    houseNumber: html.find("input[name='addressHouseNumber']").val() ?? '',
    houseName: html.find("input[name='addressHouseName']").val() ?? '',
    streetName: html.find("input[name='addressStreetName']").val() ?? '',
    town: html.find("input[name='addressLocality']").val() ?? ''
  }
}

interface User {
  firstName: string
  lastName: string
  day: number
  month: number
  year: number
  buildNum: number
  buildName: string
  street: string
  city: string
  postCode: string
}

function getUserDetails (): User {
  return {
    firstName: `perfFirst${Math.floor(Math.random() * 99998) + 1}`,
    lastName: `perfLast${Math.floor(Math.random() * 99998) + 1}`,
    day: Math.floor(Math.random() * 29) + 1,
    month: Math.floor(Math.random() * 12) + 1,
    year: Math.floor(Math.random() * 71) + 1950,
    buildNum: Math.floor(Math.random() * 999) + 1,
    buildName: `RandomBuilding${Math.floor(Math.random() * 99998) + 1}`,
    street: `RandomgStreet${Math.floor(Math.random() * 99998) + 1}`,
    city: `RandomCity${Math.floor(Math.random() * 999) + 1}`,
    postCode: `AB${Math.floor(Math.random() * 99) + 1} CD${Math.floor(Math.random() * 99) + 1}`
  }
}
