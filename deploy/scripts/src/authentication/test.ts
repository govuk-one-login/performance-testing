import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import TOTP from '../common/utils/authentication/totp'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { SharedArray } from 'k6/data'
import execution from 'k6/execution'
import { Trend } from 'k6/metrics'
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
        { target: 30, duration: '5m' }, // Ramps up to 30 iterations per second in 5 minutes
        { target: 30, duration: '15m' }, // Maintain steady state at 30 iterations per second for 15 minutes
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
        { target: 30, duration: '5m' }, // Ramps up to 30 iterations per second in 5 minutes
        { target: 30, duration: '15m' }, // Maintain steady state at 30 iterations per second for 15 minutes
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
const env = {
  rpStub: __ENV.ACCOUNT_RP_STUB
}
const credentials = {
  authAppKey: __ENV.ACCOUNT_APP_KEY,
  password: __ENV.ACCOUNT_APP_PASSWORD,
  emailOTP: __ENV.ACCOUNT_EMAIL_OTP,
  phoneOTP: __ENV.ACCOUNT_PHONE_OTP
}
const durations = new Trend('duration', true)

export function signUp (): void {
  let res: Response
  const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:]/g, '') // YYMMDDTHHmm
  const iteration = execution.scenario.iterationInInstance.toString().padStart(6, '0')
  const testEmail = `perftest${timestamp}${iteration}@digital.cabinet-office.gov.uk`
  const phoneNumber = '07700900000'
  let secretKey: string
  let totp: TOTP
  const mfaOption: mfaType = (Math.random() <= 0.5) ? 'SMS' : 'AUTH_APP'

  group('B01_SignUp_01_LaunchRPStub GET', function () {
    const start = Date.now()
    res = http.get(env.rpStub, {
      tags: { name: 'B01_SignUp_01_LaunchRPStub' }
    })
    const end = Date.now()
    const jar = http.cookieJar()
    const cookies = jar.cookiesForURL(env.rpStub)
    check(res, {
      'is status 200': r => r.status === 200,
      "has cookie 'JSESSIONID'": () => cookies.JSESSIONID.length > 0,
      "has cookie '__VCAP_ID__'": () => cookies.__VCAP_ID__.length > 0 && cookies.__VCAP_ID__[0].length === 28
    })
      ? durations.add(end - start)
      : fail('Checks failed')
  })

  sleep(1)

  res = group('B01_SignUp_02_OIDCAuthRequest POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: {
          '2fa': 'Cl.Cm',
          lng: ''
        },
        params: { tags: { name: 'B01_SignUp_02_OIDCAuthRequest' } }
      }),
    {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Create a GOV.UK One Login or sign in')
    }))

  sleep(1)

  res = group('B01_SignUp_03_CreateOneLogin POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: {
          supportInternationalNumbers: 'true',
          optionSelected: 'create'
        },
        params: { tags: { name: 'B01_SignUp_03_CreateOneLogin' } }
      }),
    {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Enter your email address')
    }))

  sleep(1)

  res = group('B01_SignUp_04_EnterEmailAddress POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: { email: testEmail },
        params: { tags: { name: 'B01_SignUp_04_EnterEmailAddress' } }
      }),
    {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Check your email')
    }))

  sleep(1)

  res = group('B01_SignUp_05_EnterOTP POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: {
          email: testEmail.toLowerCase(),
          code: credentials.emailOTP
        },
        params: { tags: { name: 'B01_SignUp_05_EnterOTP' } }
      }), {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Create your password')
    }))

  sleep(1)

  res = group('B01_SignUp_06_CreatePassword POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: {
          password: credentials.password,
          'confirm-password': credentials.password
        },
        params: { tags: { name: 'B01_SignUp_06_CreatePassword' } }
      }), {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Choose how to get security codes')
    }))

  sleep(1)

  switch (mfaOption) { // Switch statement for either Auth App or SMS paths
    case 'AUTH_APP': {
      res = group('B01_SignUp_07_MFA_AuthApp POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { mfaOptions: mfaOption },
            params: { tags: { name: 'B01_SignUp_07_MFA_AuthApp' } }
          }), {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Set up an authenticator app')
        }))

      secretKey = res.html().find("span[class*='secret-key-fragment']").text() ?? ''
      totp = new TOTP(secretKey)
      sleep(1)

      res = group('B01_SignUp_08_MFA_EnterTOTP POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { code: totp.generateTOTP() },
            params: { tags: { name: 'B01_SignUp_08_MFA_EnterTOTP' } }
          }), {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('You’ve created your GOV.UK One Login')
        }))
      break
    }
    case 'SMS': {
      res = group('B01_SignUp_08_MFA_SMS POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { mfaOptions: mfaOption },
            params: { tags: { name: 'B01_SignUp_08_MFA_SMS' } }
          }), {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Enter your mobile phone number')
        }))

      sleep(1)

      res = group('B01_SignUp_09_MFA_EnterPhoneNum POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { phoneNumber },
            params: { tags: { name: 'B01_SignUp_09_MFA_EnterPhoneNum' } }
          }), {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Check your phone')
        }))

      sleep(1)

      res = group('B01_SignUp_10_MFA_EnterSMSOTP POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { code: credentials.phoneOTP },
            params: { tags: { name: 'B01_SignUp_10_MFA_EnterSMSOTP' } }
          }), {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('You’ve created your GOV.UK One Login')
        }))
      break
    }
  }

  sleep(1)

  res = group('B01_SignUp_11_ContinueAccountCreated POST', () =>
    timeRequest(() => res.submitForm({
      params: { tags: { name: 'B01_SignUp_11_ContinueAccountCreated' } }
    }), {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('User information')
    }))

  // 25% of users logout
  if (Math.random() <= 0.25) {
    sleep(1)

    res = group('B01_SignUp_12_Logout', () =>
      timeRequest(() => res.submitForm({
        params: { tags: { name: 'B01_SignUp_12_Logout' } }
      }), {
        'is status 200': r => r.status === 200,
        'verify page content': r => (r.body as string).includes('Successfully signed out')
      }))
  }
}

