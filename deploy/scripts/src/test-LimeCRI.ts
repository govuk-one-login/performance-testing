import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import encoding from 'k6/encoding'
import { Trend } from 'k6/metrics'
import { selectProfile, type ProfileList, describeProfile } from './utils/config/load-profiles'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'

const profiles: ProfileList = {
  smoke: {
    fraudScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '10s' } // Ramps up to target load
      ],
      exec: 'fraudScenario1'
    },
    passportScenario: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '10s' } // Ramps up to target load
      ],
      exec: 'passportScenario'
    }

  },
  load: {
    fraudScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1500,
      stages: [
        { target: 30, duration: '10m' } // Ramp up to 30 iterations per second in 10 minutes
      ],
      exec: 'fraudScenario1'
    },

    passportScenario: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1500,
      stages: [
        { target: 30, duration: '10m' } // Ramp up to 30 iterations per second in 10 minutes
      ],
      exec: 'passportScenario'
    }

  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
  // httpDebug: 'full',
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95th percntile response time <1000ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
}

export function setup (): void {
  describeProfile(loadProfile)
}

const env = {
  ipvCoreStub: __ENV.coreStub,
  fraudEndPoint: __ENV.fraudURL,
  // https://staging-di-ipv-orchestrator-stub.london.cloudapps.digital
  orchestratorCoreStub: __ENV.orchCoreStub,
  // https://identity.staging.account.gov.uk
  identityStagingUrl: __ENV.idStagingUrl,
  // https://review-p.staging.account.gov.uk
  reviewStagingUrl: __ENV.rvwStaginUrl

}

const stubCreds = {
  userName: __ENV.CORE_STUB_USERNAME,
  password: __ENV.CORE_STUB_PASSWORD
}

interface PassportUser {
  passportNumber: string
  surname: string
  firstName: string
  middleName: string
  birthday: string
  birthmonth: string
  birthyear: string
  expiryDay: string
  expiryMonth: string
  expiryYear: string
}

const csvData1: PassportUser[] = new SharedArray('csvDataPasport', function () {
  return open('./data/passportData.csv').split('\n').slice(1).map((s) => {
    const data = s.split(',')
    return {
      passportNumber: data[0],
      surname: data[1],
      firstName: data[2],
      middleName: data[3],
      birthday: data[4],
      birthmonth: data[5],
      birthyear: data[6],
      expiryDay: data[7],
      expiryMonth: data[8],
      expiryYear: data[9]
    }
  })
})

const transactionDuration = new Trend('duration')

export function fraudScenario1 (): void {
  let res: Response
  let csrfToken: string
  const userDetails = getUserDetails()
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)

  group(
    'B01_Fraud_01_CoreStubEditUserContinue POST',
    function () {
      const startTime = Date.now()
      res = http.post(
        env.ipvCoreStub + '/edit-user',
        {
          cri: 'fraud-cri-build',
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
          tags: { name: 'B01_Fraud_01_CoreStubEditUserContinue' }
        }
      )
      const endTime = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('We need to check your details')
      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')

      csrfToken = getCSRF(res)
    }
  )

  sleep(Math.random() * 3)

  group('B01_Fraud_02_ContinueToCheckFraudDetails POST', function () {
    const startTime1 = Date.now()
    res = http.post(
      env.fraudEndPoint + '/check',
      {
        continue: '',
        'x-csrf-token': csrfToken
      },
      {
        redirects: 1,
        tags: { name: 'B01_Fraud_02_ContinueToCheckFraudDetails1' }
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
        tags: { name: 'B01_Fraud_02_ContinueToCheckFraudDetails2' }
      }
    )
    const endTime2 = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Verifiable Credentials')
    })
      ? transactionDuration.add(endTime2 - startTime2)
      : fail('Response Validation Failed')
  })
}

export function passportScenario (): void {
  let res: Response
  let csrfToken: string

  const user1Passport = csvData1[exec.scenario.iterationInTest % csvData1.length]

  // console.log(JSON.stringify(user1Passport))
  console.log(`${user1Passport.passportNumber},${user1Passport.surname},${user1Passport.firstName},${user1Passport.middleName},${user1Passport.birthday},${user1Passport.birthmonth},${user1Passport.birthyear},${user1Passport.expiryDay},${user1Passport.expiryMonth},${user1Passport.expiryYear}`)

  group('B03_Passport_01_OrchestratorStub GET',
    function () {
      const startTime = Date.now()
      res = http.get(env.orchestratorCoreStub)

      const endTime = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('Orchestrator Stub')

      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')
    })

  sleep(Math.random() * 3)

  group('B03_Passport_02_debugRoute GET',
    function () {
      const startTime = Date.now()
      res = http.get(env.orchestratorCoreStub + '/authorize?journeyType=debug')

      const endTime = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('ukPassport')

      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Respone Validation Failed')
    })

  sleep(Math.random() * 3)

  group('B03_Passport_03_ukPassport GET',
    function () {
      const startTime = Date.now()
      res = http.get(env.identityStagingUrl + '/ipv/journey/cri/build-oauth-request/ukPassport')

      const endTime = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('Enter your details exactly as they appear on your UK passport')
      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')
      csrfToken = getCSRF(res)
    })

  sleep(Math.random() * 3)

  group('B03_Passport_04_passportDetails POST',
    function () {
      const startTime = Date.now()
      res = http.post(env.reviewStagingUrl + '/passport/details',
        {
          passportNumber: user1Passport.passportNumber,
          surname: user1Passport.surname,
          firstName: user1Passport.firstName,
          middleNames: user1Passport.middleName,
          'dateOfBirth-day': user1Passport.birthday,
          'dateOfBirth-month': user1Passport.birthmonth,
          'dateOfBirth-year': user1Passport.birthyear,
          'expiryDate-day': user1Passport.expiryDay,
          'expiryDate-month': user1Passport.expiryMonth,
          'expiryDate-year': user1Passport.expiryYear,
          'x-csrf-token': csrfToken

        })
      const endTime = Date.now()
      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('GPG45 Score')
      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')
    }
  )
}

function getCSRF (r: Response): string {
  return r.html().find("input[name='x-csrf-token']").val() ?? ''
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
    street: `RandomStreet${Math.floor(Math.random() * 99998) + 1}`,
    city: `RandomCity${Math.floor(Math.random() * 999) + 1}`,
    postCode: `AB${Math.floor(Math.random() * 99) + 1} CD${Math.floor(Math.random() * 99) + 1}`
  }
}
