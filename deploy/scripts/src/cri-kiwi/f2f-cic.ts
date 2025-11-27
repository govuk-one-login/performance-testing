import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI3SpikeSignUpScenario,
  createI4PeakTestSignUpScenario
} from '../common/utils/config/load-profiles'
import execution from 'k6/execution'
import { b64encode } from 'k6/encoding'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getAuthorizeauthorizeLocation, getclientassertion, getClientID, getCodeFromUrl } from './utils/authorization'
import { getAccessToken } from '../common/utils/authorization/authorization'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('FaceToFace', LoadProfile.smoke),
    ...createScenario('CIC', LoadProfile.smoke)
  },
  load: {
    ...createScenario('FaceToFace', LoadProfile.short, 3),
    ...createScenario('CIC', LoadProfile.short, 3)
  },
  spikeI2LowTraffic: {
    ...createScenario('FaceToFace', LoadProfile.spikeI2LowTraffic, 1), //rounded to 1 from 0.4 based on the iteration 2 plan
    ...createScenario('CIC', LoadProfile.spikeI2LowTraffic, 1)
  },
  perf006Iteration2PeakTest: {
    FaceToFace: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 10,
      maxVUs: 100,
      stages: [
        { target: 3, duration: '4s' },
        { target: 3, duration: '30m' }
      ],
      exec: 'FaceToFace'
    },
    CIC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 10,
      maxVUs: 100,
      stages: [
        { target: 3, duration: '4s' },
        { target: 3, duration: '30m' }
      ],
      exec: 'CIC'
    }
  },
  perf006Iteration3PeakTest: {
    FaceToFace: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 10,
      maxVUs: 100,
      stages: [
        { target: 4, duration: '5s' },
        { target: 4, duration: '30m' }
      ],
      exec: 'FaceToFace'
    },
    CIC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 10,
      maxVUs: 100,
      stages: [
        { target: 4, duration: '5s' },
        { target: 4, duration: '30m' }
      ],
      exec: 'CIC'
    }
  },
  perf006Iteration3SpikeTest: {
    ...createI3SpikeSignUpScenario('FaceToFace', 12, 42, 13),
    ...createI3SpikeSignUpScenario('CIC', 12, 21, 13)
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('FaceToFace', 12, 42, 13),
    ...createI4PeakTestSignUpScenario('CIC', 12, 21, 13)
  },
  perf006Iteration4SpikeTest: {
    ...createI3SpikeSignUpScenario('FaceToFace', 28, 42, 29),
    ...createI3SpikeSignUpScenario('CIC', 28, 21, 29)
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignUpScenario('FaceToFace', 14, 42, 15),
    ...createI4PeakTestSignUpScenario('CIC', 14, 21, 15)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('FaceToFace', 5, 42, 6),
    ...createI4PeakTestSignUpScenario('CIC', 5, 21, 6)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  CIC: [
    'B01_CIC_01_IPVStubCall',
    'B01_CIC_02_Authorize',
    'B01_CIC_03_UserDetails',
    'B01_CIC_04_UserBirthdate',
    'B01_CIC_05_CheckDetails',
    'B01_CIC_05_CheckDetails::01_CICCall',
    'B01_CIC_05_CheckDetails::01_IPVStubCall',
    'B01_CIC_06_getClientAssertion_IPVStubCall', // pragma: allowlist secret
    'B01_CIC_07_SendAuthorizationCode',
    'B01_CIC_08_SendBearerToken'
  ],
  FaceToFace: [
    'B02_FaceToFace_01_IPVStubCall',
    'B02_FaceToFace_02_Authorize',
    'B02_FaceToFace_03_Continue',
    'B02_FaceToFace_04_UKPassport_ChoosePhotoId',
    'B02_FaceToFace_05_UKPassport_PassportDetails',
    'B02_FaceToFace_04_NationalIDEEA_ChoosePhotoId',
    'B02_FaceToFace_05_NationalIDEEA_ExpiryOption',
    'B02_FaceToFace_06_NationalIDEEA_Details',
    'B02_FaceToFace_07_NationalIDEEA_CurrentAddress',
    'B02_FaceToFace_08_NationalIDEEA_WhichCountry', // pragma: allowlist secret
    'B02_FaceToFace_04_EUDL_ChoosePhotoId',
    'B02_FaceToFace_05_EUDL_ExpiryOption',
    'B02_FaceToFace_06_EUDL_Details',
    'B02_FaceToFace_07_EUDL_CurrentAddress',
    'B02_FaceToFace_08_EUDL_WhichCountry',
    'B02_FaceToFace_04_NonUKPassport_ChoosePhotoId',
    'B02_FaceToFace_05_NonUKPassport_ExpiryOption',
    'B02_FaceToFace_06_NonUKPassport_Details',
    'B02_FaceToFace_07_NonUKPassport_WhichCountry', // pragma: allowlist secret
    'B02_FaceToFace_04_UKDL_ChoosePhotoId',
    'B02_FaceToFace_05_UKDL_Details',
    'B02_FaceToFace_06_UKDL_CurrentAddress',
    'B02_FaceToFace_09_FindPostOffice',
    'B02_FaceToFace_10_ChoosePostOffice',
    'B02_FaceToFace_11_SelectMailingOption',
    'B02_FaceToFace_12_CheckDetails',
    'B02_FaceToFace_12_CheckDetails::01_F2FCall',
    'B02_FaceToFace_12_CheckDetails::02_IPVStubCall',
    'B02_FaceToFace_13_getClientAssertion_IPVStubCall', // pragma: allowlist secret
    'B02_FaceToFace_14_SendAuthorizationCode',
    'B02_FaceToFace_15_SendBearerToken'
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
  CIC: {
    ipvStub: getEnv('IDENTITY_KIWI_CIC_STUB_URL'),
    target: getEnv('IDENTITY_KIWI_CIC_TARGET')
  },
  F2F: {
    ipvStub: getEnv('IDENTITY_KIWI_F2F_STUB_URL'),
    target: getEnv('IDENTITY_KIWI_F2F_TARGET')
  }
}

export function CIC(): void {
  const groups = groupMap.CIC
  let res: Response
  iterationsStarted.add(1)

  // B01_CIC_01_IPVStubCall
  res = timeGroup(
    groups[0],
    () =>
      http.post(
        env.CIC.ipvStub + '/start',
        JSON.stringify({
          target: env.CIC.target
        })
      ),
    {
      isStatusCode200,
      ...pageContentCheck(b64encode('{"alg":"RSA', 'rawstd'))
    }
  )
  const authorizeLocation = getAuthorizeauthorizeLocation(res)
  const clientId = getClientID(res)

  // B01_CIC_02_Authorize
  res = timeGroup(groups[1], () => http.get(authorizeLocation), {
    isStatusCode200,
    ...pageContentCheck('Enter your name exactly as it appears on your photo ID')
  })

  // B01_CIC_03_UserDetails
  res = timeGroup(
    groups[2],
    () =>
      res.submitForm({
        fields: {
          surname: 'NameTest',
          firstName: 'FirstNameTest'
        },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Enter your date of birth') }
  )

  sleepBetween(1, 3)

  // B01_CIC_04_UserBirthdate
  res = timeGroup(
    groups[3],
    () =>
      res.submitForm({
        fields: {
          'dateOfBirth-day': '1',
          'dateOfBirth-month': '1',
          'dateOfBirth-year': '1985'
        },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Confirm your details') }
  )

  // B01_CIC_05_CheckDetails
  timeGroup(groups[4], () => {
    //01_CICCall
    res = timeGroup(
      groups[5].split('::')[1],
      () =>
        res.submitForm({
          submitSelector: '#submitDetails',
          params: { redirects: 2 }
        }),
      { isStatusCode302 }
    )

    //02_IPVStubCall
    res = timeGroup(groups[6].split('::')[1], () => http.get(res.headers.Location), {
      'verify url body': r => r.url.includes(clientId)
    })
  })
  const codeUrl = getCodeFromUrl(res.url)

  sleepBetween(1, 3)
  // B01_CIC_06_getClientAssertion_IPVStubCall
  res = timeGroup(groups[7], () => http.post(env.CIC.ipvStub + '/generate-token-request'), {
    isStatusCode200
  })
  const client_assertion = getclientassertion(res)

  // B01_CIC_07_SendAuthorizationCode
  res = timeGroup(
    groups[8],
    () =>
      http.post(env.CIC.target + '/token', {
        grant_type: 'authorization_code',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: client_assertion,
        code: codeUrl,
        redirect_uri: env.CIC.ipvStub + '/redirect'
      }),
    { isStatusCode200, ...pageContentCheck('access_token') }
  )

  const accessToken = getAccessToken(res)

  sleepBetween(1, 3)

  const authHeader = `Bearer ${accessToken}`
  const options = {
    headers: { Authorization: authHeader }
  }
  // B01_CIC_08_SendBearerToken
  res = timeGroup(groups[9], () => http.post(env.CIC.target + '/userinfo', {}, options), {
    isStatusCode200,
    ...pageContentCheck('credentialJWT')
  })
  iterationsCompleted.add(1)
}

export function FaceToFace(): void {
  const groups = groupMap.FaceToFace
  let res: Response
  const iteration = execution.scenario.iterationInInstance
  const paths = ['UKPassport', 'NationalIDEEA', 'EU-DL', 'Non-UKPassport', 'UKDL']
  const path = paths[iteration % paths.length]
  const expiry = randomDate(new Date(2030, 1, 1), new Date(2030, 12, 31)) // Expiry 5 years from now
  const expiryDay = expiry.getDate().toString()
  const expiryMonth = (expiry.getMonth() + 1).toString()
  const expiryYear = expiry.getFullYear().toString()
  iterationsStarted.add(1)

  // B02_FaceToFace_01_IPVStubCall
  res = timeGroup(
    groups[0],
    () =>
      http.post(
        env.F2F.ipvStub + '/start',
        JSON.stringify({
          yotiMockID: '0000'
        })
      ),
    {
      'is status 200': r => r.status === 200,
      ...pageContentCheck(b64encode('{"alg":"RSA', 'rawstd'))
    }
  )
  const authorizeLocation = getAuthorizeauthorizeLocation(res)
  const clientId = getClientID(res)

  // B02_FaceToFace_02_Authorize
  res = timeGroup(groups[1], () => http.get(authorizeLocation), {
    isStatusCode200,
    ...pageContentCheck('How to prove your identity at a Post Office')
  })

  sleepBetween(1, 3)

  // B02_FaceToFace_03_Continue
  res = timeGroup(
    groups[2],
    () =>
      res.submitForm({
        submitSelector: '#landingPageContinue'
      }),
    {
      isStatusCode200,
      ...pageContentCheck('Choose which photo ID you can take to a Post Office')
    }
  )

  sleepBetween(1, 3)

  switch (path) {
    case 'UKPassport':
      // B02_FaceToFace_04_UKPassport_ChoosePhotoId
      res = timeGroup(
        groups[3],
        () =>
          res.submitForm({
            fields: { photoIdChoice: 'ukPassport' },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('When does your passport expire?')
        }
      )

      sleepBetween(1, 3)

      // B02_FaceToFace_05_UKPassport_PassportDetails
      res = timeGroup(
        groups[4],
        () =>
          res.submitForm({
            fields: {
              'ukPassportExpiryDate-day': expiryDay,
              'ukPassportExpiryDate-month': expiryMonth,
              'ukPassportExpiryDate-year': expiryYear
            },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Find a Post Office where you can prove your identity')
        }
      )
      break
    case 'NationalIDEEA':
      // B02_FaceToFace_04_NationalIDEEA_ChoosePhotoId
      res = timeGroup(
        groups[5],
        () =>
          res.submitForm({
            fields: { photoIdChoice: 'eeaIdentityCard' },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Does your national identity card have an expiry date?')
        }
      )

      sleepBetween(1, 3)

      // B02_FaceToFace_05_NationalIDEEA_ExpiryOption
      res = timeGroup(
        groups[6],
        () =>
          res.submitForm({
            fields: { idHasExpiryDate: 'yes' },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('When does your national identity card expire?')
        }
      )

      sleepBetween(1, 3)

      // B02_FaceToFace_06_NationalIDEEA_Details
      res = timeGroup(
        groups[7],
        () =>
          res.submitForm({
            fields: {
              'eeaIdCardExpiryDate-day': expiryDay,
              'eeaIdCardExpiryDate-month': expiryMonth,
              'eeaIdCardExpiryDate-year': expiryYear
            },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Does your national identity card have your current address on it?')
        }
      )

      sleepBetween(1, 3)

      // B02_FaceToFace_07_NationalIDEEA_CurrentAddress
      res = timeGroup(
        groups[8],
        () =>
          res.submitForm({
            fields: { eeaIdentityCardAddressCheck: 'current' },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Select which country your national identity card is from')
        }
      )

      sleepBetween(1, 3)

      // B02_FaceToFace_08_NationalIDEEA_WhichCountry
      res = timeGroup(
        groups[9],
        () =>
          res.submitForm({
            fields: { eeaIdentityCardCountrySelector: 'ROU' },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Find a Post Office where you can prove your identity')
        }
      )
      break
    case 'EU-DL':
      // B02_FaceToFace_04_EUDL_ChoosePhotoId
      res = timeGroup(
        groups[10],
        () =>
          res.submitForm({
            fields: { photoIdChoice: 'euPhotocardDl' },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Does your driving licence have an expiry date?')
        }
      )

      sleepBetween(1, 3)

      // B02_FaceToFace_05_EUDL_ExpiryOption
      res = timeGroup(
        groups[11],
        () =>
          res.submitForm({
            fields: { idHasExpiryDate: 'yes' },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('When does your driving licence expire?')
        }
      )
      sleepBetween(1, 3)

      // B02_FaceToFace_06_EUDL_Details
      res = timeGroup(
        groups[12],
        () =>
          res.submitForm({
            fields: {
              'euPhotocardDlExpiryDate-day': expiryDay,
              'euPhotocardDlExpiryDate-month': expiryMonth,
              'euPhotocardDlExpiryDate-year': expiryYear
            },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Does your driving licence have your current address on it?')
        }
      )

      sleepBetween(1, 3)

      // B02_FaceToFace_07_EUDL_CurrentAddress
      res = timeGroup(
        groups[13],
        () =>
          res.submitForm({
            fields: {
              euPhotocardDlAddressCheck: 'current'
            },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Select which country your driving licence is from')
        }
      )

      sleepBetween(1, 3)

      // B02_FaceToFace_08_EUDL_WhichCountry
      res = timeGroup(
        groups[14],
        () =>
          res.submitForm({
            fields: { euDrivingLicenceCountrySelector: 'ROU' },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Find a Post Office where you can prove your identity')
        }
      )
      break
    case 'Non-UKPassport':
      // B02_FaceToFace_04_NonUKPassport_ChoosePhotoId
      res = timeGroup(
        groups[15],
        () =>
          res.submitForm({
            fields: { photoIdChoice: 'nonUkPassport' },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Does your passport have an expiry date?')
        }
      )

      sleepBetween(1, 3)

      // B02_FaceToFace_05_NonUKPassport_ExpiryOption
      res = timeGroup(
        groups[16],
        () =>
          res.submitForm({
            fields: { idHasExpiryDate: 'yes' },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('When does your passport expire?')
        }
      )

      sleepBetween(1, 3)

      // B02_FaceToFace_06_NonUKPassport_Details
      res = timeGroup(
        groups[17],
        () =>
          res.submitForm({
            fields: {
              'nonUKPassportExpiryDate-day': expiryDay,
              'nonUKPassportExpiryDate-month': expiryMonth,
              'nonUKPassportExpiryDate-year': expiryYear
            },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Select which country your passport is from')
        }
      )

      sleepBetween(1, 3)

      // B02_FaceToFace_07_NonUKPassport_WhichCountry
      res = timeGroup(
        groups[18],
        () =>
          res.submitForm({
            fields: { nonUkPassportCountrySelector: 'ROU' },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Find a Post Office where you can prove your identity')
        }
      )
      break
    case 'UKDL':
      // B02_FaceToFace_04_UKDL_ChoosePhotoId
      res = timeGroup(
        groups[19],
        () =>
          res.submitForm({
            fields: { photoIdChoice: 'ukPhotocardDl' },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('When does your driving licence expire?')
        }
      )

      sleepBetween(1, 3)

      // B02_FaceToFace_05_UKDL_Details
      res = timeGroup(
        groups[20],
        () =>
          res.submitForm({
            fields: {
              'ukPhotocardDlExpiryDate-day': expiryDay,
              'ukPhotocardDlExpiryDate-month': expiryMonth,
              'ukPhotocardDlExpiryDate-year': expiryYear
            },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Does your driving licence have your current address on it?')
        }
      )

      // B02_FaceToFace_06_UKDL_CurrentAddress
      res = timeGroup(
        groups[21],
        () =>
          res.submitForm({
            fields: { ukPhotocardDlAddressCheck: 'current' },
            submitSelector: '#continue'
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Find a Post Office where you can prove your identity')
        }
      )
      break
    default:
      fail('Invalid path')
  }

  sleepBetween(1, 3)

  // B02_FaceToFace_09_FindPostOffice
  res = timeGroup(
    groups[22],
    () =>
      res.submitForm({
        fields: { postcode: 'SW1A 2AA' },
        submitSelector: '#continue'
      }),
    {
      isStatusCode200,
      ...pageContentCheck('Choose a Post Office where you can prove your identity')
    }
  )

  sleepBetween(1, 3)

  // B02_FaceToFace_10_ChoosePostOffice
  res = timeGroup(
    groups[23],
    () =>
      res.submitForm({
        fields: { branches: '1' },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Your Post Office customer letter') }
  )
  // B02_FaceToFace_11_SelectMailingOption
  res = timeGroup(
    groups[24],
    () =>
      res.submitForm({
        fields: { postOfficeCustomerLetterChoice: 'email' },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Check your answers') }
  )

  sleepBetween(1, 3)

  // B02_FaceToFace_12_CheckDetails
  timeGroup(groups[25], () => {
    //01_F2FCall
    res = timeGroup(
      groups[26].split('::')[1],
      () =>
        res.submitForm({
          submitSelector: '#submitDetails',
          params: { redirects: 2 }
        }),
      { isStatusCode302 }
    )

    //02_IPVStubCall
    res = timeGroup(groups[27].split('::')[1], () => http.get(res.headers.Location), {
      'verify url body': r => r.url.includes(clientId)
    })
  })

  const codeUrl = getCodeFromUrl(res.url)

  sleepBetween(1, 3)
  // B02_FaceToFace_13_getClientAssertion_IPVStubCall
  res = timeGroup(groups[28], () => http.post(env.F2F.ipvStub + '/generate-token-request'), {
    isStatusCode200
  })
  const client_assertion = getclientassertion(res)

  // B02_FaceToFace_14_SendAuthorizationCode
  res = timeGroup(
    groups[29],
    () =>
      http.post(env.F2F.target + '/token', {
        grant_type: 'authorization_code',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: client_assertion,
        code: codeUrl,
        redirect_uri: env.F2F.ipvStub + '/redirect?id=f2f'
      }),
    { isStatusCode200, ...pageContentCheck('access_token') }
  )
  const accessToken = getAccessToken(res)

  sleepBetween(1, 3)

  const authHeader = `Bearer ${accessToken}`
  const options = {
    headers: {
      Authorization: authHeader
    }
  }
  // B02_FaceToFace_14_SendBearerToken
  res = timeGroup(groups[30], () => http.post(env.F2F.target + '/userinfo', {}, options), {
    'is status 202': r => r.status === 202,
    ...pageContentCheck('sub')
  })
  iterationsCompleted.add(1)
}

function randomDate(start: Date, end: Date): Date {
  const diff = Math.abs(+end - +start)
  const min = Math.min(+end, +start)
  return new Date(min + diff * Math.random())
}
