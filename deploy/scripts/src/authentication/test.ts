import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import TOTP from '../common/utils/authentication/totp'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { SharedArray } from 'k6/data'
import execution from 'k6/execution'
import { Trend } from 'k6/metrics'

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

  group('GET - {RP Stub}', function () {
    const start = Date.now()
    res = http.get(env.rpStub)
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

  group('POST - {RP Stub} /oidc/auth', () => {
    const start = Date.now()
    res = res.submitForm({
      fields: {
        '2fa': 'Cl.Cm',
        lng: ''
      }
    })
    const end = Date.now()
    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Create a GOV.UK One Login or sign in')
    })
      ? durations.add(end - start)
      : fail('Checks failed')
  })

  sleep(1)

  group('POST - /sign-in-or-create', () => {
    const start = Date.now()
    res = res.submitForm({
      fields: {
        supportInternationalNumbers: 'true',
        optionSelected: 'create'
      }
    })
    const end = Date.now()
    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Enter your email address')
    })
      ? durations.add(end - start)
      : fail('Checks failed')
  })

  sleep(1)

  group('POST - /enter-email-create', () => {
    const start = Date.now()
    res = res.submitForm({
      fields: { email: testEmail }
    })
    const end = Date.now()
    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Check your email')
    })
      ? durations.add(end - start)
      : fail('Checks failed')
  })

  sleep(1)

  group('POST - /check-your-email', () => {
    const start = Date.now()
    res = res.submitForm({
      fields: {
        email: testEmail.toLowerCase(),
        code: credentials.emailOTP
      }
    })
    const end = Date.now()
    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Create your password')
    })
      ? durations.add(end - start)
      : fail('Checks failed')
  })

  sleep(1)

  group('POST - /create-password', () => {
    const start = Date.now()
    res = res.submitForm({
      fields: {
        password: credentials.password,
        'confirm-password': credentials.password
      }
    })
    const end = Date.now()
    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Choose how to get security codes')
    })
      ? durations.add(end - start)
      : fail('Checks failed')
  })

  sleep(1)

  switch (mfaOption) { // Switch statement for either Auth App or SMS paths
    case 'AUTH_APP': {
      group('POST - /get-security-codes', () => {
        const start = Date.now()
        res = res.submitForm({
          fields: { mfaOptions: mfaOption }
        })
        const end = Date.now()
        check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Set up an authenticator app')
        })
          ? durations.add(end - start)
          : fail('Checks failed')
        secretKey = res.html().find("span[class*='secret-key-fragment']").text() ?? ''
        totp = new TOTP(secretKey)
      })

      sleep(1)

      group('POST - /setup-authenticator-app', () => {
        const start = Date.now()
        res = res.submitForm({
          fields: { code: totp.generateTOTP() }
        })
        const end = Date.now()
        check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('You’ve created your GOV.UK One Login')
        })
          ? durations.add(end - start)
          : fail('Checks failed')
      })
      break
    }
    case 'SMS': {
      group('POST - /get-security-codes', () => {
        const start = Date.now()
        res = res.submitForm({
          fields: { mfaOptions: mfaOption }
        })
        const end = Date.now()
        check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Enter your mobile phone number')
        })
          ? durations.add(end - start)
          : fail('Checks failed')
      })

      sleep(1)

      group('POST - /enter-phone-number', () => {
        const start = Date.now()
        res = res.submitForm({
          fields: { phoneNumber }
        })
        const end = Date.now()
        check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Check your phone')
        })
          ? durations.add(end - start)
          : fail('Checks failed')
      })

      sleep(1)

      group('POST - /check-your-phone', () => {
        const start = Date.now()
        res = res.submitForm({
          fields: { code: credentials.phoneOTP }
        })
        const end = Date.now()
        check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('You’ve created your GOV.UK One Login')
        })
          ? durations.add(end - start)
          : fail('Checks failed')
      })
      break
    }
  }

  sleep(1)

  group('POST - /account-created', () => {
    const start = Date.now()
    res = res.submitForm()
    const end = Date.now()
    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('User information')
    })
      ? durations.add(end - start)
      : fail('Checks failed')
  })

  // 25% of users logout
  if (Math.random() <= 0.25) {
    sleep(1)

    group('POST - {RP Stub} /logout', () => {
      const start = Date.now()
      res = res.submitForm()
      const end = Date.now()
      check(res, {
        'is status 200': r => r.status === 200,
        'verify page content': r => (r.body as string).includes('Successfully signed out')
      })
        ? durations.add(end - start)
        : fail('Checks failed')
    })
  }
}

