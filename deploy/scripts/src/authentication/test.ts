import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { sleep, group } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import TOTP from '../common/utils/authentication/totp'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { SharedArray } from 'k6/data'
import execution from 'k6/execution'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { randomString } from '../common/utils/jslib'
import { URL } from '../common/utils/jslib/url'

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

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'], // 95th percentile response time <=1000ms, 99th percentile response time <=2500ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
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
  const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:]/g, '') // YYMMDDTHHmm
  const iteration = execution.scenario.iterationInInstance.toString().padStart(6, '0')
  const testEmail = `perftest${timestamp}${iteration}@digital.cabinet-office.gov.uk`
  const phoneNumber = '07700900000'
  let secretKey: string
  let totp: TOTP
  const mfaOption: mfaType = (Math.random() <= 0.5) ? 'SMS' : 'AUTH_APP'
  iterationsStarted.add(1)

  group('B01_SignUp_01_InitializeJourney GET', () => {
    res = timeRequest(() => http.get(startJourneyUrl(), {
      redirects: 0,
      tags: { name: 'B01_SignUp_01_InitializeJourney_01_OIDCCall' }
    }),
    { isStatusCode302 })

    res = timeRequest(() => http.get(res.headers.Location,
      {
        tags: { name: 'B01_SignUp_01_InitializeJourney_02_AuthCall' }
      }),
    { isStatusCode200, ...pageContentCheck('Create a GOV.UK One Login or sign in') })
  })
  sleep(1)

  res = group('B01_SignUp_02_CreateOneLogin POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: {
          supportInternationalNumbers: 'true',
          optionSelected: 'create'
        },
        params: { tags: { name: 'B01_SignUp_02_CreateOneLogin' } }
      }),
    { isStatusCode200, ...pageContentCheck('Enter your email address') }))

  sleep(1)

  res = group('B01_SignUp_03_EnterEmailAddress POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: { email: testEmail },
        params: { tags: { name: 'B01_SignUp_03_EnterEmailAddress' } }
      }),
    { isStatusCode200, ...pageContentCheck('Check your email') }))

  sleep(1)

  res = group('B01_SignUp_04_EnterOTP POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: {
          email: testEmail.toLowerCase(),
          code: credentials.emailOTP
        },
        params: { tags: { name: 'B01_SignUp_04_EnterOTP' } }
      }), { isStatusCode200, ...pageContentCheck('Create your password') }))

  sleep(1)

  res = group('B01_SignUp_05_CreatePassword POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: {
          password: credentials.password,
          'confirm-password': credentials.password
        },
        params: { tags: { name: 'B01_SignUp_05_CreatePassword' } }
      }), { isStatusCode200, ...pageContentCheck('Choose how to get security codes') }))

  sleep(1)

  switch (mfaOption) { // Switch statement for either Auth App or SMS paths
    case 'AUTH_APP': {
      res = group('B01_SignUp_06_MFA_AuthApp POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { mfaOptions: mfaOption },
            params: { tags: { name: 'B01_SignUp_06_MFA_AuthApp' } }
          }), { isStatusCode200, ...pageContentCheck('Set up an authenticator app') }))

      secretKey = res.html().find("span[class*='secret-key-fragment']").text() ?? ''
      totp = new TOTP(secretKey)
      sleep(1)

      res = group('B01_SignUp_07_MFA_EnterTOTP POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { code: totp.generateTOTP() },
            params: { tags: { name: 'B01_SignUp_07_MFA_EnterTOTP' } }
          }), { isStatusCode200, ...pageContentCheck('You’ve created your GOV.UK One Login') }))
      break
    }
    case 'SMS': {
      res = group('B01_SignUp_08_MFA_SMS POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { mfaOptions: mfaOption },
            params: { tags: { name: 'B01_SignUp_08_MFA_SMS' } }
          }), { isStatusCode200, ...pageContentCheck('Enter your mobile phone number') }))

      sleep(1)

      res = group('B01_SignUp_09_MFA_EnterPhoneNum POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { phoneNumber },
            params: { tags: { name: 'B01_SignUp_09_MFA_EnterPhoneNum' } }
          }), { isStatusCode200, ...pageContentCheck('Check your phone') }))

      sleep(1)

      res = group('B01_SignUp_10_MFA_EnterSMSOTP POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { code: credentials.phoneOTP },
            params: { tags: { name: 'B01_SignUp_10_MFA_EnterSMSOTP' } }
          }), { isStatusCode200, ...pageContentCheck('You’ve created your GOV.UK One Login') }))
      break
    }
  }

  sleep(1)

  group('B01_SignUp_11_ContinueAccountCreated POST', () => {
    res = timeRequest(() => res.submitForm({
      params: {
        redirects: 1,
        tags: { name: 'B01_SignUp_11_ContinueAccountCreated_01_AuthCall' }
      }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      redirects: 0,
      tags: { name: 'B01_SignUp_11_ContinueAccountCreated_02_OIDCCall' }
    }),
    { isStatusCode302 })
    res = timeRequest(() => http.get(res.headers.Location, {
      tags: { name: 'B01_SignUp_11_ContinueAccountCreated_03_RPStub' }
    }),
    { isStatusCode200, ...pageContentCheck('User information') })
  })

  iterationsCompleted.add(1)
}

