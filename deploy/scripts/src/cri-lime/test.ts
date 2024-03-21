import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { group } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import encoding from 'k6/encoding'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    fraud: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'fraud'
    },
    drivingLicence: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'drivingLicence'
    },
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'passport'
    }
  },
  bau1x: {
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1m',
      preAllocatedVUs: 1,
      maxVUs: 8,
      stages: [
        { target: 5, duration: '5m' }, // Ramp up to 5 iterations per minute in 5 minutes
        { target: 5, duration: '10m' }, // Maintain steady state at 5 iterations per minute for 10 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'passport'
    }
  },
  bau5x: {
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1m',
      preAllocatedVUs: 1,
      maxVUs: 40,
      stages: [
        { target: 5, duration: '5m' }, // Ramp up to 5 iterations per minute in 5 minutes
        { target: 5, duration: '5m' }, // Maintain steady state at 5 iterations per minute for 5 minutes
        { target: 25, duration: '10m' }, // Ramp up to 25 iterations per minute in 10 minutes
        { target: 25, duration: '5m' }, // Maintain steady state at 25 iterations per minute for 5 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'passport'
    }
  },
  lowVolume: {
    fraud: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 900,
      stages: [
        { target: 30, duration: '15m' }, // Ramp up to 30 iterations per second in 15 minutes
        { target: 30, duration: '15m' }, // Maintain steady state at 30 iterations per second for 15 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'fraud'
    },
    drivingLicence: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 5, duration: '5m' }, // Ramp up to 5 iterations per second in 5 minutes
        { target: 5, duration: '15m' }, // Maintain steady state at 5 iterations per second for 15 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'drivingLicence'
    },
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 150,
      stages: [
        { target: 30, duration: '15m' }, // Ramp up to 30 iterations per second in 15 minutes
        { target: 30, duration: '15m' }, // Maintain steady state at 30 iterations per second for 15 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'passport'
    }
  },
  stress: {
    fraud: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1878,
      stages: [
        { target: 63, duration: '15m' }, // Ramp up to 63 iterations per second in 15 minutes
        { target: 63, duration: '30m' }, // Maintain steady state at 63 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'fraud'
    },
    drivingLicence: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1500,
      stages: [
        { target: 55, duration: '15m' }, // Ramp up to 55 iterations per second in 15 minutes
        { target: 55, duration: '30m' }, // Maintain steady state at 55 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'drivingLicence'
    },
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1500,
      stages: [
        { target: 55, duration: '15m' }, // Ramp up to 55 iterations per second in 15 minutes
        { target: 55, duration: '30m' }, // Maintain steady state at 55 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'passport'
    }
  }
}

const loadProfile = selectProfile(profiles)
type drivingLicenceIssuer = 'DVA' | 'DVLA'
const licenceIssuer: drivingLicenceIssuer = (Math.random() <= 0.5) ? 'DVA' : 'DVLA'
const groupMap = {
  fraud: [
    'B01_Fraud_01_CoreStubEditUserContinue',
    'B01_Fraud_02_ContinueToCheckFraudDetails',
    'B01_Fraud_02_ContinueToCheckFraudDetails::01_CRICall',
    'B01_Fraud_02_ContinueToCheckFraudDetails::02_CoreStubCall'
  ],
  drivingLicence: [
    'B02_Driving_01_DLEntryFromCoreStub',
    `B02_Driving_02_Select${licenceIssuer}`,
    `B02_Driving_03_${licenceIssuer}_EnterDetailsConfirm`,
    `B02_Driving_03_${licenceIssuer}_EnterDetailsConfirm::01_CRICall`,
    `B02_Driving_03_${licenceIssuer}_EnterDetailsConfirm::02_CoreStubCall`
  ],
  passport: [
    'B03_Passport_01_PassportCRIEntryFromStub',
    'B03_Passport_02_EnterPassportDetailsAndContinue',
    'B03_Passport_02_EnterPassportDetailsAndContinue::01_CRICall',
    'B03_Passport_02_EnterPassportDetailsAndContinue::02_CoreStubCall'
  ]
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap)
}

export function setup (): void {
  describeProfile(loadProfile)
}

const env = {
  ipvCoreStub: getEnv('IDENTITY_CORE_STUB_URL'),
  fraudUrl: getEnv('IDENTITY_FRAUD_URL'),
  drivingUrl: getEnv('IDENTITY_DRIVING_URL'),
  passportURL: getEnv('IDENTITY_PASSPORT_URL'),
  envName: getEnv('ENVIRONMENT')
}