export function signIn (): void {
  let res: Response
  const userData = dataSignIn[execution.scenario.iterationInInstance % dataSignIn.length]

  group('GET - {RP Stub}', function () {
    const start = Date.now()
    res = http.get(env.rpStub)
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

  group('POST - {RP Stub} /oidc/auth', () => {
    const start = Date.now()
    res = res.submitForm({
      fields: {
        '2fa': 'Cl.Cm',
        lng: ''
      }
    })
    const end = Date.now()
    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Create a GOV.UK One Login or sign in')
    })
      ? durations.add(end - start)
      : fail('Checks failed')
  })

  sleep(1)

  group('GET - /sign-in-or-create', function () {
    const start = Date.now()
    res = res.submitForm()
    const end = Date.now()

    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Enter your email address to sign in to your GOV.UK One Login')
    })
      ? durations.add(end - start)
      : fail('Checks failed')
  })

  sleep(1)

  group('POST - /enter-email', () => {
    const start = Date.now()
    res = res.submitForm({
      fields: { email: userData.email }
    })
    const end = Date.now()
    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Enter your password')
    })
      ? durations.add(end - start)
      : fail('Checks failed')
  })

  sleep(1)

  let acceptNewTerms = false
  switch (userData.mfaOption) {
    case 'AUTH_APP': {
      group('POST - /enter-password', () => {
        const start = Date.now()
        res = res.submitForm({
          fields: { password: credentials.password }
        })
        const end = Date.now()
        check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Enter the 6 digit security code shown in your authenticator app')
        })
          ? durations.add(end - start)
          : fail('Checks failed')
      })

      sleep(1)

      group('POST - /enter-authenticator-app-code', () => {
        const totp = new TOTP(credentials.authAppKey)
        const start = Date.now()
        res = res.submitForm({
          fields: { code: totp.generateTOTP() }
        })
        const end = Date.now()

        acceptNewTerms = (res.body as string).includes('terms of use update')
        check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => acceptNewTerms || (r.body as string).includes('User information')
        })
          ? durations.add(end - start)
          : fail('Checks failed')
      })
      break
    }
    case 'SMS': {
      group('POST - /enter-password', () => {
        const start = Date.now()
        res = res.submitForm({
          fields: { password: credentials.password }
        })
        const end = Date.now()
        check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Check your phone')
        })
          ? durations.add(end - start)
          : fail('Checks failed')
      })

      sleep(1)

      group('POST - /enter-code', () => {
        const start = Date.now()
        res = res.submitForm({
          fields: { code: credentials.phoneOTP }
        })
        const end = Date.now()

        acceptNewTerms = (res.body as string).includes('terms of use update')
        check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => acceptNewTerms || (r.body as string).includes('User information')
        })
          ? durations.add(end - start)
          : fail('Checks failed')
      })
      break
    }
  }

  if (acceptNewTerms) {
    group('POST - /updated-terms-and-conditions', () => {
      const start = Date.now()
      res = res.submitForm({
        fields: { termsAndConditionsResult: 'accept' }
      })
      const end = Date.now()

      check(res, {
        'is status 200': r => r.status === 200,
        'verify page content': r => (r.body as string).includes('User information')
      })
        ? durations.add(end - start)
        : fail('Checks failed')
    })
  }

  // 25% of users logout
  if (Math.random() <= 0.25) {
    sleep(1)

    group('POST - {RP Stub} /logout', () => {
      const start = Date.now()
      res = res.submitForm()
      const end = Date.now()
      check(res, {
        'is status 200': r => r.status === 200,
        'verify page content': r => (r.body as string).includes('Successfully signed out')
      })
        ? durations.add(end - start)
        : fail('Checks failed')
    })
  }
}