export function signIn (): void {
  let res: Response
  const userData = dataSignIn[execution.scenario.iterationInInstance % dataSignIn.length]
  iterationsStarted.add(1)

  group('B02_SignIn_01_InitializeJourney GET', () => {
    res = timeRequest(() => http.get(startJourneyUrl(), {
      redirects: 0,
      tags: { name: 'B02_SignIn_01_InitializeJourney_01_OIDCCall' }
    }),
    { isStatusCode302 })

    res = timeRequest(() => http.get(res.headers.Location,
      {
        tags: { name: 'B02_SignIn_01_InitializeJourney_02_AuthCall' }
      }),
    { isStatusCode200, ...pageContentCheck('Create a GOV.UK One Login or sign in') })
  })
  sleep(1)

  res = group('B02_SignIn_02_ClickSignIn POST', () =>
    timeRequest(() => res.submitForm({
      params: { tags: { name: 'B02_SignIn_02_ClickSignIn' } }
    }), { isStatusCode200, ...pageContentCheck('Enter your email address to sign in to your GOV.UK One Login') }))

  sleep(1)

  res = group('B02_SignIn_03_EnterEmailAddress POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: { email: userData.email },
        params: { tags: { name: 'B02_SignIn_03_EnterEmailAddress' } }
      }), { isStatusCode200, ...pageContentCheck('Enter your password') }))

  sleep(1)

  let acceptNewTerms = false
  switch (userData.mfaOption) {
    case 'AUTH_APP': {
      res = group('B02_SignIn_04_AuthMFA_EnterPassword POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { password: credentials.password },
            params: { tags: { name: 'B02_SignIn_04_AuthMFA_EnterPassword' } }
          }), { isStatusCode200, ...pageContentCheck('Enter the 6 digit security code shown in your authenticator app') }))

      sleep(1)

      const totp = new TOTP(credentials.authAppKey)
      group('B02_SignIn_05_AuthMFA_EnterTOTP POST', () => {
        res = timeRequest(() => res.submitForm({
          fields: { code: totp.generateTOTP() },
          params: {
            redirects: 1,
            tags: { name: 'B02_SignIn_05_AuthMFA_EnterTOTP_01_AuthCall' }
          }
        }),
        { isStatusCode302 })
        res = timeRequest(() => http.get(res.headers.Location, {
          redirects: 0,
          tags: { name: 'B02_SignIn_05_AuthMFA_EnterTOTP_02_OIDCCall' }
        }),
        { isStatusCode302 })

        acceptNewTerms = res.headers.Location.includes('updated-terms-and-conditions')

        if (acceptNewTerms) {
          res = timeRequest(() => http.get(res.headers.Location, {
            tags: { name: 'B02_SignIn_07_SMSMFA_EnterOTP_03_AuthAcceptTerms' } // pragma: allowlist secret
          }),
          { isStatusCode200, ...pageContentCheck('terms of use update') })
        } else {
          res = timeRequest(() => http.get(res.headers.Location, {
            tags: { name: 'B02_SignIn_07_SMSMFA_EnterOTP_03_RPStub' }
          }),
          { isStatusCode200, ...pageContentCheck('User information') })
        }
      })
      break
    }
    case 'SMS': {
      res = group('B02_SignIn_06_SMSMFA_EnterPassword POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { password: credentials.password },
            params: { tags: { name: 'B02_SignIn_06_SMSMFA_EnterPassword' } }
          }), { isStatusCode200, ...pageContentCheck('Check your phone') }))

      sleep(1)

      group('B02_SignIn_07_SMSMFA_EnterOTP POST', () => {
        res = timeRequest(() => res.submitForm({
          fields: { code: credentials.phoneOTP },
          params: {
            redirects: 1,
            tags: { name: 'B02_SignIn_07_SMSMFA_EnterOTP_01_AuthCall' }
          }
        }),
        { isStatusCode302 })
        res = timeRequest(() => http.get(res.headers.Location, {
          redirects: 0,
          tags: { name: 'B02_SignIn_07_SMSMFA_EnterOTP_02_OIDCCall' }
        }),
        { isStatusCode302 })

        acceptNewTerms = res.headers.Location.includes('updated-terms-and-conditions')

        if (acceptNewTerms) {
          res = timeRequest(() => http.get(res.headers.Location, {
            tags: { name: 'B02_SignIn_07_SMSMFA_EnterOTP_03_AuthAcceptTerms' } // pragma: allowlist secret
          }),
          { isStatusCode200, ...pageContentCheck('terms of use update') })
        } else {
          res = timeRequest(() => http.get(res.headers.Location, {
            tags: { name: 'B02_SignIn_07_SMSMFA_EnterOTP_03_RPStub' }
          }),
          { isStatusCode200, ...pageContentCheck('User information') })
        }
      })
      break
    }
  }

  if (acceptNewTerms) {
    res = group('B02_SignIn_08_AcceptTermsConditions POST', () =>
      timeRequest(() =>
        res.submitForm({
          fields: { termsAndConditionsResult: 'accept' },
          params: { tags: { name: 'B02_SignIn_08_AcceptTermsConditions' } }
        }), { isStatusCode200, ...pageContentCheck('User information') }))
  }

  iterationsCompleted.add(1)
}
