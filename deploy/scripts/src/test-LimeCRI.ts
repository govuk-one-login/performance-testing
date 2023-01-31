import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import encoding from 'k6/encoding'
import { Trend } from 'k6/metrics'
import { selectProfile, type ProfileList, describeProfile } from './utils/config/load-profiles'

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
    }
  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
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
  ipvCoreStub: `https://${__ENV.coreStub}`,
  fraudEndPoint: `https://${__ENV.fraudURL}`
}

const transactionDuration = new Trend('duration')

export function fraudScenario1 (): void {
  let res: Response
  let csrfToken: string
  const stubUserName = `${__ENV.coreStubUserName}`
  const stubPassword = `${__ENV.coreStubPassword}`
  const userDetails = getUserDetails()
  const credentials = `${stubUserName}:${stubPassword}`
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

    const headerData = res.body as string
    const headerDataSplit = headerData.split('=')
    const codeID = headerDataSplit[2]
    const stateID = headerDataSplit[3]

    const startTime2 = Date.now()
    res = http.get(
      env.ipvCoreStub +
          `/callback?client_id=ipv-core-stub&code=${codeID}=${stateID}`,
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

function getCSRF (r: Response): string {
  return r.html().find("input[name='x-csrf-token']").val() ?? ''
}

function getUserDetails (): {
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
} {
  const firstName = `perfFirst${Math.floor(Math.random() * 99998) + 1}`
  const lastName = `perfLast${Math.floor(Math.random() * 99998) + 1}`
  const day = Math.floor(Math.random() * 29) + 1
  const month = Math.floor(Math.random() * 12) + 1
  const year = Math.floor(Math.random() * 71) + 1950
  const buildNum = Math.floor(Math.random() * 999) + 1
  const buildName = `RandomBuilding${Math.floor(Math.random() * 99998) + 1}`
  const street = `RandomgStreet${Math.floor(Math.random() * 99998) + 1}`
  const city = `RandomCity${Math.floor(Math.random() * 999) + 1}`
  const postCode = `AB${Math.floor(Math.random() * 99) + 1} CD${Math.floor(Math.random() * 99) + 1}`

  return { firstName, lastName, day, month, year, buildNum, buildName, street, city, postCode }
}
