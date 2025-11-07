import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import encoding from 'k6/encoding'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI3SpikeSignUpScenario,
  createI3RegressionScenario,
  createI4PeakTestSignUpScenario
} from '../common/utils/config/load-profiles'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'
import { claimsTextPayload } from './data/ClaimsTextPayload'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('fraud', LoadProfile.smoke),
    ...createScenario('drivingLicence', LoadProfile.smoke),
    ...createScenario('drivingLicenceAttestation', LoadProfile.smoke),
    ...createScenario('passport', LoadProfile.smoke)
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
    ...createScenario('fraud', LoadProfile.short, 30),
    ...createScenario('drivingLicence', LoadProfile.short, 20),
    ...createScenario('passport', LoadProfile.short, 30)
  },
  stress: {
    ...createScenario('fraud', LoadProfile.full, 63),
    ...createScenario('drivingLicence', LoadProfile.full, 55),
    ...createScenario('passport', LoadProfile.full, 55)
  },
  rampOnly: {
    ...createScenario('passport', LoadProfile.rampOnly, 30)
  },
  loadMar2025_L1: {
    ...createScenario('fraud', LoadProfile.short, 13, 8),
    ...createScenario('passport', LoadProfile.short, 11, 8)
  },
  soakMar2025_L1: {
    ...createScenario('fraud', LoadProfile.soak, 13, 8),
    ...createScenario('passport', LoadProfile.soak, 11, 8)
  },
  spikeNFR_L1: {
    ...createScenario('fraud', LoadProfile.spikeNFRSignUp, 13, 8),
    ...createScenario('passport', LoadProfile.spikeNFRSignUp, 11, 8)
  },
  spikeSudden_L1: {
    ...createScenario('fraud', LoadProfile.spikeSudden, 13, 8),
    ...createScenario('passport', LoadProfile.spikeSudden, 11, 8)
  },
  loadMar2025_L2: {
    ...createScenario('fraud', LoadProfile.short, 26, 8),
    ...createScenario('passport', LoadProfile.short, 22, 8)
  },
  soakMar2025_L2: {
    ...createScenario('fraud', LoadProfile.soak, 26, 8),
    ...createScenario('passport', LoadProfile.soak, 22, 8)
  },
  spikeNFR_L2: {
    ...createScenario('fraud', LoadProfile.spikeNFRSignUpL2, 26, 8),
    ...createScenario('passport', LoadProfile.spikeNFRSignUpL2, 22, 8)
  },
  spikeSudden_L2: {
    ...createScenario('fraud', LoadProfile.spikeSudden, 27, 8),
    ...createScenario('passport', LoadProfile.spikeSudden, 22, 8)
  },
  lowVolPerf007Test: {
    fraud: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 20, duration: '200s' },
        { target: 20, duration: '180s' }
      ],
      exec: 'fraud'
    },
    drivingLicence: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1m',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 40, duration: '400s' },
        { target: 40, duration: '180s' }
      ],
      exec: 'drivingLicence'
    },
    drivingLicenceAttestation: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1m',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 40, duration: '400s' },
        { target: 40, duration: '180s' }
      ],
      exec: 'drivingLicenceAttestation'
    },
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1m',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 12, duration: '120s' },
        { target: 12, duration: '180s' }
      ],
      exec: 'passport'
    }
  },
  perf006Iteration1: {
    fraud: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 150, duration: '151s' },
        { target: 150, duration: '15m' }
      ],
      exec: 'fraud'
    },
    drivingLicence: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 25, duration: '26s' },
        { target: 25, duration: '15m' }
      ],
      exec: 'drivingLicence'
    },
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 20, duration: '21s' },
        { target: 20, duration: '15m' }
      ],
      exec: 'passport'
    }
  },
  spikeI2HighTraffic: {
    ...createScenario('drivingLicence', LoadProfile.spikeI2HighTraffic, 4, 9),
    ...createScenario('drivingLicenceAttestation', LoadProfile.spikeI2HighTraffic, 7, 10),
    ...createScenario('fraud', LoadProfile.spikeI2HighTraffic, 35, 6),
    ...createScenario('passport', LoadProfile.spikeI2HighTraffic, 4, 6)
  },
  perf006Iteration2PeakTest: {
    drivingLicence: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 9,
      maxVUs: 9,
      stages: [
        { target: 15, duration: '16s' },
        { target: 15, duration: '30m' }
      ],
      exec: 'drivingLicence'
    },
    drivingLicenceAttestation: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 14,
      maxVUs: 14,
      stages: [
        { target: 23, duration: '24s' },
        { target: 23, duration: '30m' }
      ],
      exec: 'drivingLicenceAttestation'
    },
    fraud: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 72,
      maxVUs: 72,
      stages: [
        { target: 120, duration: '121s' },
        { target: 120, duration: '30m' }
      ],
      exec: 'fraud'
    },
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 20,
      maxVUs: 72,
      stages: [
        { target: 12, duration: '13s' },
        { target: 12, duration: '30m' }
      ],
      exec: 'passport'
    }
  },
  perf006Iteration3PeakTest: {
    drivingLicence: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 9,
      maxVUs: 18,
      stages: [
        { target: 20, duration: '21s' },
        { target: 20, duration: '30m' }
      ],
      exec: 'drivingLicence'
    },
    drivingLicenceAttestation: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 15,
      maxVUs: 31,
      stages: [
        { target: 34, duration: '35s' },
        { target: 34, duration: '30m' }
      ],
      exec: 'drivingLicenceAttestation'
    },
    fraud: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 48,
      maxVUs: 96,
      stages: [
        { target: 160, duration: '161s' },
        { target: 160, duration: '30m' }
      ],
      exec: 'fraud'
    },
    passport: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 4,
      maxVUs: 8,
      stages: [
        { target: 16, duration: '17s' },
        { target: 16, duration: '30m' }
      ],
      exec: 'passport'
    }
  },
  perf006Iteration3SpikeTest: {
    ...createI3SpikeSignUpScenario('passport', 47, 6, 48),
    ...createI3SpikeSignUpScenario('drivingLicence', 61, 9, 62),
    ...createI3SpikeSignUpScenario('drivingLicenceAttestation', 103, 9, 104),
    ...createI3SpikeSignUpScenario('fraud', 490, 6, 491)
  },
  perf006RegressionTest: {
    ...createI3RegressionScenario('fraud', 5, 6, 6)
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('passport', 47, 6, 48),
    ...createI4PeakTestSignUpScenario('drivingLicence', 59, 9, 60),
    ...createI4PeakTestSignUpScenario('drivingLicenceAttestation', 99, 9, 100),
    ...createI4PeakTestSignUpScenario('fraud', 470, 6, 471)
  },
  perf006Iteration4SpikeTest: {
    ...createI3SpikeSignUpScenario('passport', 113, 6, 114),
    ...createI3SpikeSignUpScenario('drivingLicence', 141, 9, 142),
    ...createI3SpikeSignUpScenario('drivingLicenceAttestation', 237, 9, 238),
    ...createI3SpikeSignUpScenario('fraud', 1130, 6, 1131)
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignUpScenario('passport', 57, 6, 58),
    ...createI4PeakTestSignUpScenario('drivingLicence', 70, 9, 71),
    ...createI4PeakTestSignUpScenario('drivingLicenceAttestation', 120, 9, 121),
    ...createI4PeakTestSignUpScenario('fraud', 570, 6, 571)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('passport', 18, 6, 19),
    ...createI4PeakTestSignUpScenario('drivingLicence', 23, 9, 24),
    ...createI4PeakTestSignUpScenario('drivingLicenceAttestation', 38, 9, 39)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  fraud: [
    'B01_Fraud_01_CoreStubEditUserContinue',
    'B01_Fraud_01_CoreStubEditUserContinue::01_CoreStubCall',
    'B01_Fraud_01_CoreStubEditUserContinue::02_CRICall',
    'B01_Fraud_02_ContinueToCheckFraudDetails',
    'B01_Fraud_02_ContinueToCheckFraudDetails::01_CRICall',
    'B01_Fraud_02_ContinueToCheckFraudDetails::02_CoreStubCall'
  ],
  drivingLicence: [
    'B02_Driving_01_DLEntryFromCoreStub_DVA',
    'B02_Driving_02_Select_DVA',
    'B02_Driving_03_EnterDetailsConfirm_DVA',
    'B02_Driving_03_EnterDetailsConfirm_DVA::01_CRICall',
    'B02_Driving_03_EnterDetailsConfirm_DVA::02_CoreStubCall',
    'B02_Driving_01_DLEntryFromCoreStub_DVLA',
    'B02_Driving_02_Select_DVLA',
    'B02_Driving_03_EnterDetailsConfirm_DVLA',
    'B02_Driving_03_EnterDetailsConfirm_DVLA::01_CRICall',
    'B02_Driving_03_EnterDetailsConfirm_DVLA::02_CoreStubCall'
  ],
  drivingLicenceAttestation: [
    'B04_DLattestation_01_CoreStubtoUserSearch',
    'B04_DLattestation_01_CoreStubtoUserSearch::01_CoreStubCall',
    'B04_DLattestation_01_CoreStubtoUserSearch::02_CRICall',
    'B04_DLattestation_02_ContinueToCheckDLdetails',
    'B04_DLattestation_03_ConfirmConsentform',
    'B04_DLattestation_03_ConfirmConsentform::01_CRICall',
    'B04_DLattestation_03_ConfirmConsentform::02_CoreStubCall'
  ],
  passport: [
    'B03_Passport_01_PassportCRIEntryFromStub',
    'B03_Passport_01_PassportCRIEntryFromStub::01_CoreStubCall',
    'B03_Passport_01_PassportCRIEntryFromStub::02_CRICall',
    'B03_Passport_02_EnterPassportDetailsAndContinue',
    'B03_Passport_02_EnterPassportDetailsAndContinue::01_CRICall',
    'B03_Passport_02_EnterPassportDetailsAndContinue::02_CoreStubCall'
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

const env = {
  ipvCoreStub: getEnv('IDENTITY_CORE_STUB_URL'),
  fraudUrl: getEnv('IDENTITY_FRAUD_URL'),
  drivingUrl: getEnv('IDENTITY_DRIVING_URL'),
  passportURL: getEnv('IDENTITY_PASSPORT_URL'),
  envName: getEnv('ENVIRONMENT'),
  staticResources: __ENV.K6_NO_STATIC_RESOURCES !== 'true'
}

const stubCreds = {
  userName: getEnv('IDENTITY_CORE_STUB_USERNAME'),
  password: getEnv('IDENTITY_CORE_STUB_PASSWORD')
}

const profile = {
  m1c: getEnv('IDENTITY_FRAUD_M1C') == 'true'
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
type DrivingLicenseUserDVA = DrivingLicenseUser

const csvDVLA: DrivingLicenseUserDVLA[] = new SharedArray('csvDataLicenceDVLA', () => {
  return open('./data/drivingLicenceDVLAData.csv')
    .split('\n')
    .slice(1)
    .map(s => {
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
  return open('./data/drivingLicenceDVAData.csv')
    .split('\n')
    .slice(1)
    .map(s => {
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
  return open('./data/passportData.csv')
    .split('\n')
    .slice(1)
    .map(s => {
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

export function fraud(): void {
  const groups = groupMap.fraud
  let res: Response
  const userDetails = getUserDetails()
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  iterationsStarted.add(1)
  const userSurname = profile.m1c ? 'M1C_500' : userDetails.lastName

  // B01_Fraud_01_CoreStubEditUserContinue
  timeGroup(groups[0], () => {
    // 01_CoreStubCall
    res = timeGroup(
      groups[1].split('::')[1],
      () =>
        http.post(
          env.ipvCoreStub + '/edit-user',
          {
            cri: `fraud-cri-${env.envName}`,
            rowNumber: '197',
            firstName: userDetails.firstName,
            surname: userSurname,
            'dateOfBirth-day': `${userDetails.day}`,
            'dateOfBirth-month': `${userDetails.month}`,
            'dateOfBirth-year': `${userDetails.year}`,
            buildingNumber: `${userDetails.buildNum}`,
            buildingName: userDetails.buildName,
            street: userDetails.street,
            townCity: userDetails.city,
            postCode: userDetails.postCode,
            addressCountry: 'GB',
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
            redirects: 0
          }
        ),
      { isStatusCode302 }
    )
    // 01_CRICall
    res = timeGroup(groups[2].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('We need to check your details')
    })
  })

  sleepBetween(1, 3)

  // B01_Fraud_02_ContinueToCheckFraudDetails
  timeGroup(groups[3], () => {
    const pageContent = profile.m1c ? 'failedCheckDetails' : 'identityFraudScore'
    // 01_CRICall
    res = timeGroup(
      groups[4].split('::')[1],
      () =>
        res.submitForm({
          params: { redirects: 1 },
          submitSelector: '#continue'
        }),
      { isStatusCode302 }
    )
    // 02_CoreStubCall
    res = timeGroup(
      groups[5].split('::')[1],
      () =>
        http.get(res.headers.Location, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck(pageContent) }
    )
  })
  iterationsCompleted.add(1)
}

export function drivingLicence(): void {
  type drivingLicenceIssuer = 'DVA' | 'DVLA'
  const licenceIssuer: drivingLicenceIssuer = Math.random() <= 0.5 ? 'DVA' : 'DVLA'
  const groups = groupMap.drivingLicence.filter(s => s.includes(licenceIssuer))

  let res: Response
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  const userDVLA = csvDVLA[exec.scenario.iterationInTest % csvDVLA.length]
  const userDVA = csvDVA[exec.scenario.iterationInTest % csvDVA.length]
  iterationsStarted.add(1)

  // B02_Driving_01_DLEntryFromCoreStub_${licenceIssuer}
  res = timeGroup(
    groups[0],
    () =>
      http.get(`${env.ipvCoreStub}/authorize?cri=driving-licence-cri-${env.envName}&rowNumber=197`, {
        headers: { Authorization: `Basic ${encodedCredentials}` }
      }),
    {
      isStatusCode200,
      ...pageContentCheck('Was your UK photocard driving licence issued by DVLA or DVA?')
    }
  )

  sleepBetween(1, 3)

  const fields: Record<string, string> =
    licenceIssuer === 'DVLA'
      ? {
          // DVLA Licence Fields
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
      : {
          // DVA Licence Fields
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

  // B02_Driving_02_Select_${licenceIssuer}
  res = timeGroup(
    groups[1],
    () =>
      res.submitForm({
        fields: { licenceIssuer },
        submitSelector: '#submitButton'
      }),
    {
      isStatusCode200,
      ...pageContentCheck('Enter your details exactly as they appear on your UK driving licence')
    }
  )

  sleepBetween(1, 3)

  // B02_Driving_03_${licenceIssuer}_EnterDetailsConfirm
  timeGroup(groups[2], () => {
    // 01_CRICall
    res = timeGroup(
      groups[3].split('::')[1],
      () =>
        res.submitForm({
          fields,
          params: { redirects: 2 },
          submitSelector: '#continue'
        }),
      { isStatusCode302 }
    )
    // 02_CoreStubCall
    res = timeGroup(
      groups[4].split('::')[1],
      () =>
        http.get(res.headers.Location, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('Verifiable Credentials') }
    )
  })
  iterationsCompleted.add(1)
}

export function drivingLicenceAttestation(): void {
  const groups = groupMap.drivingLicenceAttestation
  let res: Response
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  iterationsStarted.add(1)
  //B04_DLattestation_01_CoreStubtoUserSearch
  timeGroup(groups[0], () => {
    // 01_CoreStubCall
    res = timeGroup(
      groups[1].split('::')[1],
      () =>
        http.post(
          env.ipvCoreStub + '/user-search',
          {
            cri: `driving-licence-cri-${env.envName}`,
            context: 'check_details',
            claimsText: claimsTextPayload
          },
          {
            headers: { Authorization: `Basic ${encodedCredentials}` },
            redirects: 0
          }
        ),
      { isStatusCode302 }
    )
    // 02_CRICall
    res = timeGroup(groups[2].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Check your UK photocard driving licence details')
    })
  })

  //B04_DLattestation_02_ContinueToCheckDLdetails
  res = timeGroup(
    groups[3],
    () =>
      res.submitForm({
        fields: { confirmDetails: 'detailsConfirmed' }
      }),
    { isStatusCode200, ...pageContentCheck('We need to check your driving licence details') }
  )
  //B04_DLattestation_03_ConfirmConsentform
  timeGroup(groups[4], () => {
    //01_CRI Call
    res = timeGroup(
      groups[5].split('::')[1],
      () =>
        res.submitForm({
          fields: {
            issuerDependent: 'DVLA',
            consentCheckbox: 'true'
          },
          params: { redirects: 2 },
          submitSelector: '#continue'
        }),
      { isStatusCode302 }
    )
    //02_StubCall
    res = timeGroup(
      groups[6].split('::')[1],
      () =>
        http.get(res.headers.Location, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('Verifiable Credentials') }
    )
  })
  iterationsCompleted.add(1)
}

export function passport(): void {
  const groups = groupMap.passport
  let res: Response
  const credentials = `${stubCreds.userName}:${stubCreds.password}`
  const encodedCredentials = encoding.b64encode(credentials)
  const userPassport = csvDataPassport[Math.floor(Math.random() * csvDataPassport.length)]
  iterationsStarted.add(1)

  // B03_Passport_01_PassportCRIEntryFromStub
  timeGroup(groups[0], () => {
    // 01_CoreStubCall
    res = timeGroup(
      groups[1].split('::')[1],
      () =>
        http.get(env.ipvCoreStub + '/authorize?cri=passport-v1-cri-' + env.envName + '&rowNumber=197', {
          headers: { Authorization: `Basic ${encodedCredentials}` },
          redirects: 0
        }),
      { isStatusCode302 }
    )

    // 02_CRICall
    res = timeGroup(
      groups[2].split('::')[1],
      () => {
        if (env.staticResources) {
          const paths = [
            '/public/fonts/light-94a07e06a1-v2.woff2',
            '/public/fonts/bold-b542beb274-v2.woff2',
            '/public/images/govuk-crest-2x.png',
            '/public/javascripts/analytics.js',
            '/public/javascripts/all.js',
            '/public/stylesheets/application.css'
          ]
          const batchRequests = paths.map(path => env.passportURL + path)
          http.batch(batchRequests)
        }
        return http.get(res.headers.Location)
      },
      {
        isStatusCode200,
        ...pageContentCheck('Enter your details exactly as they appear on your UK passport')
      }
    )
  })

  sleepBetween(1, 3)

  // B03_Passport_02_EnterPassportDetailsAndContinue
  timeGroup(groups[3], () => {
    // 01_CRICall
    res = timeGroup(
      groups[4].split('::')[1],
      () =>
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
      { isStatusCode302 }
    )
    // 02_CoreStubCall
    res = timeGroup(
      groups[5].split('::')[1],
      () =>
        http.get(res.headers.Location, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('Verifiable Credentials') }
    )
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

function getUserDetails(): User {
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
