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
    fraudScenario1: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'fraudScenario1'
    },
    drivingScenario: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '10s' } // Ramps up to target load
      ],
      exec: 'drivingScenario'
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
      maxVUs: 350,
      stages: [
        { target: 10, duration: '30m' }, // Ramp up to 10 iterations per second in 10 minutes
        { target: 10, duration: '15m' }, // Steady State of 15 minutes at the ramp up load i.e 10 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'fraudScenario1'
    },
    drivingScenario: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1500,
      stages: [
        { target: 30, duration: '10m' } // Ramp up to 30 iterations per second in 10 minutes
      ],
      exec: 'drivingScenario'
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
  ipvCoreStub: __ENV.IDENTITY_coreStub,
  fraudEndPoint: __ENV.IDENTITY_fraudURL,
  drivingUrl: __ENV.IDENTITY_drivingUrl,
  drivingEndpoint: __ENV.IDENTITY_drivingEnd,
  orchestratorCoreStub: __ENV.IDENTITY_orchCoreStub,
  ipvCoreURL: __ENV.IDENTITY_coreURL,
  passportURL: __ENV.IDENTITY_passportURL

}

const stubCreds = {
  userName: __ENV.IDENTITY_STUB_USERNAME,
  password: __ENV.IDENTITY_STUB_PASSWORD
}

interface DrivingLicenseUser {
  surname: string
  firstName: string
  middleName: string
  birthday: string
  birthmonth: string
  birthyear: string
  issueDay: string
  issueMonth: string
  issueYear: string
  expiryDay: string
  expiryMonth: string
  expiryYear: string
  drivingLicenceNumber: string
  postcode: string
}

interface DrivingLicenseUserDVLA extends DrivingLicenseUser {
  issueNumber: string
}
interface DrivingLicenseUserDVA extends DrivingLicenseUser {}

const csvData1: DrivingLicenseUserDVLA[] = new SharedArray('csvDataLicenceDVLA', function () {
  return open('./data/drivingLicenceDVLAData.csv').split('\n').slice(1).map((s) => {
    const data = s.split(',')
    return {
      surname: data[0],
      firstName: data[1],
      middleName: data[2],
      birthday: data[3],
      birthmonth: data[4],
      birthyear: data[5],
      issueDay: data[6],
      issueMonth: data[7],
      issueYear: data[8],
      expiryDay: data[9],
      expiryMonth: data[10],
      expiryYear: data[11],
      drivingLicenceNumber: data[12],
      issueNumber: data[13],
      postcode: data[14]
    }
  })
})

const csvData2: DrivingLicenseUserDVA[] = new SharedArray('csvDataLicenceDVA', function () {
  return open('./data/drivingLicenceDVAData.csv').split('\n').slice(1).map((s) => {
    const data = s.split(',')
    return {

      surname: data[0],
      firstName: data[1],
      middleName: data[2],
      birthday: data[3],
      birthmonth: data[4],
      birthyear: data[5],
      issueDay: data[6],
      issueMonth: data[7],
      issueYear: data[8],
      expiryDay: data[9],
      expiryMonth: data[10],
      expiryYear: data[11],
      drivingLicenceNumber: data[12],
      postcode: data[13]
    }
  })
})

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

