import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import { Trend } from 'k6/metrics'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'

const profiles: ProfileList = {
  smoke: {
    changeEmail: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'changeEmail'
    },

    changePassword: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'changePassword'
    },

    changePhone: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'changePhone'
    },

    deleteAccount: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '30s' } // Ramps up to target load
      ],
      exec: 'deleteAccount'
    }
  },
  load: {
    changeEmail: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 300,
      stages: [
        { target: 10, duration: '15m' }, // Ramp up to 10 iterations per second in 15 minutes
        { target: 10, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 10 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'changeEmail'
    },

    changePassword: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 300,
      stages: [
        { target: 10, duration: '15m' }, // Ramp up to 10 iterations per second in 15 minutes
        { target: 10, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 10 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'changePassword'
    },

    changePhone: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 300,
      stages: [
        { target: 10, duration: '15m' }, // Ramp up to 10 iterations per second in 15 minutes
        { target: 10, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 10 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'changePhone'
    },

    deleteAccount: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 300,
      stages: [
        { target: 10, duration: '15m' }, // Ramp up to 10 iterations per second in 15 minutes
        { target: 10, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 10 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'deleteAccount'
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

interface UserPhoneNumberChange {
  currEmail: string
}

const csvData3: UserPhoneNumberChange[] = new SharedArray('csvPhoneNumChange', function () {
  return open('./data/changePhoneNumber_TestData.csv').split('\n').slice(1).map((email) => {
    return {
      currEmail: email
    }
  })
}
)

export function setup (): void {
  describeProfile(loadProfile)
}

const env = {
  envURL: __ENV.ACCOUNT_HOME_URL,
  signinURL: __ENV.ACCOUNT_SIGNIN_URL
}

const credentials = {
  authAppKey: __ENV.ACCOUNT_APP_KEY,
  currPassword: __ENV.ACCOUNT_APP_PASSWORD,
  newPassword: __ENV.ACCOUNT_APP_PASSWORD_NEW,
  fixedPhoneOTP: __ENV.ACCOUNT_PHONE_OTP,
  fixedEmailOTP: __ENV.ACCOUNT_EMAIL_OTP
}

const phoneData = {
  currentPhone: __ENV.ACCOUNT_CURR_PHONE,
  newPhone: __ENV.ACCOUNT_NEW_PHONE
}

const transactionDuration = new Trend('duration', true)

export function changeEmail (): void {
  let res: Response
  const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:]/g, '') // YYMMDDTHHmm
  const iteration = exec.scenario.iterationInInstance.toString().padStart(6, '0')
  const newEmail = `perftest${timestamp}${iteration}@digital.cabinet-office.gov.uk`

  group('B01_ChangeEmail_01_LaunchAccountsHome GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL, {
      tags: { name: 'B01_ChangeEmail_01_LaunchAccountsHome' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Services you can use with GOV.UK One Login')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_ChangeEmail_02_ClickSecurityTab GET', () => {
    const startTime = Date.now()
    res = http.get(env.envURL + '/security', {
      tags: { name: 'B01_ChangeEmail_02_ClickSecurityTab' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Delete your GOV.UK One Login')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_ChangeEmail_03_ClickChangeEmailLink GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL + '/enter-password?type=changeEmail', {
      tags: { name: 'B01_ChangeEmail_03_ClickChangeEmailLink' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Enter your password')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_ChangeEmail_04_EnterCurrentPassword POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      fields: {
        requestType: 'changeEmail',
        password: credentials.currPassword
      },
      params: {
        tags: { name: 'B01_ChangeEmail_04_EnterCurrentPassword' }
      }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Enter your new email address')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_ChangeEmail_05_EnterNewEmailID POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      fields: {
        email: newEmail
      },
      params: {
        tags: { name: 'B01_ChangeEmail_05_EnterNewEmailID' }
      }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Check your email')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_ChangeEmail_06_EnterEmailOTP POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      fields: {
        email: newEmail,
        code: credentials.fixedEmailOTP
      },
      params: {
        tags: { name: 'B01_ChangeEmail_06_EnterEmailOTP' }
      }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('You’ve changed your email address')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_ChangeEmail_07_ClickBackToSecurity GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL + '/manage-your-account', {
      tags: { name: 'B01_ChangeEmail_07_ClickBackToSecurity' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Delete your GOV.UK One Login')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B01_ChangeEmail_08_SignOut GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL + '/sign-out', {
      tags: { name: 'B01_ChangeEmail_08_SignOut' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('You have signed out')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

export function changePassword (): void {
  let res: Response

  group('B02_ChangePassword_01_LaunchAccountsHome GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL, {
      tags: { name: 'B02_ChangePassword_01_LaunchAccountsHome' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Services you can use with GOV.UK One Login')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_ChangePassword_02_ClickSecurityTab GET', () => {
    const startTime = Date.now()
    res = http.get(env.envURL + '/security', {
      tags: { name: 'B02_ChangePassword_02_ClickSecurityTab' } // pragma: allowlist secret
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Delete your GOV.UK One Login')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_ChangePassword_03_ClickChangePasswordLink GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL + '/enter-password?type=changePassword', {
      tags: { name: 'B02_ChangePassword_03_ClickChangePasswordLink' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Enter your current password')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_ChangePassword_04_EnterCurrentPassword POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      fields: {
        requestType: 'changePassword',
        password: credentials.currPassword
      },
      params: {
        tags: { name: 'B02_ChangePassword_04_EnterCurrentPassword' }
      }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Enter your new password')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_ChangePassword_05_EnterNewPassword POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      fields: {
        password: credentials.newPassword,
        'confirm-password': credentials.newPassword
      },
      params: {
        tags: { name: 'B02_ChangePassword_05_EnterNewPassword' }
      }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('You’ve changed your password')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_ChangePassword_06_ClickBackToSecurity GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL + '/manage-your-account', {
      tags: { name: 'B02_ChangePassword_06_ClickBackToSecurity' } // pragma: allowlist secret
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Delete your GOV.UK One Login')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_ChangePassword_07_SignOut GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL + '/sign-out', {
      tags: { name: 'B02_ChangePassword_07_SignOut' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('You have signed out')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

export function changePhone (): void {
  let res: Response
  let csrfToken: string
  let phoneNumHidden: string

  const user3 = csvData3[exec.scenario.iterationInTest % csvData3.length]

  group('B03_ChangePhone_01_LaunchAccountsHome GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL, {
      tags: { name: 'B03_ChangePhone_01_LaunchAccountsHome' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Create a GOV.UK One Login or sign in')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B03_ChangePhone_02_ClickSignIn GET', function () {
    const startTime = Date.now()
    res = http.post(env.signinURL + '/sign-in-or-create?redirectPost=true',
      {
        _csrf: csrfToken,
        supportInternationalNumbers: 'true'
      },
      {
        tags: { name: 'B03_ChangePhone_02_ClickSignIn' }
      }
    )
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes(
          'Enter your email address to sign in to your GOV.UK One Login'
        )
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B03_ChangePhone_03_EnterEmailID POST', () => {
    const startTime = Date.now()
    res = http.post(
      env.signinURL + '/enter-email',
      {
        _csrf: csrfToken,
        email: user3.currEmail
      },
      {
        tags: { name: 'B03_ChangePhone_03_EnterEmailID' }
      }
    )
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Enter your password')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B03_ChangePhone_04_EnterSignInPassword POST', () => {
    const startTime = Date.now()
    res = http.post(
      env.signinURL + '/enter-password',
      {
        _csrf: csrfToken,
        password: credentials.currPassword
      },
      {
        tags: { name: 'B03_ChangePhone_04_EnterSignInPassword' }
      }
    )
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes(
          'We have sent a code to your phone number'
        )
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    csrfToken = getCSRF(res)
    phoneNumHidden = getPhone(res)
  })

  sleep(Math.random() * 3)

  group('B03_ChangePhone_05_EnterSMSOTP POST', () => {
    const startTime = Date.now()
    res = http.post(
      env.signinURL + '/enter-code',
      {
        phoneNumber: phoneNumHidden,
        _csrf: csrfToken,
        supportAccountRecovery: 'true',
        checkEmailLink: '/check-email-change-security-codes?type=SMS',
        code: credentials.fixedPhoneOTP
      },
      {
        tags: { name: 'B03_ChangePhone_05_01_EnterSMSOTP' }
      }
    )
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('Your services') || (r.body as string).includes('terms of use update')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    if ((res.body as string).includes('terms of use update')) {
      group('B03_ChangePhone_05_02_SMS_AcceptTerms', () => {
        const startTime = Date.now()
        res = http.post(
          env.signinURL + '/updated-terms-and-conditions',
          {
            _csrf: csrfToken,
            termsAndConditionsResult: 'accept'
          },
          {
            tags: { name: 'B03_ChangePhone_05_02_SMS_AcceptTerms' }
          }
        )

        const endTime = Date.now()
        check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Your services')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      })
    }
  })

  sleep(Math.random() * 3)

  group('B03_ChangePhone_06_ClickSecurityTab GET', () => {
    const startTime = Date.now()
    res = http.get(env.envURL + '/security', {
      tags: { name: 'B03_ChangePhone_06_ClickSecurityTab' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Delete your GOV.UK One Login')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  function changePhoneSteps (loopCount: number): void {
    for (let i = 1; i <= loopCount; i++) {
      group('B03_ChangePhone_07_ClickChangePhoneNumber GET', function () {
        const startTime = Date.now()
        res = http.get(
          env.envURL + '/enter-password?type=changePhoneNumber',
          {
            tags: { name: 'B03_ChangePhone_07_ClickChangePhoneNumber' }
          }
        )
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('We need to make sure it’s you before you can change your phone number.')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')

        csrfToken = getCSRF(res)
      })

      sleep(Math.random() * 3)

      group('B03_ChangePhone_08_EnterCurrentPassword POST', () => {
        const startTime = Date.now()
        res = http.post(
          env.envURL + '/enter-password',
          {
            _csrf: csrfToken,
            requestType: 'changePhoneNumber',
            password: credentials.currPassword
          },
          {
            tags: { name: 'B03_ChangePhone_08_EnterCurrentPassword' }
          }
        )
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Enter your new mobile phone number')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')

        csrfToken = getCSRF(res)
      })

      sleep(Math.random() * 3)

      group('B03_ChangePhone_09_EnterNewPhoneNumber POST', () => {
        const startTime = Date.now()
        res = http.post(
          env.envURL + '/change-phone-number',
          {
            _csrf: csrfToken,
            phoneNumber: phoneData.newPhone,
            internationalPhoneNumber: ''
          },
          {
            tags: { name: 'B03_ChangePhone_09_EnterNewPhoneNumber' }
          }
        )
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Check your phone')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')

        csrfToken = getCSRF(res)
        phoneNumHidden = getPhone(res)
      })

      sleep(Math.random() * 3)

      group('B03_ChangePhone_10_EnteNewPhoneOTP POST', () => {
        const startTime = Date.now()
        res = http.post(
          env.envURL + '/check-your-phone',
          {
            _csrf: csrfToken,
            phoneNumber: phoneNumHidden,
            code: credentials.fixedPhoneOTP
          },
          {
            tags: { name: 'B03_ChangePhone_10_EnteNewPhoneOTP' }
          }
        )
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('You’ve changed your phone number')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')

        csrfToken = getCSRF(res)
      })

      sleep(Math.random() * 3)

      group('B03_ChangePhone_11_ClickBackToSecurity GET', function () {
        const startTime = Date.now()
        res = http.get(env.envURL + '/manage-your-account', {
          tags: { name: 'B03_ChangePhone_11_ClickBackToSecurity' }
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Delete your GOV.UK One Login')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      });

      // Swap the value of the variables by destructuring assignment
      [phoneData.currentPhone, phoneData.newPhone] = [phoneData.newPhone, phoneData.currentPhone]

      sleep(Math.random() * 3)
    }
  }

  changePhoneSteps(2) // Calling the password change function

  group('B03_ChangePhone_12_SignOut GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL + '/sign-out', {
      tags: { name: 'B03_ChangePhone_12_SignOut' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('You have signed out')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

export function deleteAccount (): void {
  let res: Response

  group('B04_DeleteAccount_01_LaunchAccountsHome GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL, {
      tags: { name: 'B04_DeleteAccount_01_LaunchAccountsHome' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Services you can use with GOV.UK One Login')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B04_DeleteAccount_02_ClickSecurityTab GET', () => {
    const startTime = Date.now()
    res = http.get(env.envURL + '/security', {
      tags: { name: 'B04_DeleteAccount_02_ClickSecurityTab' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Delete your GOV.UK One Login')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B04_DeleteAccount_03_ClickDeleteAccountLink GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL + '/enter-password?type=deleteAccount', {
      tags: { name: 'B04_DeleteAccount_03_ClickDeleteAccountLink' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Enter your password')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B04_DeleteAccount_04_EnterCurrentPassword POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      fields: {
        requestType: 'deleteAccount',
        password: credentials.currPassword
      },
      params: {
        tags: { name: 'B04_DeleteAccount_04_EnterCurrentPassword' }
      }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes(
          'Are you sure you want to delete your GOV.UK One Login'
        )
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B04_DeleteAccount_05_DeleteAccountConfirm POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      params: {
        tags: { name: 'B04_DeleteAccount_05_DeleteAccountConfirm' }
      }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('You have signed out')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

function getCSRF (r: Response): string {
  return r.html().find("input[name='_csrf']").val() ?? ''
}

function getPhone (r: Response): string {
  return r.html().find("input[name='phoneNumber']").val() ?? ''
}
