import { sleep } from 'k6'
import { SharedArray } from 'k6/data'
import execution from 'k6/execution'
import http, { type Response } from 'k6/http'
import { type Options } from 'k6/options'
import TOTP from '../common/utils/authentication/totp'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
import { timeGroup } from '../common/utils/request/timing'
import { getEnv } from '../common/utils/config/environment-variables'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('signIn', LoadProfile.smoke),
    ...createScenario('signUp', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('signIn', LoadProfile.short, 30),
    ...createScenario('signUp', LoadProfile.short, 30)
  },
  load10: {
    ...createScenario('signIn', LoadProfile.short, 190),
    ...createScenario('signUp', LoadProfile.short, 10)
  },
  load: {
    ...createScenario('signIn', LoadProfile.full, 1000)
  },
  stress: {
    ...createScenario('signIn', LoadProfile.full, 2000),
    ...createScenario('signUp', LoadProfile.full, 100)
  },
  rampOnly: {
    ...createScenario('signUp', LoadProfile.rampOnly, 30)
  }
}
const loadProfile = selectProfile(profiles)
const groupMap = {
  signUp: [
    'B01_SignUp_01_InitializeJourney',
    'B01_SignUp_01_InitializeJourney::01_RPStub',
    'B01_SignUp_01_InitializeJourney::02_OIDCCall',
    'B01_SignUp_01_InitializeJourney::03_AuthCall',
    'B01_SignUp_02_CreateOneLogin',
    'B01_SignUp_03_EnterEmailAddress',
    'B01_SignUp_04_EnterOTP',
    'B01_SignUp_05_CreatePassword',
    'B01_SignUp_06_MFA_AuthApp',
    'B01_SignUp_07_MFA_EnterTOTP',
    'B01_SignUp_08_MFA_SMS',
    'B01_SignUp_09_MFA_EnterPhoneNum',
    'B01_SignUp_10_MFA_EnterSMSOTP',
    'B01_SignUp_11_ContinueAccountCreated',
    'B01_SignUp_11_ContinueAccountCreated::01_AuthCall',
    'B01_SignUp_11_ContinueAccountCreated::02_OIDCCall',
    'B01_SignUp_11_ContinueAccountCreated::03_RPStub',
    'B01_SignUp_12_Logout',
    'B01_SignUp_12_Logout::01_RPStub',
    'B01_SignUp_12_Logout::02_OIDCCall',
    'B01_SignUp_12_Logout::03_AuthCall'
  ],
  signIn: [
    'B02_SignIn_01_InitializeJourney',
    'B02_SignIn_01_InitializeJourney::01_RPStub',
    'B02_SignIn_01_InitializeJourney::02_OIDCCall',
    'B02_SignIn_01_InitializeJourney::03_AuthCall',
    'B02_SignIn_02_ClickSignIn',
    'B02_SignIn_03_EnterEmailAddress',
    'B02_SignIn_04_AuthMFA_EnterPassword',
    'B02_SignIn_05_AuthMFA_EnterTOTP',
    'B02_SignIn_05_AuthMFA_EnterTOTP::01_AuthCall',
    'B02_SignIn_05_AuthMFA_EnterTOTP::02_OIDCCall',
    'B02_SignIn_05_AuthMFA_EnterTOTP::03_AuthAcceptTerms',
    'B02_SignIn_05_AuthMFA_EnterTOTP::03_RPStub',
    'B02_SignIn_06_SMSMFA_EnterPassword',
    'B02_SignIn_07_SMSMFA_EnterOTP',
    'B02_SignIn_07_SMSMFA_EnterOTP::01_AuthCall',
    'B02_SignIn_07_SMSMFA_EnterOTP::02_OIDCCall',
    'B02_SignIn_07_SMSMFA_EnterOTP::03_AuthAcceptTerms',
    'B02_SignIn_07_SMSMFA_EnterOTP::03_RPStub',
    'B02_SignIn_08_AcceptTermsConditions',
    'B02_SignIn_09_Logout',
    'B02_SignIn_09_Logout::01_RPStub',
    'B02_SignIn_09_Logout::02_OIDCCall',
    'B02_SignIn_09_Logout::03_AuthCall'
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

type mfaType = 'SMS' | 'AUTH_APP'
interface SignInData {
  email: string
  mfaOption: mfaType
}
const dataSignIn: SignInData[] = new SharedArray('data', () =>
  Array.from({ length: 10000 }, (_, i) => {
    const id: string = Math.floor(i / 2 + 1)
      .toString()
      .padStart(5, '0')
    if (i % 2 === 0) {
      return {
        email: `perftestAuth1_${id}@digital.cabinet-office.gov.uk`,
        mfaOption: 'AUTH_APP' as mfaType
      }
    } else {
      return {
        email: `perftestAuth2_${id}@digital.cabinet-office.gov.uk`,
        mfaOption: 'SMS' as mfaType
      }
    }
  })
)

const credentials = {
  authAppKey: getEnv('ACCOUNT_APP_KEY'),
  password: getEnv('ACCOUNT_APP_PASSWORD'),
  emailOTP: getEnv('ACCOUNT_EMAIL_OTP'),
  phoneOTP: getEnv('ACCOUNT_PHONE_OTP')
}

const env = {
  rpStub: getEnv('ACCOUNT_RP_STUB'),
  staticResources: __ENV.K6_NO_STATIC_RESOURCES !== 'true',
  authStagingURL: getEnv('ACCOUNT_STAGING_URL')
}

export function signUp(): void {
  let res: Response
  const groups = groupMap.signUp
  const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:]/g, '') // YYMMDDTHHmm
  const iteration = execution.scenario.iterationInInstance.toString().padStart(6, '0')
  const testEmail = `perftest${timestamp}${iteration}@digital.cabinet-office.gov.uk`
  const phoneNumber = '07700900000'
  let secretKey: string
  let totp: TOTP
  const mfaOption: mfaType = Math.random() <= 0.5 ? 'SMS' : 'AUTH_APP'
  iterationsStarted.add(1)

  // B01_SignUp_01_InitializeJourney
  timeGroup(groups[0], () => {
    // 01_RPStub
    res = timeGroup(groups[1].split('::')[1], () => http.get(env.rpStub + '/start', { redirects: 0 }), {
      isStatusCode302
    })
    // 02_OIDCCall
    res = timeGroup(groups[2].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
      isStatusCode302
    })
    // 03_AuthCall
    res = timeGroup(
      groups[3].split('::')[1],
      () => {
        if (env.staticResources) {
          const paths = [
            '/public/style.css',
            '/public/scripts/cookies.js',
            '/public/scripts/application.js',
            '/public/scripts/all.js',
            '/assets/images/govuk-crest-2x.png',
            '/assets/fonts/light-94a07e06a1-v2.woff2',
            '/assets/fonts/bold-b542beb274-v2.woff2'
          ]
          const batchRequests = paths.map(path => env.authStagingURL + path)
          http.batch(batchRequests)
        }
        return http.get(res.headers.Location)
      },
      {
        isStatusCode200,
        ...pageContentCheck('Create your GOV.UK One Login or sign in')
      }
    )
  })

  sleep(1)

  // B01_SignUp_02_CreateOneLogin
  res = timeGroup(
    groups[4],
    () =>
      res.submitForm({
        fields: {
          supportInternationalNumbers: 'true',
          optionSelected: 'create'
        }
      }),
    { isStatusCode200, ...pageContentCheck('Enter your email address') }
  )

  sleep(1)

  // B01_SignUp_03_EnterEmailAddress
  res = timeGroup(groups[5], () => res.submitForm({ fields: { email: testEmail } }), {
    isStatusCode200,
    ...pageContentCheck('Check your email')
  })

  sleep(1)

  // B01_SignUp_04_EnterOTP
  res = timeGroup(
    groups[6],
    () =>
      res.submitForm({
        fields: {
          email: testEmail.toLowerCase(),
          code: credentials.emailOTP
        }
      }),
    { isStatusCode200, ...pageContentCheck('Create your password') }
  )

  sleep(1)

  // B01_SignUp_05_CreatePassword
  res = timeGroup(
    groups[7],
    () =>
      res.submitForm({
        fields: {
          password: credentials.password,
          'confirm-password': credentials.password
        }
      }),
    {
      isStatusCode200,
      ...pageContentCheck('Choose how to get security codes')
    }
  )

  sleep(1)

  switch (
    mfaOption // Switch statement for either Auth App or SMS paths
  ) {
    case 'AUTH_APP': {
      // B01_SignUp_06_MFA_AuthApp
      res = timeGroup(
        groups[8],
        () =>
          res.submitForm({
            fields: { mfaOptions: mfaOption }
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Set up an authenticator app')
        }
      )

      secretKey = res.html().find("span[class*='secret-key-fragment']").text() ?? ''
      totp = new TOTP(secretKey)
      sleep(1)

      // B01_SignUp_07_MFA_EnterTOTP
      res = timeGroup(
        groups[9],
        () =>
          res.submitForm({
            fields: { code: totp.generateTOTP() }
          }),
        {
          isStatusCode200,
          ...pageContentCheck('You’ve created your GOV.UK One Login')
        }
      )
      break
    }
    case 'SMS': {
      // B01_SignUp_08_MFA_SMS
      res = timeGroup(
        groups[10],
        () =>
          res.submitForm({
            fields: { mfaOptions: mfaOption }
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Enter your mobile phone number')
        }
      )

      sleep(1)

      // B01_SignUp_09_MFA_EnterPhoneNum
      res = timeGroup(
        groups[11],
        () =>
          res.submitForm({
            fields: { phoneNumber }
          }),
        { isStatusCode200, ...pageContentCheck('Check your phone') }
      )

      sleep(1)

      // B01_SignUp_10_MFA_EnterSMSOTP
      res = timeGroup(
        groups[12],
        () =>
          res.submitForm({
            fields: { code: credentials.phoneOTP }
          }),
        {
          isStatusCode200,
          ...pageContentCheck('You’ve created your GOV.UK One Login')
        }
      )
      break
    }
  }

  sleep(1)

  // B01_SignUp_11_ContinueAccountCreated
  timeGroup(groups[13], () => {
    // 01_AuthCall
    res = timeGroup(groups[14].split('::')[1], () => res.submitForm({ params: { redirects: 1 } }), {
      isStatusCode302
    })
    // 02_OIDCCall
    res = timeGroup(groups[15].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
      isStatusCode302
    })
    // 03_RPStub
    res = timeGroup(groups[16].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck(testEmail.toLowerCase())
    })
  })

  // 25% of users logout
  if (Math.random() <= 0.25) {
    sleep(1)

    // B01_SignUp_12_Logout
    timeGroup(groups[17], () => {
      // 01_RPStub
      res = timeGroup(groups[18].split('::')[1], () => http.get(env.rpStub + '/logout', { redirects: 0 }), {
        isStatusCode302
      })
      // 02_OIDCCall
      res = timeGroup(groups[19].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
        isStatusCode302
      })
      // 03_AuthCall
      res = timeGroup(groups[20].split('::')[1], () => http.get(res.headers.Location), {
        isStatusCode200,
        ...pageContentCheck('You have signed out')
      })
    })
  }

  iterationsCompleted.add(1)
}

