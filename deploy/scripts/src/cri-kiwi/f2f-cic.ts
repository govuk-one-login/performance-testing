import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { group, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { selectProfile, type ProfileList, describeProfile, createScenario, LoadProfile } from '../common/utils/config/load-profiles'
import execution from 'k6/execution'
import { b64encode } from 'k6/encoding'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getAuthorizeauthorizeLocation, getClientID, getCodeFromUrl, getAccessToken } from './utils/authorization'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('FaceToFace', LoadProfile.smoke),
    ...createScenario('CIC', LoadProfile.smoke)
  },
  load: {
    ...createScenario('FaceToFace', LoadProfile.short, 3),
    ...createScenario('CIC', LoadProfile.short, 3, 3)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  CIC: [
    'B01_BAV_01_IPVStubCall',
    'B01_BAV_02_Authorize',
    'B01_BAV_03_Continue',
    'B01_BAV_04_BankDetails',
    'B01_BAV_05_CheckDetails',
    'B01_BAV_06_SendAuthorizationCode',
    'B01_BAV_07_SendBearerToken'
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
    'B02_FaceToFace_04_BRP_ChoosePhotoId',
    'B02_FaceToFace_05_BRP_Details',
    'B02_FaceToFace_04_UKDL_ChoosePhotoId',
    'B02_FaceToFace_05_UKDL_Details',
    'B02_FaceToFace_06_UKDL_CurrentAddress',
    'B02_FaceToFace_08_FindPostOffice',
    'B02_FaceToFace_09_ChoosePostOffice',
    'B02_FaceToFace_10_CheckDetails',
    'B02_FaceToFace_11_SendAuthorizationCode',
    'B02_FaceToFace_12_SendBearerToken'
  ]
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
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
  const groups = groupMap.CIC
  let res: Response
  iterationsStarted.add(1)

  res = group(groups[0], () => timeRequest(() => // B01_CIC_01_IPVStubCall
    http.post(env.CIC.ipvStub + '/start',
      JSON.stringify({
        target: env.CIC.target
      })),
  {
    'is status 201': (r) => r.status === 201,
    ...pageContentCheck(b64encode('{"alg":"RSA', 'rawstd'))
  }))
  const authorizeLocation = getAuthorizeauthorizeLocation(res)
  const clientId = getClientID(res)

  res = group(groups[1], () => timeRequest(() => // B01_CIC_02_Authorize
    http.get(authorizeLocation),
  { isStatusCode200, ...pageContentCheck('Enter your name exactly as it appears on your photo ID') }))

  res = group(groups[2], () => timeRequest(() => // B01_CIC_03_UserDetails
    res.submitForm({
      fields: {
        surname: 'NameTest',
        firstName: 'FirstNameTest'
      },
      submitSelector: '#continue'
    }),
  { isStatusCode200, ...pageContentCheck('Enter your date of birth') }))

  sleepBetween(1, 3)

  res = group(groups[3], () => timeRequest(() => // B01_CIC_04_UserBirthdate
    res.submitForm({
      fields: {
        'dateOfBirth-day': '1',
        'dateOfBirth-month': '1',
        'dateOfBirth-year': '1985'
      },
      submitSelector: '#continue'
    }),
  { isStatusCode200, ...pageContentCheck('Confirm your details') }))

  res = group(groups[4], () => timeRequest(() => // B01_CIC_05_CheckDetails
    res.submitForm({
      submitSelector: '#continue'
    }),
  {
    'verify url body': (r) =>
      (r.url).includes(clientId)
  }))
  const codeUrl = getCodeFromUrl(res.url)

  sleepBetween(1, 3)

  res = group(groups[5], () => timeRequest(() => // B01_CIC_06_SendAuthorizationCode
    http.post(env.CIC.target + '/token', {
      grant_type: 'authorization_code',
      code: codeUrl,
      redirect_uri: env.CIC.ipvStub + '/redirect'
    }),
  { isStatusCode200, ...pageContentCheck('access_token') }))

  const accessToken = getAccessToken(res)

  sleepBetween(1, 3)

  const authHeader = `Bearer ${accessToken}`
  const options = {
    headers: { Authorization: authHeader }
  }
  res = group(groups[6], () => timeRequest(() => // B01_CIC_07_SendBearerToken
    http.post(env.CIC.target + '/userinfo', {}, options),
  { isStatusCode200, ...pageContentCheck('credentialJWT') }))
  iterationsCompleted.add(1)
}