const stubCreds = {
  userName: getEnv('IDENTITY_CORE_STUB_USERNAME'),
  password: getEnv('IDENTITY_CORE_STUB_PASSWORD')
}

interface DrivingLicenseUser {
  surname: string
  firstName: string
  middleNames: string
  birthday: string
  birthmonth: string
  birthyear: string
  issueDay: string
  issueMonth: string
  issueYear: string
  expiryDay: string
  expiryMonth: string
  expiryYear: string
  licenceNumber: string
  postcode: string
}

interface DrivingLicenseUserDVLA extends DrivingLicenseUser {
  issueNumber: string
}
interface DrivingLicenseUserDVA extends DrivingLicenseUser {}

const csvDVLA: DrivingLicenseUserDVLA[] = new SharedArray('csvDataLicenceDVLA', () => {
  return open('./data/drivingLicenceDVLAData.csv').split('\n').slice(1).map((s) => {
    const data = s.split(',')
    return {
      surname: data[0],
      firstName: data[1],
      middleNames: data[2],
      birthday: data[3],
      birthmonth: data[4],
      birthyear: data[5],
      issueDay: data[6],
      issueMonth: data[7],
      issueYear: data[8],
      expiryDay: data[9],
      expiryMonth: data[10],
      expiryYear: data[11],
      licenceNumber: data[12],
      issueNumber: data[13],
      postcode: data[14]
    }
  })
})

