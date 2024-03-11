import { group, sleep } from 'k6'
import { SharedArray } from 'k6/data'
import execution from 'k6/execution'
import http, { type Response } from 'k6/http'
import { type Options } from 'k6/options'
import TOTP from '../common/utils/authentication/totp'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { describeProfile, selectProfile, type ProfileList } from '../common/utils/config/load-profiles'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
import { randomString } from '../common/utils/jslib'
import { URL } from '../common/utils/jslib/url'
import { timeRequest } from '../common/utils/request/timing'

const profiles: ProfileList = {
  smoke: {
    signUp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '5s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'signUp'
    },
    signIn: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '5s',
      preAllocatedVUs: 1,
      maxVUs: 5,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'signIn'
    }
  },
  lowVolumeTest: {
    signUp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 900,
      stages: [
        { target: 30, duration: '15m' }, // Ramps up to 30 iterations per second in 15 minutes
        { target: 30, duration: '30m' }, // Maintain steady state at 30 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'signUp'
    },
    signIn: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 900,
      stages: [
        { target: 30, duration: '15m' }, // Ramps up to 30 iterations per second in 15 minutes
        { target: 30, duration: '30m' }, // Maintain steady state at 30 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'signIn'
    }
  },
  load: {
    signIn: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 6000,
      stages: [
        { target: 200, duration: '15m' }, // Ramps up to 200 iterations per second in 15 minutes
        { target: 200, duration: '30m' }, // Maintain steady state at 200 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'signIn'
    }
  },
  stress: {
    signUp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 3000,
      stages: [
        { target: 100, duration: '15m' }, // Ramps up to 100 iterations per second in 15 minutes
        { target: 100, duration: '30m' }, // Maintain steady state at 100 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'signUp'
    },
    signIn: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 60000,
      stages: [
        { target: 2000, duration: '15m' }, // Ramps up to 100 iterations per second in 15 minutes
        { target: 2000, duration: '30m' }, // Maintain steady state at 100 iterations per second for 30 minutes
        { target: 0, duration: '5m' } // Total ramp down in 5 minutes
      ],
      exec: 'signIn'
    }
  }
}
const loadProfile = selectProfile(profiles)
const groupMap = {
  signUp: [
    'B01_SignUp_01_InitializeJourney',
    'B01_SignUp_01_InitializeJourney::01_OIDCCall',
    'B01_SignUp_01_InitializeJourney::02_AuthCall',
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
    'B01_SignUp_12_Logout::03_RPStub'
  ],
  signIn: [
    'B02_SignIn_01_InitializeJourney',
    'B02_SignIn_01_InitializeJourney::01_OIDCCall',
    'B02_SignIn_01_InitializeJourney::02_AuthCall',
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
    'B02_SignIn_09_Logout::03_RPStub'
  ]
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap)
}

export function setup (): void {
  describeProfile(loadProfile)
};

type mfaType = 'SMS' | 'AUTH_APP'
interface signInData {
  email: string
  mfaOption: mfaType
}
const dataSignIn: signInData[] = new SharedArray('data', () => Array.from({ length: 10000 },
  (_, i) => {
    const id: string = Math.floor((i / 2) + 1).toString().padStart(5, '0')
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
  }
))

const credentials = {
  authAppKey: __ENV.ACCOUNT_APP_KEY,
  password: __ENV.ACCOUNT_APP_PASSWORD,
  emailOTP: __ENV.ACCOUNT_EMAIL_OTP,
  phoneOTP: __ENV.ACCOUNT_PHONE_OTP
}

function startJourneyUrl (): string {
  const url = new URL(__ENV.ACCOUNT_OP_URL)
  url.searchParams.append('client_id', __ENV.ACCOUNT_RP_STUB_CLIENT_ID)
  url.searchParams.append('nonce', randomString(20))
  url.searchParams.append('state', randomString(20))
  url.searchParams.append('vtr', '["Cl.Cm"]')
  url.searchParams.append('scope', 'openid email phone')
  url.searchParams.append('response_type', 'code')
  url.searchParams.append('redirect_uri', `${__ENV.ACCOUNT_RP_STUB}/oidc/authorization-code/callback`)
  return url.toString()
}

