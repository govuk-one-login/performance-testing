import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import TOTP from '../common/utils/authentication/totp'
import exec from 'k6/execution'
import { Trend } from 'k6/metrics'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { SharedArray } from 'k6/data'
import { timeRequest } from '../common/utils/request/timing'

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
    },
    validateUser: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '30s' } // Ramps up to target load
      ],
      exec: 'validateUser'
    }
  },
  load: {
    changeEmail: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 3000,
      stages: [
        { target: 100, duration: '15m' }, // Ramp up to 100 iterations per second in 15 minutes
        { target: 100, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 100 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'changeEmail'
    },

    changePassword: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 3000,
      stages: [
        { target: 100, duration: '15m' }, // Ramp up to 100 iterations per second in 15 minutes
        { target: 100, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 100 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'changePassword'
    },

    changePhone: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 3000,
      stages: [
        { target: 100, duration: '15m' }, // Ramp up to 100 iterations per second in 15 minutes
        { target: 100, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 100 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'changePhone'
    },

    deleteAccount: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 3000,
      stages: [
        { target: 100, duration: '15m' }, // Ramp up to 100 iterations per second in 15 minutes
        { target: 100, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 100 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'deleteAccount'
    },
    validateUser: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 3000,
      stages: [
        { target: 100, duration: '15m' }, // Ramp up to 100 iterations per second in 15 minutes
        { target: 100, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 100 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'validateUser'
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

type mfaType = 'SMS' | 'AUTH_APP'
interface validateUserData {
  email: string
  mfaOption: mfaType
}
const validateData: validateUserData[] = new SharedArray('data', () => Array.from({ length: 10000 },
  (_, i) => {
    const id: string = Math.floor((i / 2) + 1).toString().padStart(5, '0')
    if (i % 2 === 0) {
      return {
        email: `perftestam1_app_${id}@digital.cabinet-office.gov.uk`,
        mfaOption: 'AUTH_APP' as mfaType
      }
    } else {
      return {
        email: `perftestam1_sms_${id}@digital.cabinet-office.gov.uk`,
        mfaOption: 'SMS' as mfaType
      }
    }
  }
))

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

  group('B03_ChangePhone_01_LaunchAccountsHome GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL, {
      tags: { name: 'B03_ChangePhone_01_LaunchAccountsHome' }
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

  group('B03_ChangePhone_02_ClickSecurityTab GET', () => {
    const startTime = Date.now()
    res = http.get(env.envURL + '/security', {
      tags: { name: 'B03_ChangePhone_02_ClickSecurityTab' }
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

  group('B03_ChangePhone_03_ClickChangePhoneNumberLink GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL + '/enter-password?type=changePhoneNumber', {
      tags: { name: 'B03_ChangePhone_03_ClickChangePhoneNumberLink' }
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

  group('B03_ChangePhone_04_EnterCurrentPassword POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      fields: {
        requestType: 'changePhoneNumber',
        password: credentials.currPassword
      },
      params: {
        tags: { name: 'B03_ChangePhone_04_EnterCurrentPassword' }
      }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Enter your new mobile phone number')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B03_ChangePhone_05_EnterNewPhoneID POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      fields: {
        phoneNumber: phoneData.newPhone,
        internationalPhoneNumber: ''
      },
      params: {
        tags: { name: 'B03_ChangePhone_05_EnterNewPhoneID' }
      }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('Check your phone')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B03_ChangePhone_06_EnterSMSOTP POST', () => {
    const startTime = Date.now()
    res = res.submitForm({
      fields: {
        phoneNumber: phoneData.newPhone,
        resendCodeLink: '/resend-phone-code',
        changePhoneNumberLink: '/change-phone-number',
        code: credentials.fixedPhoneOTP
      },
      params: {
        tags: { name: 'B03_ChangePhone_06_EnterSMSOTP' }
      }
    })
    const endTime = Date.now()

    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) =>
        (r.body as string).includes('You’ve changed your phone number')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('B03_ChangePhone_07_ClickBackToSecurity GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL + '/manage-your-account', {
      tags: { name: 'B03_ChangePhone_07_ClickBackToSecurity' }
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

  group('B03_ChangePhone_08_SignOut GET', function () {
    const startTime = Date.now()
    res = http.get(env.envURL + '/sign-out', {
      tags: { name: 'B03_ChangePhone_08_SignOut' }
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

export function validateUser (): void {
  let res: Response
  const userData = validateData[exec.scenario.iterationInInstance % validateData.length]

  res = group('B05_ValidateUser_01_LaunchAccountsHome GET', () =>
    timeRequest(() => http.get(env.envURL, {
      tags: { name: 'B05_ValidateUser_01_LaunchAccountsHome' }
    }),
    {
      'is status 200': (r) => r.status === 200
    }))

  sleep(Math.random() * 3)

  res = group('B05_ValidateUser_02_ClickSignIn POST', () =>
    timeRequest(() => res.submitForm({
      params: { tags: { name: 'B05_ValidateUser_02_ClickSignIn' } }
    }), {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Enter your email address to sign in to your GOV.UK One Login')
    }))

  sleep(Math.random() * 3)

  res = group('B05_ValidateUser_03_EnterEmailAddress POST', () =>
    timeRequest(() =>
      res.submitForm({
        fields: { email: userData.email },
        params: { tags: { name: 'B05_ValidateUser_03_EnterEmailAddress' } }
      }), {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('Enter your password')
    }))

  sleep(Math.random() * 3)

  let acceptNewTerms = false
  switch (userData.mfaOption) {
    case 'AUTH_APP': {
      res = group('B05_ValidateUser_04_AuthMFA_EnterPassword POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { password: credentials.currPassword },
            params: { tags: { name: 'B05_ValidateUser_04_AuthMFA_EnterPassword' } }
          }), {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Enter the 6 digit security code shown in your authenticator app')
        }))

      sleep(Math.random() * 3)

      const totp = new TOTP(credentials.authAppKey)
      res = group('B05_ValidateUser_05_AuthMFA_EnterTOTP POST', () =>
        timeRequest(() => {
          const response = res.submitForm({
            fields: { code: totp.generateTOTP() },
            params: { tags: { name: 'B05_ValidateUser_05_AuthMFA_EnterTOTP' } }
          })
          acceptNewTerms = (response.body as string).includes('terms of use update')
          return response
        }, {
          'is status 200': r => r.status === 200,
          'verify page content': r => acceptNewTerms || (r.body as string).includes('Services you can use with GOV.UK One Login')
        }))
      break
    }
    case 'SMS': {
      res = group('B05_ValidateUser_06_SMSMFA_EnterPassword POST', () =>
        timeRequest(() =>
          res.submitForm({
            fields: { password: credentials.currPassword },
            params: { tags: { name: 'B05_ValidateUser_06_SMSMFA_EnterPassword' } }
          }), {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Check your phone')
        }))

      sleep(1)

      res = group('B05_ValidateUser_07_SMSMFA_EnterOTP POST', () =>
        timeRequest(() => res.submitForm({
          fields: { code: credentials.fixedPhoneOTP },
          params: { tags: { name: 'B05_ValidateUser_07_SMSMFA_EnterOTP' } }
        }),
        {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as string).includes('Services you can use with GOV.UK One Login')
        }))
      break
    }
  }

  if (acceptNewTerms) {
    res = group('B05_ValidateUser_08_AcceptTermsConditions POST', () =>
      timeRequest(() =>
        res.submitForm({
          fields: { termsAndConditionsResult: 'accept' },
          params: { tags: { name: 'B05_ValidateUser_08_AcceptTermsConditions' } }
        }), {
        'is status 200': r => r.status === 200,
        'verify page content': r => (r.body as string).includes('Services you can use with GOV.UK One Login')
      }))
  }

  // Wait for end of the next 5 second window to synchronise requests across VUs
  sleep((5000 - (Date.now() % 5000)) / 1000)

  for (let i = 0; i < 5; i++) {
    res = group('B05_ValidateUser_09_ClickSecurityTab GET', () =>
      timeRequest(() => http.get(env.envURL + '/security', {
        tags: { name: 'B05_ValidateUser_09_ClickSecurityTab' }
      }),
      {
        'is status 200': r => r.status === 200,
        'verify current email address': r => (r.body as string).includes(`${userData.email}`)
      }))
  }

  sleep(Math.random() * 3)

  res = group('B05_ValidateUser_10_Logout POST', () =>
    timeRequest(() => http.get(env.envURL + '/sign-out', {
      tags: { name: 'B05_ValidateUser_10_Logout' }
    }),
    {
      'is status 200': r => r.status === 200,
      'verify page content': r => (r.body as string).includes('You have signed out')
    }))
}
