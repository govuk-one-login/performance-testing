import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { group, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import execution from 'k6/execution'
import { b64encode } from 'k6/encoding'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getAuthorizeauthorizeLocation, getClientID, getCodeFromUrl, getAccessToken } from './utils/authorization'
import { getEnv } from '../common/utils/config/environment-variables'

const profiles: ProfileList = {
  smoke: {
    FaceToFace: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 2, duration: '2m' } // Ramps up to target load
      ],
      exec: 'FaceToFace'
    },

    CIC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'CIC'
    }

  },
  load: {
    FaceToFace: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 70,
      stages: [
        { target: 3, duration: '15m' }, // Ramps up to target load
        { target: 3, duration: '15m' }, // Steady State of 15 minutes at the ramp up load i.e. 3 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'FaceToFace'
    },
    CIC: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 45,
      stages: [
        { target: 3, duration: '15m' }, // Ramps up to target load
        { target: 3, duration: '15m' }, // Steady State of 15 minutes at the ramp up load i.e. 3 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'CIC'
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
  CIC: {
    ipvStub: getEnv('IDENTITY_KIWI_CIC_STUB_URL'),
    target: getEnv('IDENTITY_KIWI_CIC_TARGET')
  },
  F2F: {
    ipvStub: getEnv('IDENTITY_KIWI_F2F_STUB_URL'),
    target: getEnv('IDENTITY_KIWI_F2F_TARGET')
  }
}

export function CIC (): void {
  let res: Response
  iterationsStarted.add(1)

  res = group('B01_CIC_01_IPVStubCall POST', () =>
    timeRequest(() => http.post(env.CIC.ipvStub + '/start',
      JSON.stringify({
        target: env.CIC.target
      }),
      {
        tags: { name: 'B01_CIC_01_IPVStubCall' }
      }),
    {
      'is status 201': (r) => r.status === 201,
      ...pageContentCheck(b64encode('{"alg":"RSA', 'rawstd'))
    }))
  const authorizeLocation = getAuthorizeauthorizeLocation(res)
  const clientId = getClientID(res)

  res = group('B01_CIC_02_Authorize GET', () =>
    timeRequest(() => http.get(authorizeLocation, {
      tags: { name: 'B01_CIC_02_Authorize' }
    }),
    { isStatusCode200, ...pageContentCheck('Enter your name exactly as it appears on your photo ID') }))

  res = group('B01_CIC_03_UserDetails POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: {
          surname: 'NameTest',
          firstName: 'FirstNameTest'
        },
        params: { tags: { name: 'B01_CIC_03_UserDetails' } },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Enter your date of birth') }))

  sleepBetween(1, 3)

  res = group('B01_CIC_04_UserBirthdate POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: {
          'dateOfBirth-day': '1',
          'dateOfBirth-month': '1',
          'dateOfBirth-year': '1985'
        },
        params: { tags: { name: 'B01_CIC_04_UserBirthdate' } },
        submitSelector: '#continue'
      }),
    { isStatusCode200, ...pageContentCheck('Confirm your details') }))

  res = group('B01_CIC_05_CheckDetails POST', () =>
    timeRequest(() =>
      res.submitForm({
        params: { tags: { name: 'B01_CIC_05_CheckDetails' } },
        submitSelector: '#continue'
      }),
    {
      'verify url body': (r) =>
        (r.url).includes(clientId)
    }))
  const codeUrl = getCodeFromUrl(res.url)

  sleepBetween(1, 3)

  res = group('B01_CIC_06_SendAuthorizationCode POST', () =>
    timeRequest(() => http.post(env.CIC.target + '/token', {
      grant_type: 'authorization_code',
      code: codeUrl,
      redirect_uri: env.CIC.ipvStub + '/redirect'
    }, {
      tags: { name: 'B01_CIC_06_SendAuthorizationCode' }
    }),
    { isStatusCode200, 'verify response body': (r) => (r.body as string).includes('access_token') }))

  const accessToken = getAccessToken(res)

  sleepBetween(1, 3)

  const authHeader = `Bearer ${accessToken}`
  const options = {
    headers: { Authorization: authHeader },
    tags: { name: 'B01_CIC_07_SendBearerToken' }
  }
  res = group('B01_CIC_07_SendBearerToken POST', () =>
    timeRequest(() => http.post(env.CIC.target + '/userinfo', {}, options),
      { isStatusCode200, 'verify response body': (r) => (r.body as string).includes('credentialJWT') }))
  iterationsCompleted.add(1)
}