const csvDVA: DrivingLicenseUserDVA[] = new SharedArray('csvDataLicenceDVA', () => {
  return open('./data/drivingLicenceDVAData.csv').split('\n').slice(1).map((s) => {
    const data = s.split(',')
    return {
      surname: data[0],
      firstName: data[1],
      middleNames: data[2],
      birthday: data[3],
      birthmonth: data[4],
      birthyear: data[5],
      issueDay: data[6],
      issueMonth: data[7],
      issueYear: data[8],
      expiryDay: data[9],
      expiryMonth: data[10],
      expiryYear: data[11],
      licenceNumber: data[12],
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

const csvDataPassport: PassportUser[] = new SharedArray('csvDataPasport', () => {
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

export function fraud (): void {
  const groups = groupMap.fraud
  let res: Response
  const userDetails = getUserDetails()
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  iterationsStarted.add(1)

  res = group(groups[0], () => timeRequest(() => // B01_Fraud_01_CoreStubEditUserContinue
    http.post(
      env.ipvCoreStub + '/edit-user',
      {
        cri: `fraud-cri-${env.envName}`,
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
        headers: { Authorization: `Basic ${encodedCredentials}` }
      }
    ),
  { isStatusCode200, ...pageContentCheck('We need to check your details') }))

  sleepBetween(1, 3)

  group(groups[1], () => { // B01_Fraud_02_ContinueToCheckFraudDetails
    timeRequest(() => {
      res = group(groups[2].split('::')[1], () => timeRequest(() => // 01_CRICall
        res.submitForm({ params: { redirects: 1 }, submitSelector: '#continue' }), { isStatusCode302 }))
      res = group(groups[3].split('::')[1], () => timeRequest(() => // 02_CoreStubCall
        http.get(res.headers.Location, { headers: { Authorization: `Basic ${encodedCredentials}` } }),
      { isStatusCode200, ...pageContentCheck('Verifiable Credentials') }))
    }, {})
  })
  iterationsCompleted.add(1)
}

export function drivingLicence (): void {
  const groups = groupMap.drivingLicence
  let res: Response
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  const userDVLA = csvDVLA[exec.scenario.iterationInTest % csvDVLA.length]
  const userDVA = csvDVA[exec.scenario.iterationInTest % csvDVA.length]
  iterationsStarted.add(1)

  res = group(groups[0], () => timeRequest(() => // B02_Driving_01_DLEntryFromCoreStub
    http.get(`${env.ipvCoreStub}/authorize?cri=driving-licence-cri-${env.envName}&rowNumber=197`,
      {
        headers: { Authorization: `Basic ${encodedCredentials}` }
      }),
  { isStatusCode200, ...pageContentCheck('Who was your UK driving licence issued by?') }))

  sleepBetween(1, 3)

  res = group(groups[1], () => timeRequest(() => // B02_Driving_02_Select${licenceIssuer}
    res.submitForm({
      fields: { licenceIssuer },
      submitSelector: '#submitButton'
    }),
  { isStatusCode200, ...pageContentCheck('Enter your details exactly as they appear on your UK driving licence') }))

  sleepBetween(1, 3)

  const fields: Record<string, string> = (licenceIssuer === 'DVLA')
    ? { // DVLA Licence Fields
        surname: userDVLA.surname,
        firstName: userDVLA.firstName,
        middleNames: userDVLA.middleNames,
        'dateOfBirth-day': userDVLA.birthday,
        'dateOfBirth-month': userDVLA.birthmonth,
        'dateOfBirth-year': userDVLA.birthyear,
        'issueDate-day': userDVLA.issueDay,
        'issueDate-month': userDVLA.issueMonth,
        'issueDate-year': userDVLA.issueYear,
        'expiryDate-day': userDVLA.expiryDay,
        'expiryDate-month': userDVLA.expiryMonth,
        'expiryDate-year': userDVLA.expiryYear,
        drivingLicenceNumber: userDVLA.licenceNumber,
        issueNumber: userDVLA.issueNumber,
        postcode: userDVLA.postcode,
        consentCheckbox: 'true'
      }
    : { // DVA Licence Fields
        surname: userDVA.surname,
        firstName: userDVA.firstName,
        middleNames: userDVA.middleNames,
        'dvaDateOfBirth-day': userDVA.birthday,
        'dvaDateOfBirth-month': userDVA.birthmonth,
        'dvaDateOfBirth-year': userDVA.birthyear,
        'dateOfIssue-day': userDVA.issueDay,
        'dateOfIssue-month': userDVA.issueMonth,
        'dateOfIssue-year': userDVA.issueYear,
        'expiryDate-day': userDVA.expiryDay,
        'expiryDate-month': userDVA.expiryMonth,
        'expiryDate-year': userDVA.expiryYear,
        dvaLicenceNumber: userDVA.licenceNumber,
        postcode: userDVA.postcode,
        consentDVACheckbox: 'true'
      }

  group(groups[2], () => { // B02_Driving_03_${licenceIssuer}_EnterDetailsConfirm
    timeRequest(() => {
      res = group(groups[3].split('::')[1], () => timeRequest(() => // 01_CRICall
        res.submitForm({ fields, params: { redirects: 2 }, submitSelector: '#continue' }), { isStatusCode302 }))
      res = group(groups[4].split('::')[1], () => timeRequest(() => // 02_CoreStubCall
        http.get(res.headers.Location, { headers: { Authorization: `Basic ${encodedCredentials}` } }),
      { isStatusCode200, ...pageContentCheck('Verifiable Credentials') }))
    }, {})
  })
  iterationsCompleted.add(1)
}

export function passport (): void {
  const groups = groupMap.passport
  let res: Response
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  const userPassport = csvDataPassport[Math.floor(Math.random() * csvDataPassport.length)]
  iterationsStarted.add(1)

  res = group(groups[0], () => timeRequest(() => // B03_Passport_01_PassportCRIEntryFromStub
    http.get(env.ipvCoreStub + '/authorize?cri=passport-v1-cri-' +
        env.envName + '&rowNumber=197',
    {
      headers: { Authorization: `Basic ${encodedCredentials}` }
    }),
  { isStatusCode200, ...pageContentCheck('Enter your details exactly as they appear on your UK passport') }))

  sleepBetween(1, 3)

  group(groups[1], () => { // B03_Passport_02_EnterPassportDetailsAndContinue
    timeRequest(() => {
      res = group(groups[2].split('::')[1], () => timeRequest(() => // 01_CRICall
        res.submitForm({
          fields: {
            passportNumber: userPassport.passportNumber,
            surname: userPassport.surname,
            firstName: userPassport.firstName,
            middleNames: userPassport.middleName,
            'dateOfBirth-day': userPassport.birthday,
            'dateOfBirth-month': userPassport.birthmonth,
            'dateOfBirth-year': userPassport.birthyear,
            'expiryDate-day': userPassport.expiryDay,
            'expiryDate-month': userPassport.expiryMonth,
            'expiryDate-year': userPassport.expiryYear
          },
          params: { redirects: 2 },
          submitSelector: '#continue'
        }),
      { isStatusCode302 }))
      res = group(groups[3].split('::')[1], () => timeRequest(() => // 02_CoreStubCall
        http.get(res.headers.Location, { headers: { Authorization: `Basic ${encodedCredentials}` } }),
      { isStatusCode200, ...pageContentCheck('Verifiable Credentials') }))
    }, {})
  })
  iterationsCompleted.add(1)
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