export function signIn (): void {
  let res: Response
  const userData = dataSignIn[execution.scenario.iterationInInstance % dataSignIn.length]

  res = group('B01_SignIn_01_LaunchRPStub GET', () =>
    timeRequest(() => http.get(env.rpStub, {
      tags: { name: 'B01_SignIn_01_LaunchRPStub' }
    }), {
      'is status 200': r => r.status === 200,
      'check cookies exist': () => {
        const jar = http.cookieJar()
        const cookies = jar.cookiesForURL(env.rpStub)
        return cookies.JSESSIONID.length > 0 && cookies.__VCAP_ID__.length > 0 && cookies.__VCAP_ID__[0].length === 28
      }
    }))

  sleep(1)

  res = group('B01_SignIn_02_OIDCAuthRequest POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: {
          '2fa': 'Cl.Cm',
          lng: ''
        },
        params: { tags: { name: 'B01_SignIn_02_OIDCAuthRequest' } }
      }), {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Create a GOV.UK One Login or sign in')
    }))

  sleep(1)

  res = group('B01_SignIn_03_ClickSignIn POST', () =>
    timeRequest(() => res.submitForm({
      params: { tags: { name: 'B01_SignIn_03_ClickSignIn' } }
    }), {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Enter your email address to sign in to your GOV.UK One Login')
    }))

  sleep(1)

  res = group('B01_SignIn_04_EnterEmailAddress POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: { email: userData.email },
        params: { tags: { name: 'B01_SignIn_04_EnterEmailAddress' } }
      }), {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Enter your password')
    }))

  sleep(1)

  let acceptNewTerms = false
  switch (userData.mfaOption) {
    case 'AUTH_APP': {
      res = group('B01_SignIn_05_AuthMFA_EnterPassword POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { password: credentials.password },
            params: { tags: { name: 'B01_SignIn_05_AuthMFA_EnterPassword' } }
          }), {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Enter the 6 digit security code shown in your authenticator app')
        }))

      sleep(1)

      const totp = new TOTP(credentials.authAppKey)
      res = group('B01_SignIn_06_AuthMFA_EnterTOTP POST', () =>
        timeRequest(() => {
          const response = res.submitForm({
            fields: { code: totp.generateTOTP() },
            params: { tags: { name: 'B01_SignIn_06_AuthMFA_EnterTOTP' } }
          })
          acceptNewTerms = (response.body as string).includes('terms of use update')
          return response
        }, {
          'is status 200': r => r.status === 200,
          'verify page content': r => acceptNewTerms || (r.body as string).includes('User information')
        }))
      break
    }
    case 'SMS': {
      res = group('B01_SignIn_07_SMSMFA_EnterPassword POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { password: credentials.password },
            params: { tags: { name: 'B01_SignIn_07_SMSMFA_EnterPassword' } }
          }), {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Check your phone')
        }))

      sleep(1)

      res = group('B01_SignIn_08_SMSMFA_EnterOTP POST', () =>
        timeRequest(() => {
          const response = res.submitForm({
            fields: { code: credentials.phoneOTP },
            params: { tags: { name: 'B01_SignIn_08_SMSMFA_EnterOTP' } }
          })
          acceptNewTerms = (response.body as string).includes('terms of use update')
          return response
        }, {
          'is status 200': r => r.status === 200,
          'verify page content': r => acceptNewTerms || (r.body as string).includes('User information')
        }))
      break
    }
  }

  if (acceptNewTerms) {
    res = group('B01_SignIn_09_AcceptTermsConditions POST', () =>
      timeRequest(() =>
        res.submitForm({
          fields: { termsAndConditionsResult: 'accept' },
          params: { tags: { name: 'B01_SignIn_09_AcceptTermsConditions' } }
        }), {
        'is status 200': r => r.status === 200,
        'verify page content': r => (r.body as string).includes('User information')
      }))
  }

  // 25% of users logout
  if (Math.random() <= 0.25) {
    sleep(1)

    res = group('B01_SignIn_10_Logout POST', () =>
      timeRequest(() => res.submitForm({
        params: { tags: { name: 'B01_SignIn_10_Logout' } }
      }), {
        'is status 200': r => r.status === 200,
        'verify page content': r => (r.body as string).includes('Successfully signed out')
      }))
  }
}