export function FaceToFace (): void {
  const groups = groupMap.FaceToFace
  let res: Response
  const iteration = execution.scenario.iterationInInstance
  const paths = ['UKPassport', 'NationalIDEEA', 'EU-DL', 'Non-UKPassport', 'BRP', 'UKDL']
  const path = paths[(iteration) % paths.length]
  const expiry = randomDate(new Date(2024, 1, 1), new Date(2024, 12, 31))
  const expiryDay = expiry.getDate().toString()
  const expiryMonth = (expiry.getMonth() + 1).toString()
  const expiryYear = expiry.getFullYear().toString()
  iterationsStarted.add(1)

  res = group(groups[0], () => timeRequest(() => // B02_FaceToFace_01_IPVStubCall
    http.post(env.F2F.ipvStub + '/start',
      JSON.stringify({
        yotiMockID: '0000'
      })),
  {
    'is status 201': (r) => r.status === 201,
    ...pageContentCheck(b64encode('{"alg":"RSA', 'rawstd'))
  }))
  const authorizeLocation = getAuthorizeauthorizeLocation(res)
  const clientId = getClientID(res)

  res = group(groups[1], () => timeRequest(() => // B02_FaceToFace_02_Authorize
    http.get(authorizeLocation),
  { isStatusCode200, ...pageContentCheck('How to prove your identity at a Post Office') }))

  sleepBetween(1, 3)

  res = group(groups[2], () => timeRequest(() => // B02_FaceToFace_03_Continue
    res.submitForm({
      submitSelector: '#landingPageContinue'
    }),
  { isStatusCode200, ...pageContentCheck('Choose which photo ID you can take to a Post Office') }))

  sleepBetween(1, 3)

  switch (path) {
    case 'UKPassport':
      res = group(groups[3], () => timeRequest(() => // B02_FaceToFace_04_UKPassport_ChoosePhotoId
        res.submitForm({
          fields: { photoIdChoice: 'ukPassport' },
          submitSelector: '#continue'
        }),
      {
        isStatusCode200, ...pageContentCheck('When does your passport expire?')
      }))

      sleepBetween(1, 3)

      res = group(groups[4], () => timeRequest(() => // B02_FaceToFace_05_UKPassport_PassportDetails
        res.submitForm({
          fields: {
            'ukPassportExpiryDate-day': expiryDay,
            'ukPassportExpiryDate-month': expiryMonth,
            'ukPassportExpiryDate-year': expiryYear
          },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Find a Post Office where you can prove your identity') }))
      break
    case 'NationalIDEEA':
      res = group(groups[5], () => timeRequest(() => // B02_FaceToFace_04_NationalIDEEA_ChoosePhotoId
        res.submitForm({
          fields: { photoIdChoice: 'eeaIdentityCard' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Does your national identity card have an expiry date?') }))

      sleepBetween(1, 3)

      res = group(groups[6], () => timeRequest(() => // B02_FaceToFace_05_NationalIDEEA_ExpiryOption
        res.submitForm({
          fields: { idHasExpiryDate: 'Yes' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('When does your national identity card expire?') }))

      sleepBetween(1, 3)

      res = group(groups[7], () => timeRequest(() => // B02_FaceToFace_06_NationalIDEEA_Details
        res.submitForm({
          fields: {
            'eeaIdCardExpiryDate-day': expiryDay,
            'eeaIdCardExpiryDate-month': expiryMonth,
            'eeaIdCardExpiryDate-year': expiryYear
          },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Does your national identity card have your current address on it?') }))

      sleepBetween(1, 3)

      res = group(groups[8], () => timeRequest(() => // B02_FaceToFace_07_NationalIDEEA_CurrentAddress
        res.submitForm({
          fields: { eeaIdCardAddressCheck: 'Yes, it has my current address on it' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Select which country your national identity card is from') }))

      sleepBetween(1, 3)

      res = group(groups[9], () => timeRequest(() => // B02_FaceToFace_08_NationalIDEEA_WhichCountry
        res.submitForm({
          fields: { eeaIdentityCardCountrySelector: 'Romania' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Find a Post Office where you can prove your identity') }))
      break
    case 'EU-DL':
      res = group(groups[10], () => timeRequest(() => // B02_FaceToFace_04_EUDL_ChoosePhotoId
        res.submitForm({
          fields: { photoIdChoice: 'euPhotocardDl' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Does your driving licence have an expiry date?') }))

      sleepBetween(1, 3)

      res = group(groups[11], () => timeRequest(() => // B02_FaceToFace_05_EUDL_ExpiryOption
        res.submitForm({
          fields: { idHasExpiryDate: 'Yes' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('When does your driving licence expire?') }))
      sleepBetween(1, 3)

      res = group(groups[12], () => timeRequest(() => // B02_FaceToFace_06_EUDL_Details
        res.submitForm({
          fields: {
            'euPhotocardDlExpiryDate-day': expiryDay,
            'euPhotocardDlExpiryDate-month': expiryMonth,
            'euPhotocardDlExpiryDate-year': expiryYear
          },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Does your driving licence have your current address on it?') }))

      sleepBetween(1, 3)

      res = group(groups[13], () => timeRequest(() => // B02_FaceToFace_07_EUDL_CurrentAddress
        res.submitForm({
          fields: { euDrivingLicenceAddressCheck: 'Yes, it has my current address on it' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Select which country your driving licence is from') }))

      sleepBetween(1, 3)

      res = group(groups[14], () => timeRequest(() => // B02_FaceToFace_08_EUDL_WhichCountry
        res.submitForm({
          fields: { euDrivingLicenceCountrySelector: 'Romania' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Find a Post Office where you can prove your identity') }))
      break
    case 'Non-UKPassport':
      res = group(groups[15], () => timeRequest(() => // B02_FaceToFace_04_NonUKPassport_ChoosePhotoId
        res.submitForm({
          fields: { photoIdChoice: 'nonUkPassport' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Does your passport have an expiry date?') }))

      sleepBetween(1, 3)

      res = group(groups[16], () => timeRequest(() => // B02_FaceToFace_05_NonUKPassport_ExpiryOption
        res.submitForm({
          fields: { idHasExpiryDate: 'Yes' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('When does your passport expire?') }))

      sleepBetween(1, 3)

      res = group(groups[17], () => timeRequest(() => // B02_FaceToFace_06_NonUKPassport_Details
        res.submitForm({
          fields: {
            'nonUKPassportExpiryDate-day': expiryDay,
            'nonUKPassportExpiryDate-month': expiryMonth,
            'nonUKPassportExpiryDate-year': expiryYear
          },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Select which country your passport is from') }))

      sleepBetween(1, 3)

      res = group(groups[18], () => timeRequest(() => // B02_FaceToFace_07_NonUKPassport_WhichCountry
        res.submitForm({
          fields: { nonUkPassportCountrySelector: 'Romania' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Find a Post Office where you can prove your identity') }))
      break
    case 'BRP':
      res = group(groups[19], () => timeRequest(() => // B02_FaceToFace_04_BRP_ChoosePhotoId
        res.submitForm({
          fields: { photoIdChoice: 'brp' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('When does your biometric residence permit (BRP) expire?') }))

      sleepBetween(1, 3)

      res = group(groups[20], () => timeRequest(() => // B02_FaceToFace_05_BRP_Details
        res.submitForm({
          fields: {
            'brpExpiryDate-day': expiryDay,
            'brpExpiryDate-month': expiryMonth,
            'brpExpiryDate-year': expiryYear
          },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Find a Post Office where you can prove your identity') }))
      break
    case 'UKDL':
      res = group(groups[21], () => timeRequest(() => // B02_FaceToFace_04_UKDL_ChoosePhotoId
        res.submitForm({
          fields: { photoIdChoice: 'ukPhotocardDl' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('When does your driving licence expire?') }))

      sleepBetween(1, 3)

      res = group(groups[22], () => timeRequest(() => // B02_FaceToFace_05_UKDL_Details
        res.submitForm({
          fields: {
            'ukPhotocardDlExpiryDate-day': expiryDay,
            'ukPhotocardDlExpiryDate-month': expiryMonth,
            'ukPhotocardDlExpiryDate-year': expiryYear
          },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Does your driving licence have your current address on it?') }))

      res = group(groups[23], () => timeRequest(() => // B02_FaceToFace_06_UKDL_CurrentAddress
        res.submitForm({
          fields: { ukDlAddressCheck: 'Yes' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Find a Post Office where you can prove your identity') }))
      break
    default:
      fail('Invalid path')
  }

  sleepBetween(1, 3)

  res = group(groups[24], () => timeRequest(() => // B02_FaceToFace_08_FindPostOffice
    res.submitForm({
      fields: { postcode: 'SW1A 2AA' },
      submitSelector: '#continue'
    }),
  { isStatusCode200, ...pageContentCheck('Choose a Post Office where you can prove your identity') }))

  sleepBetween(1, 3)

  res = group(groups[25], () => timeRequest(() => // B02_FaceToFace_09_ChoosePostOffice
    res.submitForm({
      fields: { branches: '1' },
      submitSelector: '#continue'
    }),
  { isStatusCode200, ...pageContentCheck('Check your answers') }))

  sleepBetween(1, 3)

  res = group(groups[26], () => timeRequest(() => // B02_FaceToFace_10_CheckDetails
    res.submitForm({
      submitSelector: '#continue'
    }),
  {
    'verify url body': (r) =>
      (r.url).includes(clientId)
  }))
  const codeUrl = getCodeFromUrl(res.url)

  sleepBetween(1, 3)

  res = group(groups[27], () => timeRequest(() => // B02_FaceToFace_11_SendAuthorizationCode
    http.post(env.F2F.target + '/token', {
      grant_type: 'authorization_code',
      code: codeUrl,
      redirect_uri: env.F2F.ipvStub + '/redirect?id=f2f'
    }),
  { isStatusCode200, ...pageContentCheck('access_token') }))
  const accessToken = getAccessToken(res)

  sleepBetween(1, 3)

  const authHeader = `Bearer ${accessToken}`
  const options = {
    headers: {
      Authorization: authHeader
    }
  }
  res = group(groups[28], () => timeRequest(() => // B02_FaceToFace_12_SendBearerToken
    http.post(env.F2F.target + '/userinfo', {}, options),
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