export function signUp (): void {
  let res: Response
  const groups = groupMap.signUp
  const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:]/g, '') // YYMMDDTHHmm
  const iteration = execution.scenario.iterationInInstance.toString().padStart(6, '0')
  const testEmail = `perftest${timestamp}${iteration}@digital.cabinet-office.gov.uk`
  const phoneNumber = '07700900000'
  let secretKey: string
  let totp: TOTP
  const mfaOption: mfaType = (Math.random() <= 0.5) ? 'SMS' : 'AUTH_APP'
  iterationsStarted.add(1)

  group(groups[0], () => {
    timeRequest(() => {
      res = group(groups[1].split('::')[1], () => timeRequest(() =>
        http.get(startJourneyUrl(), { redirects: 0 }), { isStatusCode302 }))
      res = group(groups[2].split('::')[1], () => timeRequest(() =>
        http.get(res.headers.Location), { isStatusCode200, ...pageContentCheck('Create a GOV.UK One Login or sign in') }))
    }, {})
  })

  sleep(1)

  res = group(groups[3], () => timeRequest(() =>
    res.submitForm({
      fields: {
        supportInternationalNumbers: 'true',
        optionSelected: 'create'
      }
    }),
  { isStatusCode200, ...pageContentCheck('Enter your email address') }))

  sleep(1)

  res = group(groups[4], () => timeRequest(() =>
    res.submitForm({ fields: { email: testEmail } }),
  { isStatusCode200, ...pageContentCheck('Check your email') }))

  sleep(1)

  res = group(groups[5], () => timeRequest(() =>
    res.submitForm({
      fields: {
        email: testEmail.toLowerCase(),
        code: credentials.emailOTP
      }
    }), { isStatusCode200, ...pageContentCheck('Create your password') }))

  sleep(1)

  res = group(groups[6], () => timeRequest(() =>
    res.submitForm({
      fields: {
        password: credentials.password,
        'confirm-password': credentials.password
      }
    }), { isStatusCode200, ...pageContentCheck('Choose how to get security codes') }))

  sleep(1)

  switch (mfaOption) { // Switch statement for either Auth App or SMS paths
    case 'AUTH_APP': {
      res = group(groups[7], () => timeRequest(() =>
        res.submitForm({
          fields: { mfaOptions: mfaOption }
        }), { isStatusCode200, ...pageContentCheck('Set up an authenticator app') }))

      secretKey = res.html().find("span[class*='secret-key-fragment']").text() ?? ''
      totp = new TOTP(secretKey)
      sleep(1)

      res = group(groups[8], () => timeRequest(() =>
        res.submitForm({
          fields: { code: totp.generateTOTP() }
        }), { isStatusCode200, ...pageContentCheck('You’ve created your GOV.UK One Login') }))
      break
    }
    case 'SMS': {
      res = group(groups[9], () => timeRequest(() =>
        res.submitForm({
          fields: { mfaOptions: mfaOption }
        }), { isStatusCode200, ...pageContentCheck('Enter your mobile phone number') }))

      sleep(1)

      res = group(groups[10], () => timeRequest(() =>
        res.submitForm({
          fields: { phoneNumber }
        }), { isStatusCode200, ...pageContentCheck('Check your phone') }))

      sleep(1)

      res = group(groups[11], () => timeRequest(() =>
        res.submitForm({
          fields: { code: credentials.phoneOTP }
        }), { isStatusCode200, ...pageContentCheck('You’ve created your GOV.UK One Login') }))
      break
    }
  }

  sleep(1)

  group(groups[12], () => {
    timeRequest(() => {
      res = group(groups[13].split('::')[1], () => timeRequest(() =>
        res.submitForm({ params: { redirects: 1 } }), { isStatusCode302 }))
      res = group(groups[14].split('::')[1], () => timeRequest(() =>
        http.get(res.headers.Location, { redirects: 0 }), { isStatusCode302 }))
      res = group(groups[15].split('::')[1], () => timeRequest(() =>
        http.get(res.headers.Location), { isStatusCode200, ...pageContentCheck('User information') }))
    }, {})
  })

  // 25% of users logout
  if (Math.random() <= 0.25) {
    sleep(1)

    group(groups[16], () => {
      timeRequest(() => {
        res = group(groups[17].split('::')[1], () => timeRequest(() =>
          res.submitForm({ params: { redirects: 0 } }),
        { isStatusCode302 }))
        res = group(groups[18].split('::')[1], () => timeRequest(() =>
          http.get(res.headers.Location, { redirects: 0 }),
        { isStatusCode302 }))
        res = group(groups[19].split('::')[1], () => timeRequest(() =>
          http.get(res.headers.Location),
        { isStatusCode200, ...pageContentCheck('Successfully signed out') }))
      }, {})
    })
  }

  iterationsCompleted.add(1)
}