const csvDataPassport: PassportUser[] = new SharedArray('csvDataPasport', function () {
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

export function drivingScenario (): void {
  let res: Response
  let csrfToken: string
  type drivingLicenceIssuer = 'DVA' | 'DVLA'
  const optionLicence: drivingLicenceIssuer = (Math.random() <= 0.5) ? 'DVA' : 'DVLA'
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)

  const user1DVLA = csvData1[exec.scenario.iterationInTest % csvData1.length]
  const user1DVA = csvData2[exec.scenario.iterationInTest % csvData2.length]

  group('B02_Driving_01_CoreStub GET',
    function () {
      const startTime = Date.now()
      res = http.get(env.ipvCoreStub + '/authorize?cri=' +
        env.drivingEndpoint + '&rowNumber=5',
      {
        headers: { Authorization: `Basic ${encodedCredentials}` },
        tags: { name: 'B02_Driving_01_CoreStuB' }
      })

      const endTime = Date.now()

      check(res, {
        'is status 200': (r) => r.status === 200,
        'verify page content': (r) => (r.body as string).includes('Who was your UK driving licence issued by?')
      })
        ? transactionDuration.add(endTime - startTime)
        : fail('Response Validation Failed')
      csrfToken = getCSRF(res)
    })

  sleep(Math.random() * 3)

  switch (optionLicence) {
    case 'DVLA':
      group('B02_Driving_02_SelectingOption_DVLA_POST', function () {
        const startTime = Date.now()
        res = http.post(env.drivingUrl + '/licence-issuer',
          {
            licenceIssuerRadio: 'DVLA',
            submitButton: '',
            'x-csrf-token': csrfToken
          })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) => (r.body as string).includes('Enter your details exactly as they appear on your UK driving licence')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
        csrfToken = getCSRF(res)
      })

      sleep(1)

      group('B02_Driving_03_DVLA_EditUser POST', function () {
        const startTime = Date.now()

        res = http.post(env.drivingUrl + '/details', {

          surname: user1DVLA.surname,
          firstName: user1DVLA.firstName,
          middleNames: user1DVLA.middleName,
          'dateOfBirth-day': user1DVLA.birthday,
          'dateOfBirth-month': user1DVLA.birthmonth,
          'dateOfBirth-year': user1DVLA.birthyear,
          dvlaDependent: 'DVLA',
          'issueDate-day': user1DVLA.issueDay,
          'issueDate-month': user1DVLA.issueMonth,
          'issueDate-year': user1DVLA.issueYear,
          'expiryDate-day': user1DVLA.expiryDay,
          'expiryDate-month': user1DVLA.expiryMonth,
          'expiryDate-year': user1DVLA.expiryYear,
          drivingLicenceNumber: user1DVLA.drivingLicenceNumber,
          issueNumber: user1DVLA.issueNumber,
          postcode: user1DVLA.postcode,
          continue: '',
          'x-csrf-token': csrfToken

        },
        {
          redirects: 2,
          tags: { name: 'B02_Driving_03_DVLA_EditUser_01_CRICall' }

        })
        const endTime = Date.now()
        check(res, {
          'is status 302': (r) => r.status === 302

        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')

        const startTime30 = Date.now()
        res = http.get(res.headers.Location,
          {
            headers: { Authorization: `Basic ${encodedCredentials}` },
            tags: { name: 'B02_Driving_03_DVLA_EditUser_02_CoreStubCall' } // pragma: allowlist secret
          })
        const endTime30 = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) => (r.body as string).includes('Verifiable Credentials')
        })
          ? transactionDuration.add(endTime30 - startTime30)
          : fail('Response Validation Failed')
      }
      )
      break

    case 'DVA': {
      group('B02_Driving_02_SelectingOption_DVA_POST', function () {
        const startTime = Date.now()
        res = http.post(env.drivingUrl + '/licence-issuer',
          {
            licenceIssuerRadio: 'DVA',
            submitButton: '',
            'x-csrf-token': csrfToken
          })
        const endtime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) => (r.body as string).includes('Enter your details exactly as they appear on your UK driving licence')
        })
          ? transactionDuration.add(endtime - startTime)
          : fail('Response Validation Failed')
        csrfToken = getCSRF(res)
      })

      sleep(1)

      group('02_Driving_03_DVA_EditUser POST', function () {
        const startTime = Date.now()
        res = http.post(env.drivingUrl + '/details', {

          surname: user1DVA.surname,
          firstName: user1DVA.firstName,
          middleNames: user1DVA.middleName,
          'dvaDateOfBirth-day': user1DVA.birthday,
          'dvaDateOfBirth-month': user1DVA.birthmonth,
          'dvaDateOfBirth-year': user1DVA.birthyear,
          dvaDependent: 'DVA',
          'dateOfIssue-day': user1DVA.issueDay,
          'dateOfIssue-month': user1DVA.issueMonth,
          'dateOfIssue-year': user1DVA.issueYear,
          'expiryDate-day': user1DVA.expiryDay,
          'expiryDate-month': user1DVA.expiryMonth,
          'expiryDate-year': user1DVA.expiryYear,
          dvaLicenceNumber: user1DVA.drivingLicenceNumber,
          postcode: user1DVA.postcode,
          continue: '',
          'x-csrf-token': csrfToken

        },
        {
          redirects: 2,
          tags: { name: '02_Driving_03_DVA_EditUser_01_CRICall' }

        })

        const endTime = Date.now()
        check(res, {
          'is status 302': (r) => r.status === 302
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')

        const startTime1 = Date.now()
        res = http.get(res.headers.Location,
          {
            headers: { Authorization: `Basic ${encodedCredentials}` },
            tags: { name: '02_Driving_03_DVA_EditUser_02_CoreStubCall' }
          })
        const endTime1 = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) => (r.body as string).includes('Verifiable Credentials')
        })
          ? transactionDuration.add(endTime1 - startTime1)
          : fail('Response Validation Failed')
      }
      )
    }
  }
}

export function passportScenario (): void {
  let res: Response
  let csrfToken: string

  const user1Passport = csvDataPassport[exec.scenario.iterationInTest % csvDataPassport.length]

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
      res = http.get(env.ipvCoreURL + '/ipv/journey/cri/build-oauth-request/ukPassport')
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
      res = http.post(env.passportURL + '/passport/details',
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
