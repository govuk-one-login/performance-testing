import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { SharedArray } from 'k6/data'
import exec from 'k6/execution'
import { Trend } from 'k6/metrics'
import TOTP from './utils/authentication/totp'
import { selectProfile, type ProfileList, describeProfile } from './utils/config/load-profiles'

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
      maxVUs: 50,
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
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'deleteAccount'
    }
  },
  load: {
    changeEmail: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1m',
      preAllocatedVUs: 1,
      maxVUs: 50,
      stages: [
        { target: 60, duration: '120s' }, // Ramps up to target load
        { target: 60, duration: '120s' } // Holds at target load
      ],
      exec: 'changeEmail'
    },

    changePassword: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 250,
      stages: [
        { target: 30, duration: '15m' } // Ramp up to 30 iterations per second in 15 minutes
      ],
      exec: 'changePassword'
    },

    changePhone: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1m',
      preAllocatedVUs: 1,
      maxVUs: 50,
      stages: [
        { target: 60, duration: '120s' }, // Ramps up to target load
        { target: 60, duration: '120s' } // Holds at target load
      ],
      exec: 'changePhone'
    },

    deleteAccount: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1500,
      stages: [
        { target: 30, duration: '10m' } // Ramp up to 30 iterations per second in 10 minutes
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

type mfaType = 'SMS' | 'AUTH_APP'

interface changeEmailData {
  email: string
  mfaOption: mfaType
}

const dataChangeEmail: changeEmailData[] = new SharedArray('data', () => {
  const data: changeEmailData[] = []

  for (let i = 1; i <= 10000; i++) {
    const id = i.toString().padStart(5, '0')
    const emailAPP = `perftestAM2_APP_${id}@digital.cabinet-office.gov.uk`
    const emailSMS = `perftestAM2_SMS_${id}@digital.cabinet-office.gov.uk`
    const mfaOptionAPP = 'AUTH_APP' as mfaType
    const mfaOptionSMS = 'SMS' as mfaType

    data.push({ email: emailAPP, mfaOption: mfaOptionAPP })
    data.push({ email: emailSMS, mfaOption: mfaOptionSMS })
  }

  return data
})

interface UserPasswordChange {
  currEmail: string
}

const csvData2: UserPasswordChange[] = new SharedArray('csvPasswordChange', function () {
  return open('./data/changePassword_TestData.csv').split('\n').slice(1).map((s) => {
    return {
      currEmail: s
    }
  })
}
)

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

interface UserDeleteAccount { currEmail: string }

const csvData4: UserDeleteAccount[] = new SharedArray('csvDelAccount', function () {
  return open('./data/deleteAccount_TestData.csv').split('\n').slice(1).map((s) => {
    return {
      currEmail: s
    }
  })
}
)

export function setup (): void {
  describeProfile(loadProfile)
}

const env = {
  envURL: `${__ENV.HOME_URL}`,
  signinURL: `${__ENV.SIGNIN_URL}`
}

const credentials = {
  authAppKey: __ENV.AUTH_APP_KEY,
  currPassword: __ENV.APP_PASSWORD,
  newPassword: __ENV.APP_PASSWORD_NEW,
  fixedSMSOTP: __ENV.SMS_OTP,
  fixedEmailOTP: __ENV.EMAIL_OTP
}

const phoneData = {
  currentPhone: __ENV.CURR_PHONE,
  newPhone: __ENV.NEW_PHONE
}

const transactionDuration = new Trend('duration')

export function changeEmail (): void {
  let res: Response
  let csrfToken: string
  let phoneNumber: string
  let currentEmail: string
  const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:]/g, '') // YYMMDDTHHmm
  const iteration = exec.scenario.iterationInInstance.toString().padStart(6, '0')
  let newEmail = `perftest${timestamp}${iteration}@digital.cabinet-office.gov.uk`

  const emailChangeData = dataChangeEmail[exec.scenario.iterationInInstance % dataChangeEmail.length]

  currentEmail = emailChangeData.email
  const totp = new TOTP(credentials.authAppKey)

  group('B01_ChangeEmail_01_LaunchAccountsHome GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL, {
      tags: { name: 'B01_ChangeEmail_01_LaunchAccountsHome' }
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

  group('B01_ChangeEmail_02_ClickSignIn POST', function () {
    const startTime = Date.now()
    res = http.post(env.signinURL + '/sign-in-or-create', {

      _csrf: csrfToken,
      supportInternationalNumbers: 'true'
    },
    {
      tags: { name: 'B01_ChangeEmail_02_ClickSignIn' }
    })
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

  group('B01_ChangeEmail_03_EnterEmailID POST', () => {
    const startTime = Date.now()
    res = http.post(
      env.signinURL + '/enter-email',
      {
        _csrf: csrfToken,
        email: currentEmail
      },
      {
        tags: { name: 'B01_ChangeEmail_03_EnterEmailID' }
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

  switch (emailChangeData.mfaOption) {
    case 'SMS': {
      group('B01_ChangeEmail_04_SMS_EnterLoginPassword POST', () => {
        const startTime = Date.now()
        res = http.post(
          env.signinURL + '/enter-password',
          {
            _csrf: csrfToken,
            password: credentials.currPassword
          },
          {
            tags: { name: 'B01_ChangeEmail_04_SMS_EnterLoginPassword' }
          }
        )
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes(
              'Check your phone'
            )
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')

        csrfToken = getCSRF(res)
        phoneNumber = getPhone(res)
      })

      group('B01_ChangeEmail_05_SMS_EnterOTP POST', () => {
        const startTime = Date.now()
        res = http.post(env.signinURL + '/enter-code',
          {
            phoneNumber,
            _csrf: csrfToken,
            code: credentials.fixedSMSOTP
          },
          {
            tags: { name: 'B01_ChangeEmail_05_SMS_EnterOTP' }
          }
        )
        const endTime = Date.now()

        check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Your services')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Respone Validation Failed')
      })
      break
    }
    case 'AUTH_APP':{
      group('B01_ChangeEmail_06_APP_EnterLoginPassword POST', () => {
        const startTime = Date.now()
        res = http.post(
          env.signinURL + '/enter-password',
          {
            _csrf: csrfToken,
            password: credentials.currPassword
          },
          {
            tags: { name: 'B01_ChangeEmail_06_APP_EnterLoginPassword' }
          }
        )
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes(
              'Enter the 6 digit security code shown in your authenticator app'
            )
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')

        csrfToken = getCSRF(res)
      })

      sleep(2)

      group('B01_ChangeEmail_07_APP_EnterAuthAppOTP POST', () => {
        const startTime = Date.now()
        res = http.post(env.signinURL + '/enter-authenticator-app-code',
          {
            _csrf: csrfToken,
            code: totp.generateTOTP()
          },
          {
            tags: { name: 'B01_ChangeEmail_07_APP_EnterAuthAppOTP' }
          }
        )
        const endTime = Date.now()

        check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Your services')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Respone Validation Failed')
      })

      break
    }
  }

  sleep(Math.random() * 3)

  group('B01_ChangeEmail_08_ClickSettingsTab GET', () => {
    const startTime = Date.now()
    res = http.get(env.envURL + '/settings', {
      tags: { name: 'B01_ChangeEmail_08_ClickSettingsTab' }
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

  function changeEmailSteps (loopCount: number): void {
    for (let i = 1; i <= loopCount; i++) {
      group('B01_ChangeEmail_09_ClickChangeEmailLink GET', function () {
        const startTime = Date.now()
        res = http.get(env.envURL + '/enter-password?type=changeEmail', {
          tags: { name: 'B01_ChangeEmail_09_ClickChangeEmailLink' }
        })
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

      group('B01_ChangeEmail_10_EnterCurrentPassword POST', () => {
        const startTime = Date.now()
        res = http.post(
          env.envURL + '/enter-password',
          {
            _csrf: csrfToken,
            requestType: 'changeEmail',
            password: credentials.currPassword
          },
          {
            tags: { name: 'B01_ChangeEmail_11_EnterCurrentPassword' }
          }
        )
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Enter your new email address')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')

        csrfToken = getCSRF(res)
      })

      sleep(Math.random() * 3)

      group('B01_ChangeEmail_12_EnterNewEmailID POST', () => {
        const startTime = Date.now()
        res = http.post(
          env.envURL + '/change-email',
          {
            _csrf: csrfToken,
            email: newEmail
          },
          {
            tags: { name: 'B01_ChangeEmail_12_EnterNewEmailID' }
          }
        )
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Check your email')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')

        csrfToken = getCSRF(res)
      })

      sleep(Math.random() * 3)

      group('B01_ChangeEmail_13_EnterEmailOTP POST', () => {
        const startTime = Date.now()
        res = http.post(
          env.envURL + '/check-your-email',
          {
            _csrf: csrfToken,
            email: newEmail,
            code: credentials.fixedEmailOTP
          },
          {
            tags: { name: 'B01_ChangeEmail_13_EnterEmailOTP' }
          }
        )
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('You’ve changed your email address')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')

        csrfToken = getCSRF(res)
      })

      sleep(Math.random() * 3)

      group('B01_ChangeEmail_14_ClickBackToMyAccount GET', function () {
        const startTime = Date.now()
        res = http.get(env.envURL + '/manage-your-account', {
          tags: { name: 'B01_ChangeEmail_14_ClickBackToMyAccount' }
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

      sleep(Math.random() * 3);

      // Swap the value of passwords by destructuring assignment
      [currentEmail, newEmail] = [newEmail, currentEmail]
    }
  }

  changeEmailSteps(2) // Calling the email change function

  group('B01_ChangeEmail_15_SignOut GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL + '/sign-out', {
      tags: { name: 'B01_ChangeEmail_15_SignOut' }
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
  let csrfToken: string

  const user2 = csvData2[exec.scenario.iterationInTest % csvData2.length]

  const totp = new TOTP(credentials.authAppKey)

  group('B02_ChangePassword_01_LaunchAccountsHome GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL, {
      tags: { name: 'B02_ChangePassword_01_LaunchAccountsHome' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Create a GOV.UK account or sign in')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B02_ChangePassword_02_ClickSignIn GET', function () {
    const startTime = Date.now()
    res = http.get(env.signinURL + '/sign-in-or-create?redirectPost=true', {
      tags: { name: 'B02_ChangePassword_02_ClickSignIn' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes(
          'Enter your email address to sign in to your GOV.UK account'
        )
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B02_ChangePassword_03_EnterEmailID POST', () => {
    const startTime = Date.now()
    res = http.post(
      env.signinURL + '/enter-email',
      {
        _csrf: csrfToken,
        email: user2.currEmail
      },
      {
        tags: { name: 'B02_ChangePassword_03_EnterEmailID' }
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

  group('B02_ChangePassword_04_EnterLoginPassword POST', () => {
    const startTime = Date.now()
    res = http.post(
      env.signinURL + '/enter-password',
      {
        _csrf: csrfToken,
        password: credentials.currPassword
      },
      {
        tags: { name: 'B02_ChangePassword_04_EnterLoginPassword' }
      }
    )
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes(
          'Enter the 6 digit security code shown in your authenticator app'
        )
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B02_ChangePassword_05_EnterAuthAppOTP POST', () => {
    const startTime = Date.now()
    res = http.post(env.signinURL + '/enter-authenticator-app-code',
      {
        _csrf: csrfToken,
        code: totp.generateTOTP()
      },
      {
        tags: { name: 'B02_ChangePassword_05_EnterAuthAppOTP' }
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

  sleep(Math.random() * 3)

  group('B02_ChangePassword_06_ClickSettingsTab GET', () => {
    const startTime = Date.now()
    res = http.get(env.envURL + '/settings', {
      tags: { name: 'B02_ChangePassword_06_ClickSettingsTab' } // pragma: allowlist secret
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Delete your GOV.UK account')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  function changePassSteps (loopCount: number): void {
    for (let i = 1; i <= loopCount; i++) {
      group('B02_ChangePassword_07_ClickChangePasswordLink GET', function () {
        const startTime = Date.now()
        res = http.get(env.envURL + '/enter-password?type=changePassword', {
          tags: { name: 'B02_ChangePassword_07_ClickChangePasswordLink' }
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Enter your current password')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')

        csrfToken = getCSRF(res)
      })

      sleep(Math.random() * 3)

      group('B02_ChangePassword_08_EnterCurrentPassword POST', () => {
        const startTime = Date.now()
        res = http.post(
          env.envURL + '/enter-password',
          {
            _csrf: csrfToken,
            requestType: 'changePassword',
            password: credentials.currPassword
          },
          {
            tags: { name: 'B02_ChangePassword_08_EnterCurrentPassword' }
          }
        )
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Enter your new password')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')

        csrfToken = getCSRF(res)
      })

      sleep(Math.random() * 3)

      group('B02_ChangePassword_09_EnterNewPassword POST', () => {
        const startTime = Date.now()
        res = http.post(
          env.envURL + '/change-password',
          {
            _csrf: csrfToken,
            password: credentials.newPassword,
            'confirm-password': credentials.newPassword
          },
          {
            tags: { name: 'B02_ChangePassword_09_EnterNewPassword' }
          }
        )
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('You have changed your password')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')

        csrfToken = getCSRF(res)
      })

      sleep(Math.random() * 3)

      group('B02_ChangePassword_10_ClickBackToMyAccounts GET', function () {
        const startTime = Date.now()
        res = http.get(env.envURL + '/manage-your-account', {
          tags: { name: 'B02_ChangePassword_10_ClickBackToMyAccounts' } // pragma: allowlist secret
        })
        const endTime = Date.now()

        check(res, {
          'is status 200': (r) => r.status === 200,
          'verify page content': (r) =>
            (r.body as string).includes('Delete your GOV.UK account')
        })
          ? transactionDuration.add(endTime - startTime)
          : fail('Response Validation Failed')
      });

      [credentials.currPassword, credentials.newPassword] = [credentials.newPassword, credentials.currPassword]

      sleep(Math.random() * 3)
    }
  }

  changePassSteps(2) // Calling the password change function twice to change the password back to the original one

  group('B02_ChangePassword_11_SignOut GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL + '/sign-out', {
      tags: { name: 'B02_ChangePassword_11_SignOut' }
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
          'We sent a code to the phone number linked to your GOV.UK One Login'
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
        code: credentials.fixedSMSOTP
      },
      {
        tags: { name: 'B03_ChangePhone_05_EnterSMSOTP' }
      }
    )
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Your services')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B03_ChangePhone_06_ClickSettingsTab GET', () => {
    const startTime = Date.now()
    res = http.get(env.envURL + '/settings', {
      tags: { name: 'B03_ChangePhone_06_ClickSettingsTab' }
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
            code: credentials.fixedSMSOTP
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

      group('B03_ChangePhone_11_ClickBackToSettings GET', function () {
        const startTime = Date.now()
        res = http.get(env.envURL + '/manage-your-account', {
          tags: { name: 'B03_ChangePhone_11_ClickBackToSettings' }
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
  let csrfToken: string

  const user4 = csvData4[exec.scenario.iterationInTest % csvData4.length]

  const totp = new TOTP(credentials.authAppKey)

  group('B04_DeleteAccount_01_LaunchAccountsHome GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL, {
      tags: { name: 'B04_DeleteAccount_01_LaunchAccountsHome' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Create a GOV.UK account or sign in')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B04_DeleteAccount_02_ClickSignIn GET', function () {
    const startTime = Date.now()
    res = http.get(env.signinURL + '/sign-in-or-create?redirectPost=true', {
      tags: { name: 'B04_DeleteAccount_02_ClickSignIn' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes(
          'Enter your email address to sign in to your GOV.UK account'
        )
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B04_DeleteAccount_03_EnterEmailID POST', () => {
    const startTime = Date.now()
    res = http.post(
      env.signinURL + '/enter-email',
      {
        _csrf: csrfToken,
        email: user4.currEmail
      },
      {
        tags: { name: 'B04_DeleteAccount_03_EnterEmailID' }
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

  group('B04_DeleteAccount_04_EnterSignInPassword POST', () => {
    const startTime = Date.now()
    res = http.post(
      env.signinURL + '/enter-password',
      {
        _csrf: csrfToken,
        password: credentials.currPassword
      },
      {
        tags: { name: 'B04_DeleteAccount_04_EnterSignInPassword' }
      }
    )
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes(
          'Enter the 6 digit security code shown in your authenticator app'
        )
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B04_DeleteAccount_05_EnterAuthAppOTP POST', () => {
    const startTime = Date.now()
    res = http.post(env.signinURL + '/enter-authenticator-app-code',
      {
        _csrf: csrfToken,
        code: totp.generateTOTP()
      },
      {
        tags: { name: 'B04_DeleteAccount_05_EnterAuthAppOTP' }
      }
    )
    const endTime = Date.now()

    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Your services')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Respone Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B04_DeleteAccount_06_ClickSettingsTab GET', () => {
    const startTime = Date.now()
    res = http.get(env.envURL + '/settings', {
      tags: { name: 'B04_DeleteAccount_06_ClickSettingsTab' }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Delete your GOV.UK account')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B04_DeleteAccount_07_ClickDeleteAccountLink GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL + '/enter-password?type=deleteAccount', {
      tags: { name: 'B04_DeleteAccount_07_ClickDeleteAccountLink' }
    })
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

  group('B04_DeleteAccount_08_EnterCurrentPassword POST', () => {
    const startTime = Date.now()
    res = http.post(
      env.envURL + '/enter-password',
      {
        _csrf: csrfToken,
        requestType: 'deleteAccount',
        password: credentials.currPassword
      },
      {
        tags: { name: 'B04_DeleteAccount_08_EnterCurrentPassword' }
      }
    )
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes(
          'Are you sure you want to delete your GOV.UK account'
        )
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')

    csrfToken = getCSRF(res)
  })

  sleep(Math.random() * 3)

  group('B04_DeleteAccount_09_DeleteAccountConfirm POST', () => {
    const startTime = Date.now()
    res = http.post(
      env.envURL + '/delete-account',
      {
        _csrf: csrfToken
      },
      {
        tags: { name: 'B04_DeleteAccount_09_DeleteAccountConfirm' }
      }
    )
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('You have deleted your GOV.UK account')
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
