import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { Trend } from 'k6/metrics'
import execution from 'k6/execution'
import { b64encode } from 'k6/encoding'

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
  envURL: __ENV.IDENTITY_KIWI_URL,
  envIPVStub: __ENV.IDENTITY_KIWI_STUB_URL,
  envTarget: __ENV.IDENTITY_KIWI_TARGET
}

const transactionDuration = new Trend('duration', true)

export function CIC (): void {
  let res: Response
  let requestValue: string
  let clientId: string
  let codeUrl: string
  let accessToken: string

  group('B01_CIC_01_IPVStubCall POST', () => {
    const startTime = Date.now()
    res = http.post(env.envIPVStub + '/start',
      JSON.stringify({
        target: env.envTarget
      }),
      {
        tags: { name: 'B01_CIC_01_IPVStubCall' }
      })
    const endTime = Date.now()
    check(res, {
      'is status 201': (r) => r.status === 201,
      'verify page content': (r) => (r.body as string).includes(b64encode('{"alg":"RSA', 'rawstd'))
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    requestValue = getRequestCode(res)
    clientId = getClientID(res)
  })

  group('B01_CIC_02_Authorize GET', () => {
    const startTime = Date.now()
    const endpoint = `/oauth2/authorize?request=${requestValue}&response_type=code&client_id=${clientId}`
    res = http.get(env.envURL + endpoint, {
      tags: { name: 'B01_CIC_02_Authorize' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Enter your name exactly as it appears on your photo ID')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  group('B01_CIC_03_UserDetails POST', () => {
    const startTime = Date.now()
    res.submitForm({
      fields: {
        surname: 'NameTest',
        firstName: 'FirstNameTest'
      },
      params: { tags: { name: 'B01_CIC_03_UserDetails' } },
      submitSelector: '#continue'
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Enter your date of birth')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_CIC_04_UserBirthdate POST', () => {
    const startTime = Date.now()
    res.submitForm({
      fields: {
        'dateOfBirth-day': '1',
        'dateOfBirth-month': '1',
        'dateOfBirth-year': '1985'
      },
      params: { tags: { name: 'B01_CIC_04_UserBirthdate' } },
      submitSelector: '#continue'
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Confirm your details')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  group('B01_CIC_05_CheckDetails POST', () => {
    const startTime = Date.now()
    res.submitForm({
      params: { tags: { name: 'B01_CIC_05_CheckDetails' } },
      submitSelector: '#continue'
    })
    const endTime = Date.now()

    check(res, {
      'verify url body': (r) =>
        (r.url).includes(clientId)
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    codeUrl = getCodeFromUrl(res.url)
  })

  sleep(Math.random() * 3)

  group('B01_CIC_06_SendAuthorizationCode POST', () => {
    const startTime = Date.now()
    res = http.post(env.envTarget + '/token', {
      grant_type: 'authorization_code',
      code: codeUrl,
      redirect_uri: env.envIPVStub + '/redirect'
    }, {
      tags: { name: 'B01_CIC_06_SendAuthorizationCode' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify response body': (r) => (r.body as string).includes('access_token')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    accessToken = getAccessToken(res)
  })

  sleep(Math.random() * 3)

  group('B01_CIC_07_SendBearerToken POST', () => {
    const startTime = Date.now()
    const authHeader = `Bearer ${accessToken}`
    const options = {
      headers: { Authorization: authHeader },
      tags: { name: 'B01_CIC_07_SendBearerToken' }
    }
    res = http.post(env.envTarget + '/userinfo', {}, options)
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify response body': (r) => (r.body as string).includes('credentialJWT')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

export function FaceToFace (): void {
  let res: Response
  let requestValue: string
  let clientId: string
  let accessToken: string
  let codeUrl: string
  const iteration = execution.scenario.iterationInInstance
  const paths = ['UKPassport', 'NationalIDEEA', 'EU-DL', 'Non-UKPassport', 'BRP', 'UKDL']
  const path = paths[(iteration) % paths.length]
  const expiry = randomDate(new Date(2024, 1, 1), new Date(2024, 12, 31))
  const expiryDay = expiry.getDate().toString()
  const expiryMonth = (expiry.getMonth() + 1).toString()
  const expiryYear = expiry.getFullYear().toString()

  group('B02_FaceToFace_01_IPVStubCall POST', () => {
    const startTime = Date.now()
    res = http.post(env.envIPVStub + '/start',
      JSON.stringify({
        yotiMockID: '0000'
      }),
      {
        tags: { name: 'B02_FaceToFace_01_IPVStubCall' }
      })
    const endTime = Date.now()
    check(res, {
      'is status 201': (r) => r.status === 201,
      'verify page content': (r) => (r.body as string).includes(b64encode('{"alg":"RSA', 'rawstd'))
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    requestValue = getRequestCode(res)
    clientId = getClientID(res)
  })

  group('B02_FaceToFace_02_Authorize GET', () => {
    const startTime = Date.now()
    const endpoint = `/oauth2/authorize?request=${requestValue}&response_type=code&client_id=${clientId}`
    res = http.get(env.envURL + endpoint, {
      tags: { name: 'B02_FaceToFace_02_Authorize' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('How to prove your identity at a Post Office')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_FaceToFace_03_Continue POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      params: { tags: { name: 'B02_FaceToFace_03_Continue' } },
      submitSelector: '#landingPageContinue'
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Choose which photo ID you can take to a Post Office')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  switch (path) {
    case 'UKPassport':
      group('B02_FaceToFace_04_UKPassport_ChoosePhotoId POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { photoIdChoice: 'ukPassport' },
          submitSelector: '#continue',
          params: { tags: { name: 'B02_FaceToFace_04_UKPassport_ChoosePhotoId' } }
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('When does your passport expire?')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })

      sleep(Math.random() * 3)

      group('B02_FaceToFace_05_UKPassport_PassportDetails POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: {
            'ukPassportExpiryDate-day': expiryDay,
            'ukPassportExpiryDate-month': expiryMonth,
            'ukPassportExpiryDate-year': expiryYear
          },
          params: { tags: { name: 'B02_FaceToFace_05_UKPassport_PassportDetails' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Find a Post Office where you can prove your identity')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })
      break
    case 'NationalIDEEA':
      group('B02_FaceToFace_04_NationalIDEEA_ChoosePhotoId POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { photoIdChoice: 'eeaIdentityCard' },
          params: { tags: { name: 'B02_FaceToFace_04_NationalIDEEA_ChoosePhotoId' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Does your national identity card have an expiry date?')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })

      sleep(Math.random() * 3)

      group('B02_FaceToFace_05_NationalIDEEA_ExpiryOption POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { idHasExpiryDate: 'Yes' },
          params: { tags: { name: 'B02_FaceToFace_05_NationalIDEEA_ExpiryOption' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()
        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('When does your national identity card expire?')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })

      sleep(Math.random() * 3)

      group('B02_FaceToFace_06_NationalIDEEA_Details POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: {
            'eeaIdCardExpiryDate-day': expiryDay,
            'eeaIdCardExpiryDate-month': expiryMonth,
            'eeaIdCardExpiryDate-year': expiryYear
          },
          params: { tags: { name: 'B02_FaceToFace_06_NationalIDEEA_Details' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()
        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Does your national identity card have your current address on it?')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })

      sleep(Math.random() * 3)

      group('B02_FaceToFace_07_NationalIDEEA_CurrentAddress POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { eeaIdCardAddressCheck: 'Yes, it has my current address on it' },
          params: { tags: { name: 'B02_FaceToFace_07_NationalIDEEA_CurrentAddress' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Select which country your national identity card is from')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })

      sleep(Math.random() * 3)

      group('B02_FaceToFace_08_NationalIDEEA_WhichCountry POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { eeaIdentityCardCountrySelector: 'Romania' },
          params: { tags: { name: 'B02_FaceToFace_08_NationalIDEEA_WhichCountry' } }, // pragma: allowlist secret
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Find a Post Office where you can prove your identity')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })
      break
    case 'EU-DL':
      group('B02_FaceToFace_04_EUDL_ChoosePhotoId POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { photoIdChoice: 'euPhotocardDl' },
          params: { tags: { name: 'B02_FaceToFace_04_EUDL_ChoosePhotoId' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Does your driving licence have an expiry date?')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })

      sleep(Math.random() * 3)

      group('B02_FaceToFace_05_EUDL_ExpiryOption POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { idHasExpiryDate: 'Yes' },
          params: { tags: { name: 'B02_FaceToFace_05_EUDL_ExpiryOption' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('When does your driving licence expire?')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })
      sleep(Math.random() * 3)

      group('B02_FaceToFace_06_EUDL_Details POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: {
            'euPhotocardDlExpiryDate-day': expiryDay,
            'euPhotocardDlExpiryDate-month': expiryMonth,
            'euPhotocardDlExpiryDate-year': expiryYear
          },
          params: { tags: { name: 'B02_FaceToFace_06_EUDL_Details' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Does your driving licence have your current address on it?')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })

      sleep(Math.random() * 3)

      group('B02_FaceToFace_07_EUDL_CurrentAddress POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { euDrivingLicenceAddressCheck: 'Yes, it has my current address on it' },
          params: { tags: { name: 'B02_FaceToFace_07_EUDL_CurrentAddress' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()
        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Select which country your driving licence is from')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })

      sleep(Math.random() * 3)

      group('B02_FaceToFace_08_EUDL_WhichCountry POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { euDrivingLicenceCountrySelector: 'Romania' },
          params: { tags: { name: 'B02_FaceToFace_08_EUDL_WhichCountry' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Find a Post Office where you can prove your identity')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })
      break
    case 'Non-UKPassport':
      group('B02_FaceToFace_04_NonUKPassport_ChoosePhotoId POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { photoIdChoice: 'nonUkPassport' },
          params: { tags: { name: 'B02_FaceToFace_04_NonUKPassport_ChoosePhotoId' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Does your passport have an expiry date?')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })

      sleep(Math.random() * 3)

      group('B02_FaceToFace_05_NonUKPassport_ExpiryOption POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { idHasExpiryDate: 'Yes' },
          params: { tags: { name: 'B02_FaceToFace_05_NonUKPassport_ExpiryOption' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('When does your passport expire?')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })

      sleep(Math.random() * 3)

      group('B02_FaceToFace_06_NonUKPassport_Details POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: {
            'nonUKPassportExpiryDate-day': expiryDay,
            'nonUKPassportExpiryDate-month': expiryMonth,
            'nonUKPassportExpiryDate-year': expiryYear
          },
          params: { tags: { name: 'B02_FaceToFace_06_NonUKPassport_Details' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Select which country your passport is from')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })

      sleep(Math.random() * 3)

      group('B02_FaceToFace_07_NonUKPassport_WhichCountry POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { nonUkPassportCountrySelector: 'Romania' },
          params: { tags: { name: 'B02_FaceToFace_07_NonUKPassport_WhichCountry' } }, // pragma: allowlist secret
          submitSelector: '#continue'
        })
        const endTime = Date.now()
        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Find a Post Office where you can prove your identity')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })
      break
    case 'BRP':
      group('B02_FaceToFace_04_BRP_ChoosePhotoId POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { photoIdChoice: 'brp' },
          params: { tags: { name: 'B02_FaceToFace_04_BRP_ChoosePhotoId' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('When does your biometric residence permit (BRP) expire?')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })

      sleep(Math.random() * 3)

      group('B02_FaceToFace_05_BRP_Details POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: {
            'brpExpiryDate-day': expiryDay,
            'brpExpiryDate-month': expiryMonth,
            'brpExpiryDate-year': expiryYear
          },
          params: { tags: { name: 'B02_FaceToFace_05_BRP_Details' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Find a Post Office where you can prove your identity')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })
      break
    case 'UKDL':
      group('B02_FaceToFace_04_UKDL_ChoosePhotoId POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { photoIdChoice: 'ukPhotocardDl' },
          params: { tags: { name: 'B02_FaceToFace_04_UKDL_ChoosePhotoId' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('When does your driving licence expire?')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })

      sleep(Math.random() * 3)

      group('B02_FaceToFace_05_UKDL_Details POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: {
            'ukPhotocardDlExpiryDate-day': expiryDay,
            'ukPhotocardDlExpiryDate-month': expiryMonth,
            'ukPhotocardDlExpiryDate-year': expiryYear
          },
          params: { tags: { name: 'B02_FaceToFace_05_UKDL_Details' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()
        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Does your driving licence have your current address on it?')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })

      group('B02_FaceToFace_06_UKDL_CurrentAddress POST', () => {
        const startTime = Date.now()
        res = res.submitForm({
          fields: { ukDlAddressCheck: 'Yes' },
          params: { tags: { name: 'B02_FaceToFace_06_UKDL_CurrentAddress' } },
          submitSelector: '#continue'
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Find a Post Office where you can prove your identity')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })
      break
    default:
      fail('Invalid path')
  }

  sleep(Math.random() * 3)

  group('B02_FaceToFace_08_FindPostOffice POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      fields: { postcode: 'SW1A 2AA' },
      params: { tags: { name: 'B02_FaceToFace_08_FindPostOffice' } },
      submitSelector: '#continue'
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Choose a Post Office where you can prove your identity')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_FaceToFace_09_ChoosePostOffice POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      fields: { branches: '1' },
      params: { tags: { name: 'B02_FaceToFace_09_ChoosePostOffice' } },
      submitSelector: '#continue'
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Check your answers')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_FaceToFace_10_CheckDetails POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      params: { tags: { name: 'B02_FaceToFace_10_CheckDetails' } },
      submitSelector: '#continue'
    })
    const endTime = Date.now()

    check(res, {
      'verify url body': (r) =>
        (r.url).includes(clientId)
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    codeUrl = getCodeFromUrl(res.url)
  })

  sleep(Math.random() * 3)

  group('B02_FaceToFace_11_SendAuthorizationCode POST', () => {
    const startTime = Date.now()
    res = http.post(env.envTarget + '/token', {
      grant_type: 'authorization_code',
      code: codeUrl,
      redirect_uri: env.envIPVStub + '/redirect'
    }, {
      tags: { name: 'B02_FaceToFace_11_SendAuthorizationCode' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify response body': (r) => (r.body as string).includes('access_token')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    accessToken = getAccessToken(res)
  })

  sleep(Math.random() * 3)

  group('B02_FaceToFace_12_SendBearerToken POST', () => {
    const startTime = Date.now()
    const authHeader = `Bearer ${accessToken}`
    const options = {
      headers: {
        Authorization: authHeader
      },
      tags: { name: 'B02_FaceToFace_12_SendBearerToken' }
    }
    res = http.post(env.envTarget + '/userinfo', {}, options)
    const endTime = Date.now()

    check(res, {
      'is status 202': (r) => r.status === 202,
      'verify response body': (r) => (r.body as string).includes('sub')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

function randomDate (start: Date, end: Date): Date {
  const diff = Math.abs(+end - +start)
  const min = Math.min(+end, +start)
  return new Date(min + (diff * Math.random()))
}

function getRequestCode (r: Response): string {
  const request = r.json('request')
  if (request !== null && typeof request === 'string') return request
  fail('Request not found')
}

function getClientID (r: Response): string {
  const clientId = r.json('clientId')
  if (clientId !== null && typeof clientId === 'string') return clientId
  fail('Client ID not found')
}

function getCodeFromUrl (url: string): string {
  const code = url.match(/code=([^&]*)/)
  if (code?.[1] != null) return code[1]
  fail('Code not found')
}

function getAccessToken (r: Response): string {
  const accessToken = r.json('access_token')
  if (accessToken !== null && typeof accessToken === 'string') return accessToken
  fail('AccessToken not found')
}