export function signIn (): void {
  let res: Response
  const groups = groupMap.signIn
  const userData = dataSignIn[execution.scenario.iterationInInstance % dataSignIn.length]
  iterationsStarted.add(1)

  group(groups[0], () => {
    timeRequest(() => {
      res = group(groups[1].split('::')[1], () => timeRequest(() =>
        http.get(startJourneyUrl(), { redirects: 0 }), { isStatusCode302 }))
      res = group(groups[2].split('::')[1], () => timeRequest(() =>
        http.get(res.headers.Location), { isStatusCode200, ...pageContentCheck('Create a GOV.UK One Login or sign in') }))
    }, {})
  })

  sleep(1)

  res = group(groups[3], () => timeRequest(() =>
    res.submitForm(),
  { isStatusCode200, ...pageContentCheck('Enter your email address to sign in to your GOV.UK One Login') }))

  sleep(1)

  res = group(groups[4], () => timeRequest(() =>
    res.submitForm({
      fields: { email: userData.email }
    }), { isStatusCode200, ...pageContentCheck('Enter your password') }))

  sleep(1)

  let acceptNewTerms = false
  switch (userData.mfaOption) {
    case 'AUTH_APP': {
      res = group(groups[5], () =>
        timeRequest(() => res.submitForm({
          fields: { password: credentials.password }
        }), { isStatusCode200, ...pageContentCheck('Enter the 6 digit security code shown in your authenticator app') }))

      sleep(1)

      const totp = new TOTP(credentials.authAppKey)
      group(groups[6], () => {
        timeRequest(() => {
          res = group(groups[7].split('::')[1], () => timeRequest(() =>
            res.submitForm({
              fields: { code: totp.generateTOTP() },
              params: { redirects: 1 }
            }), { isStatusCode302 }))
          res = group(groups[8].split('::')[1], () => timeRequest(() =>
            http.get(res.headers.Location, { redirects: 0 }),
          { isStatusCode302 }))

          acceptNewTerms = res.headers.Location.includes('updated-terms-and-conditions')
          if (acceptNewTerms) {
            res = group(groups[9].split('::')[1], () => timeRequest(() =>
              http.get(res.headers.Location),
            { isStatusCode200, ...pageContentCheck('terms of use update') }))
          } else {
            res = group(groups[10].split('::')[1], () => timeRequest(() =>
              http.get(res.headers.Location),
            { isStatusCode200, ...pageContentCheck('User information') }))
          }
        }, {})
      })
      break
    }
    case 'SMS': {
      res = group(groups[11], () => timeRequest(() =>
        res.submitForm({
          fields: { password: credentials.password }
        }), { isStatusCode200, ...pageContentCheck('Check your phone') }))

      sleep(1)

      group(groups[12], () => {
        timeRequest(() => {
          res = group(groups[13].split('::')[1], () => timeRequest(() =>
            res.submitForm({
              fields: { code: credentials.phoneOTP },
              params: { redirects: 1 }
            }),
          { isStatusCode302 }))
          res = group(groups[14].split('::')[1], () => timeRequest(() =>
            http.get(res.headers.Location, { redirects: 0 }),
          { isStatusCode302 }))

          acceptNewTerms = res.headers.Location.includes('updated-terms-and-conditions')

          if (acceptNewTerms) {
            res = group(groups[15].split('::')[1], () => timeRequest(() =>
              http.get(res.headers.Location),
            { isStatusCode200, ...pageContentCheck('terms of use update') }))
          } else {
            res = group(groups[16].split('::')[1], () => timeRequest(() =>
              http.get(res.headers.Location),
            { isStatusCode200, ...pageContentCheck('User information') }))
          }
        }, {})
      })
      break
    }
  }

  if (acceptNewTerms) {
    res = group(groups[17], () => timeRequest(() =>
      res.submitForm({
        fields: { termsAndConditionsResult: 'accept' }
      }), { isStatusCode200, ...pageContentCheck('User information') }))
  }

  // 25% of users logout
  if (Math.random() <= 0.25) {
    sleep(1)

    group(groups[18], () => {
      timeRequest(() => {
        res = group(groups[19].split('::')[1], () => timeRequest(() =>
          res.submitForm({ params: { redirects: 0 } }),
        { isStatusCode302 }))
        res = group(groups[20].split('::')[1], () => timeRequest(() =>
          http.get(res.headers.Location, { redirects: 0 }),
        { isStatusCode302 }))
        res = group(groups[21].split('::')[1], () => timeRequest(() =>
          http.get(res.headers.Location),
        { isStatusCode200, ...pageContentCheck('Successfully signed out') }))
      }, {})
    })
  }
  iterationsCompleted.add(1)
}