export function FaceToFace (): void {
  let res: Response
  const iteration = execution.scenario.iterationInInstance
  const paths = ['UKPassport', 'NationalIDEEA', 'EU-DL', 'Non-UKPassport', 'BRP', 'UKDL']
  const path = paths[(iteration) % paths.length]
  const expiry = randomDate(new Date(2024, 1, 1), new Date(2024, 12, 31))
  const expiryDay = expiry.getDate().toString()
  const expiryMonth = (expiry.getMonth() + 1).toString()
  const expiryYear = expiry.getFullYear().toString()
  iterationsStarted.add(1)

  res = group('B02_FaceToFace_01_IPVStubCall POST', () =>
    timeRequest(() => http.post(env.F2F.ipvStub + '/start',
      JSON.stringify({
        yotiMockID: '0000'
      }),
      {
        tags: { name: 'B02_FaceToFace_01_IPVStubCall' }
      }),
    {
      'is status 201': (r) => r.status === 201,
      ...pageContentCheck(b64encode('{"alg":"RSA', 'rawstd'))
    }))
  const authorizeLocation = getAuthorizeauthorizeLocation(res)
  const clientId = getClientID(res)

  res = group('B02_FaceToFace_02_Authorize GET', () =>
    timeRequest(() => http.get(authorizeLocation, {
      tags: { name: 'B02_FaceToFace_02_Authorize' }
    }),
    { isStatusCode200, ...pageContentCheck('How to prove your identity at a Post Office') }))

  sleepBetween(1, 3)

  res = group('B02_FaceToFace_03_Continue POST', () =>
    timeRequest(() =>
      res.submitForm({
        params: { tags: { name: 'B02_FaceToFace_03_Continue' } },
        submitSelector: '#landingPageContinue'
      }),
    { isStatusCode200, ...pageContentCheck('Choose which photo ID you can take to a Post Office') }))

  sleepBetween(1, 3)

  switch (path) {
    case 'UKPassport':
      res = group('B02_FaceToFace_04_UKPassport_ChoosePhotoId POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { photoIdChoice: 'ukPassport' },
            submitSelector: '#continue',
            params: { tags: { name: 'B02_FaceToFace_04_UKPassport_ChoosePhotoId' } }
          }),
        {
          isStatusCode200, ...pageContentCheck('When does your passport expire?')
        }))

      sleepBetween(1, 3)

      res = group('B02_FaceToFace_05_UKPassport_PassportDetails POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: {
              'ukPassportExpiryDate-day': expiryDay,
              'ukPassportExpiryDate-month': expiryMonth,
              'ukPassportExpiryDate-year': expiryYear
            },
            params: { tags: { name: 'B02_FaceToFace_05_UKPassport_PassportDetails' } },
            submitSelector: '#continue'
          }),
        { isStatusCode200, ...pageContentCheck('Find a Post Office where you can prove your identity') }))
      break
    case 'NationalIDEEA':
      res = group('B02_FaceToFace_04_NationalIDEEA_ChoosePhotoId POST', () =>
        timeRequest(() => res.submitForm({
          fields: { photoIdChoice: 'eeaIdentityCard' },
          params: { tags: { name: 'B02_FaceToFace_04_NationalIDEEA_ChoosePhotoId' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('Does your national identity card have an expiry date?') }))

      sleepBetween(1, 3)

      res = group('B02_FaceToFace_05_NationalIDEEA_ExpiryOption POST', () =>
        timeRequest(() => res.submitForm({
          fields: { idHasExpiryDate: 'Yes' },
          params: { tags: { name: 'B02_FaceToFace_05_NationalIDEEA_ExpiryOption' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('When does your national identity card expire?') }))

      sleepBetween(1, 3)

      res = group('B02_FaceToFace_06_NationalIDEEA_Details POST', () =>
        timeRequest(() => res.submitForm({
          fields: {
            'eeaIdCardExpiryDate-day': expiryDay,
            'eeaIdCardExpiryDate-month': expiryMonth,
            'eeaIdCardExpiryDate-year': expiryYear
          },
          params: { tags: { name: 'B02_FaceToFace_06_NationalIDEEA_Details' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('Does your national identity card have your current address on it?') }))

      sleepBetween(1, 3)

      res = group('B02_FaceToFace_07_NationalIDEEA_CurrentAddress POST', () =>
        timeRequest(() => res.submitForm({
          fields: { eeaIdCardAddressCheck: 'Yes, it has my current address on it' },
          params: { tags: { name: 'B02_FaceToFace_07_NationalIDEEA_CurrentAddress' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('Select which country your national identity card is from') }))

      sleepBetween(1, 3)

      res = group('B02_FaceToFace_08_NationalIDEEA_WhichCountry POST', () =>
        timeRequest(() => res.submitForm({
          fields: { eeaIdentityCardCountrySelector: 'Romania' },
          params: { tags: { name: 'B02_FaceToFace_08_NationalIDEEA_WhichCountry' } }, // pragma: allowlist secret
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('Find a Post Office where you can prove your identity') }))
      break
    case 'EU-DL':
      res = group('B02_FaceToFace_04_EUDL_ChoosePhotoId POST', () =>
        timeRequest(() => res.submitForm({
          fields: { photoIdChoice: 'euPhotocardDl' },
          params: { tags: { name: 'B02_FaceToFace_04_EUDL_ChoosePhotoId' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('Does your driving licence have an expiry date?') }))

      sleepBetween(1, 3)

      res = group('B02_FaceToFace_05_EUDL_ExpiryOption POST', () =>
        timeRequest(() => res.submitForm({
          fields: { idHasExpiryDate: 'Yes' },
          params: { tags: { name: 'B02_FaceToFace_05_EUDL_ExpiryOption' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('When does your driving licence expire?') }))
      sleepBetween(1, 3)

      res = group('B02_FaceToFace_06_EUDL_Details POST', () =>
        timeRequest(() => res.submitForm({
          fields: {
            'euPhotocardDlExpiryDate-day': expiryDay,
            'euPhotocardDlExpiryDate-month': expiryMonth,
            'euPhotocardDlExpiryDate-year': expiryYear
          },
          params: { tags: { name: 'B02_FaceToFace_06_EUDL_Details' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('Does your driving licence have your current address on it?') }))

      sleepBetween(1, 3)

      res = group('B02_FaceToFace_07_EUDL_CurrentAddress POST', () =>
        timeRequest(() => res.submitForm({
          fields: { euDrivingLicenceAddressCheck: 'Yes, it has my current address on it' },
          params: { tags: { name: 'B02_FaceToFace_07_EUDL_CurrentAddress' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('Select which country your driving licence is from') }))

      sleepBetween(1, 3)

      res = group('B02_FaceToFace_08_EUDL_WhichCountry POST', () =>
        timeRequest(() => res.submitForm({
          fields: { euDrivingLicenceCountrySelector: 'Romania' },
          params: { tags: { name: 'B02_FaceToFace_08_EUDL_WhichCountry' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('Find a Post Office where you can prove your identity') }))
      break
    case 'Non-UKPassport':
      res = group('B02_FaceToFace_04_NonUKPassport_ChoosePhotoId POST', () =>
        timeRequest(() => res.submitForm({
          fields: { photoIdChoice: 'nonUkPassport' },
          params: { tags: { name: 'B02_FaceToFace_04_NonUKPassport_ChoosePhotoId' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('Does your passport have an expiry date?') }))

      sleepBetween(1, 3)

      res = group('B02_FaceToFace_05_NonUKPassport_ExpiryOption POST', () =>
        timeRequest(() => res.submitForm({
          fields: { idHasExpiryDate: 'Yes' },
          params: { tags: { name: 'B02_FaceToFace_05_NonUKPassport_ExpiryOption' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('When does your passport expire?') }))

      sleepBetween(1, 3)

      res = group('B02_FaceToFace_06_NonUKPassport_Details POST', () =>
        timeRequest(() => res.submitForm({
          fields: {
            'nonUKPassportExpiryDate-day': expiryDay,
            'nonUKPassportExpiryDate-month': expiryMonth,
            'nonUKPassportExpiryDate-year': expiryYear
          },
          params: { tags: { name: 'B02_FaceToFace_06_NonUKPassport_Details' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('Select which country your passport is from') }))

      sleepBetween(1, 3)

      res = group('B02_FaceToFace_07_NonUKPassport_WhichCountry POST', () =>
        timeRequest(() => res.submitForm({
          fields: { nonUkPassportCountrySelector: 'Romania' },
          params: { tags: { name: 'B02_FaceToFace_07_NonUKPassport_WhichCountry' } }, // pragma: allowlist secret
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('Find a Post Office where you can prove your identity') }))
      break
    case 'BRP':
      res = group('B02_FaceToFace_04_BRP_ChoosePhotoId POST', () =>
        timeRequest(() => res.submitForm({
          fields: { photoIdChoice: 'brp' },
          params: { tags: { name: 'B02_FaceToFace_04_BRP_ChoosePhotoId' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('When does your biometric residence permit (BRP) expire?') }))

      sleepBetween(1, 3)

      res = group('B02_FaceToFace_05_BRP_Details POST', () =>
        timeRequest(() => res.submitForm({
          fields: {
            'brpExpiryDate-day': expiryDay,
            'brpExpiryDate-month': expiryMonth,
            'brpExpiryDate-year': expiryYear
          },
          params: { tags: { name: 'B02_FaceToFace_05_BRP_Details' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('Find a Post Office where you can prove your identity') }))
      break
    case 'UKDL':
      res = group('B02_FaceToFace_04_UKDL_ChoosePhotoId POST', () =>
        timeRequest(() => res.submitForm({
          fields: { photoIdChoice: 'ukPhotocardDl' },
          params: { tags: { name: 'B02_FaceToFace_04_UKDL_ChoosePhotoId' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('When does your driving licence expire?') }))

      sleepBetween(1, 3)

      res = group('B02_FaceToFace_05_UKDL_Details POST', () =>
        timeRequest(() => res.submitForm({
          fields: {
            'ukPhotocardDlExpiryDate-day': expiryDay,
            'ukPhotocardDlExpiryDate-month': expiryMonth,
            'ukPhotocardDlExpiryDate-year': expiryYear
          },
          params: { tags: { name: 'B02_FaceToFace_05_UKDL_Details' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('Does your driving licence have your current address on it?') }))

      res = group('B02_FaceToFace_06_UKDL_CurrentAddress POST', () =>
        timeRequest(() => res.submitForm({
          fields: { ukDlAddressCheck: 'Yes' },
          params: { tags: { name: 'B02_FaceToFace_06_UKDL_CurrentAddress' } },
          submitSelector: '#continue'
        }),
        { isStatusCode200, ...pageContentCheck('Find a Post Office where you can prove your identity') }))
      break
    default:
      fail('Invalid path')
  }

  sleepBetween(1, 3)

  res = group('B02_FaceToFace_08_FindPostOffice POST', () =>
    timeRequest(() => res.submitForm({
      fields: { postcode: 'SW1A 2AA' },
      params: { tags: { name: 'B02_FaceToFace_08_FindPostOffice' } },
      submitSelector: '#continue'
    }),
    { isStatusCode200, ...pageContentCheck('Choose a Post Office where you can prove your identity') }))

  sleepBetween(1, 3)

  res = group('B02_FaceToFace_09_ChoosePostOffice POST', () =>
    timeRequest(() => res.submitForm({
      fields: { branches: '1' },
      params: { tags: { name: 'B02_FaceToFace_09_ChoosePostOffice' } },
      submitSelector: '#continue'
    }),
    { isStatusCode200, ...pageContentCheck('Check your answers') }))

  sleepBetween(1, 3)

  res = group('B02_FaceToFace_10_CheckDetails POST', () =>
    timeRequest(() => res.submitForm({
      params: { tags: { name: 'B02_FaceToFace_10_CheckDetails' } },
      submitSelector: '#continue'
    }),
    {
      'verify url body': (r) =>
        (r.url).includes(clientId)
    }))
  const codeUrl = getCodeFromUrl(res.url)

  sleepBetween(1, 3)

  res = group('B02_FaceToFace_11_SendAuthorizationCode POST', () =>
    timeRequest(() => http.post(env.F2F.target + '/token', {
      grant_type: 'authorization_code',
      code: codeUrl,
      redirect_uri: env.F2F.ipvStub + '/redirect?id=f2f'
    }, {
      tags: { name: 'B02_FaceToFace_11_SendAuthorizationCode' }
    }),
    { isStatusCode200, ...pageContentCheck('access_token') }))
  const accessToken = getAccessToken(res)

  sleepBetween(1, 3)

  const authHeader = `Bearer ${accessToken}`
  const options = {
    headers: {
      Authorization: authHeader
    },
    tags: { name: 'B02_FaceToFace_12_SendBearerToken' }
  }
  res = group('B02_FaceToFace_12_SendBearerToken POST', () =>
    timeRequest(() => http.post(env.F2F.target + '/userinfo', {}, options),
      {
        'is status 202': (r) => r.status === 202,
        ...pageContentCheck('sub')
      }))
  iterationsCompleted.add(1)
}

function randomDate (start: Date, end: Date): Date {
  const diff = Math.abs(+end - +start)
  const min = Math.min(+end, +start)
  return new Date(min + (diff * Math.random()))
}