export function signIn(): void {
  let res: Response
  const groups = groupMap.signIn
  const userData = dataSignIn[execution.scenario.iterationInInstance % dataSignIn.length]
  iterationsStarted.add(1)

  // B02_SignIn_01_InitializeJourney
  timeGroup(groups[0], () => {
    // 01_RPStub
    res = timeGroup(groups[1].split('::')[1], () => http.get(env.rpStub + '/start', { redirects: 0 }), {
      isStatusCode302
    })
    // 02_OIDCCall
    res = timeGroup(groups[2].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
      isStatusCode302
    })
    // 03_AuthCall
    res = timeGroup(groups[3].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Create your GOV.UK One Login or sign in')
    })
  })

  sleep(1)

  // B02_SignIn_02_ClickSignIn
  res = timeGroup(groups[4], () => res.submitForm(), {
    isStatusCode200,
    ...pageContentCheck('Enter your email address to sign in to your GOV.UK One Login')
  })

  sleep(1)

  // B02_SignIn_03_EnterEmailAddress
  res = timeGroup(
    groups[5],
    () =>
      res.submitForm({
        fields: { email: userData.email }
      }),
    { isStatusCode200, ...pageContentCheck('Enter your password') }
  )

  sleep(1)

  let acceptNewTerms = false
  switch (userData.mfaOption) {
    case 'AUTH_APP': {
      // B02_SignIn_04_AuthMFA_EnterPassword
      res = timeGroup(
        groups[6],
        () =>
          res.submitForm({
            fields: { password: credentials.password }
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Enter the 6 digit security code shown in your authenticator app')
        }
      )

      sleep(1)

      const totp = new TOTP(credentials.authAppKey)
      // B02_SignIn_05_AuthMFA_EnterTOTP
      timeGroup(groups[7], () => {
        // 01_AuthCall
        res = timeGroup(
          groups[8].split('::')[1],
          () =>
            res.submitForm({
              fields: { code: totp.generateTOTP() },
              params: { redirects: 1 }
            }),
          { isStatusCode302 }
        )
        // 02_OIDCCall
        res = timeGroup(groups[9].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
          isStatusCode302
        })

        acceptNewTerms = res.headers.Location.includes('updated-terms-and-conditions')
        if (acceptNewTerms) {
          // 03_AuthAcceptTerms
          res = timeGroup(groups[10].split('::')[1], () => http.get(res.headers.Location), {
            isStatusCode200,
            ...pageContentCheck('terms of use update')
          })
        } else {
          // 03_RPStub
          res = timeGroup(groups[11].split('::')[1], () => http.get(res.headers.Location), {
            isStatusCode200,
            ...pageContentCheck(userData.email.toLowerCase())
          })
        }
      })
      break
    }
    case 'SMS': {
      // B02_SignIn_06_SMSMFA_EnterPassword
      res = timeGroup(
        groups[12],
        () =>
          res.submitForm({
            fields: { password: credentials.password }
          }),
        { isStatusCode200, ...pageContentCheck('Check your phone') }
      )

      sleep(1)

      // B02_SignIn_07_SMSMFA_EnterOTP
      timeGroup(groups[13], () => {
        // 01_AuthCall
        res = timeGroup(
          groups[14].split('::')[1],
          () =>
            res.submitForm({
              fields: { code: credentials.phoneOTP },
              params: { redirects: 1 }
            }),
          { isStatusCode302 }
        )
        // 02_OIDCCall
        res = timeGroup(groups[15].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
          isStatusCode302
        })

        acceptNewTerms = res.headers.Location.includes('updated-terms-and-conditions')

        if (acceptNewTerms) {
          // 03_AuthAcceptTerms
          res = timeGroup(groups[16].split('::')[1], () => http.get(res.headers.Location), {
            isStatusCode200,
            ...pageContentCheck('terms of use update')
          })
        } else {
          // 03_RPStub
          res = timeGroup(groups[17].split('::')[1], () => http.get(res.headers.Location), {
            isStatusCode200,
            ...pageContentCheck(userData.email.toLowerCase())
          })
        }
      })
      break
    }
  }

  if (acceptNewTerms) {
    // B02_SignIn_08_AcceptTermsConditions
    res = timeGroup(
      groups[18],
      () =>
        res.submitForm({
          fields: { termsAndConditionsResult: 'accept' }
        }),
      { isStatusCode200, ...pageContentCheck('User information') }
    )
  }

  // 25% of users logout
  if (Math.random() <= 0.25) {
    sleep(1)

    // B02_SignIn_09_Logout
    timeGroup(groups[19], () => {
      // 01_RPStub
      res = timeGroup(groups[20].split('::')[1], () => http.get(env.rpStub + '/logout', { redirects: 0 }), {
        isStatusCode302
      })
      // 02_OIDCCall
      res = timeGroup(groups[21].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
        isStatusCode302
      })
      // 03_AuthCall
      res = timeGroup(groups[22].split('::')[1], () => http.get(res.headers.Location), {
        isStatusCode200,
        ...pageContentCheck('You have signed out')
      })
    })
  }
  iterationsCompleted.add(1)
}
