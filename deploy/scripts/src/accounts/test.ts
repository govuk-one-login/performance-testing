import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { sleep, group } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import TOTP from '../common/utils/authentication/totp'
import exec from 'k6/execution'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
import { SharedArray } from 'k6/data'
import { timeRequest } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

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
    },
    contactsPage: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '30s' } // Ramps up to target load
      ],
      exec: 'contactsPage'
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
        { target: 30, duration: '15m' }, // Ramp up to 30 iterations per second in 15 minutes
        { target: 30, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 30 iterations/second
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
        { target: 30, duration: '15m' }, // Ramp up to 30 iterations per second in 15 minutes
        { target: 30, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 30 iterations/second
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
        { target: 30, duration: '15m' }, // Ramp up to 30 iterations per second in 15 minutes
        { target: 30, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 30 iterations/second
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
        { target: 30, duration: '15m' }, // Ramp up to 30 iterations per second in 15 minutes
        { target: 30, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 30 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'deleteAccount'
    },
    validateUser: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 300,
      stages: [
        { target: 10, duration: '3m' }, // Ramp up to 10 iterations per second in 3 minutes
        { target: 10, duration: '6m' }, // Steady State of 6 minutes at the ramp up load i.e. 10 iterations/second
        { target: 0, duration: '1m' } // Ramp down duration of 1 minute.
      ],
      exec: 'validateUser'
    },
    contactsPage: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 300,
      stages: [
        { target: 10, duration: '5m' }, // Ramp up to 10 iterations per second in 5 minutes
        { target: 10, duration: '30m' }, // Steady State of 30 minutes at the ramp up load i.e. 10 iterations/second
        { target: 0, duration: '1m' } // Ramp down duration of 1 minute.
      ],
      exec: 'contactsPage'
    }
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  changeEmail: [
    'B01_ChangeEmail_01_LaunchAccountsHome',
    'B01_ChangeEmail_02_ClickSecurityTab',
    'B01_ChangeEmail_03_ClickChangeEmailLink',
    'B01_ChangeEmail_04_EnterCurrentPassword',
    'B01_ChangeEmail_05_EnterNewEmailID',
    'B01_ChangeEmail_06_EnterEmailOTP',
    'B01_ChangeEmail_07_ClickBackToSecurity',
    'B01_ChangeEmail_08_SignOut'
  ],
  changePassword: [
    'B02_ChangePassword_01_LaunchAccountsHome',
    'B02_ChangePassword_02_ClickSecurityTab', // pragma: allowlist secret
    'B02_ChangePassword_03_ClickChangePasswordLink',
    'B02_ChangePassword_04_EnterCurrentPassword',
    'B02_ChangePassword_05_EnterNewPassword',
    'B02_ChangePassword_06_ClickBackToSecurity', // pragma: allowlist secret
    'B02_ChangePassword_07_SignOut'
  ],
  changePhone: [
    'B03_ChangePhone_01_LaunchAccountsHome',
    'B03_ChangePhone_02_ClickSecurityTab',
    'B03_ChangePhone_03_ClickChangePhoneNumberLink',
    'B03_ChangePhone_04_EnterCurrentPassword',
    'B03_ChangePhone_05_EnterNewPhoneID',
    'B03_ChangePhone_06_EnterSMSOTP',
    'B03_ChangePhone_07_ClickBackToSecurity',
    'B03_ChangePhone_08_SignOut'
  ],
  deleteAccount: [
    'B04_DeleteAccount_01_LaunchAccountsHome',
    'B04_DeleteAccount_02_ClickSecurityTab',
    'B04_DeleteAccount_03_ClickDeleteAccountLink',
    'B04_DeleteAccount_04_EnterCurrentPassword',
    'B04_DeleteAccount_05_DeleteAccountConfirm'
  ],
  validateUser: [
    'B05_ValidateUser_01_LaunchAccountsHome',
    'B05_ValidateUser_02_ClickSignIn',
    'B05_ValidateUser_03_EnterEmailAddress',
    'B05_ValidateUser_04_AuthMFA_EnterPassword',
    'B05_ValidateUser_05_AuthMFA_EnterTOTP',
    'B05_ValidateUser_06_SMSMFA_EnterPassword',
    'B05_ValidateUser_07_SMSMFA_EnterOTP',
    'B05_ValidateUser_08_AcceptTermsConditions',
    'B05_ValidateUser_09_ClickSecurityTab',
    'B05_ValidateUser_10_Logout'
  ],
  contactsPage: [
    'B06_01_ContactsPage'
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
  envURL: getEnv('ACCOUNT_HOME_URL'),
  signinURL: getEnv('ACCOUNT_SIGNIN_URL')
}

const credentials = {
  authAppKey: getEnv('ACCOUNT_APP_KEY'),
  currPassword: getEnv('ACCOUNT_APP_PASSWORD'),
  newPassword: getEnv('ACCOUNT_APP_PASSWORD_NEW'),
  fixedPhoneOTP: getEnv('ACCOUNT_PHONE_OTP'),
  fixedEmailOTP: getEnv('ACCOUNT_EMAIL_OTP')
}

const phoneData = {
  newPhone: getEnv('ACCOUNT_NEW_PHONE')
}

export function changeEmail (): void {
  const groups = groupMap.changeEmail
  let res: Response
  const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:]/g, '') // YYMMDDTHHmm
  const iteration = exec.scenario.iterationInInstance.toString().padStart(6, '0')
  const newEmail = `perftest${timestamp}${iteration}@digital.cabinet-office.gov.uk`
  iterationsStarted.add(1)

  res = group(groups[0], () => timeRequest(() => // B01_ChangeEmail_01_LaunchAccountsHome
    http.get(env.envURL),
  { isStatusCode200, ...pageContentCheck('Services you can use with GOV.UK One Login') }))

  sleepBetween(1, 3)

  res = group(groups[1], () => timeRequest(() => // B01_ChangeEmail_02_ClickSecurityTab
    http.get(env.envURL + '/security'),
  { isStatusCode200, 'verify page content': r => (r.body as string).includes('Delete your GOV.UK One Login') }))

  sleepBetween(1, 3)

  res = group(groups[2], () => timeRequest(() => // B01_ChangeEmail_03_ClickChangeEmailLink
    http.get(env.envURL + '/enter-password?type=changeEmail'),
  { isStatusCode200, ...pageContentCheck('Enter your password') }))

  sleepBetween(1, 3)

  res = group(groups[3], () => timeRequest(() => // B01_ChangeEmail_04_EnterCurrentPassword
    res.submitForm({
      formSelector: "form[action='/enter-password']",
      fields: {
        requestType: 'changeEmail',
        password: credentials.currPassword
      }
    }),
  { isStatusCode200, ...pageContentCheck('Enter your new email address') }))

  sleepBetween(1, 3)

  res = group(groups[4], () => timeRequest(() => // B01_ChangeEmail_05_EnterNewEmailID
    res.submitForm({
      formSelector: "form[action='/change-email']",
      fields: {
        email: newEmail
      }
    }),
  { isStatusCode200, ...pageContentCheck('Check your email') }))

  sleepBetween(1, 3)

  res = group(groups[5], () => timeRequest(() => // B01_ChangeEmail_06_EnterEmailOTP
    res.submitForm({
      formSelector: "form[action='/check-your-email']",
      fields: {
        email: newEmail,
        code: credentials.fixedEmailOTP
      }
    }),
  { isStatusCode200, ...pageContentCheck('You’ve changed your email address') }))

  sleepBetween(1, 3)

  res = group(groups[6], () => timeRequest(() => // B01_ChangeEmail_07_ClickBackToSecurity
    http.get(env.envURL + '/manage-your-account'),
  { isStatusCode200, ...pageContentCheck('Delete your GOV.UK One Login') }))

  sleepBetween(1, 3)

  res = group(groups[7], () => timeRequest(() => // B01_ChangeEmail_08_SignOut
    res.submitForm({
      formSelector: "form[action='/sign-out']"
    }),
  { isStatusCode200, ...pageContentCheck('You have signed out') }))

  iterationsCompleted.add(1)
}

export function changePassword (): void {
  let res: Response
  const groups = groupMap.changePassword
  iterationsStarted.add(1)

  res = group(groups[0], () => timeRequest(() => // B02_ChangePassword_01_LaunchAccountsHome
    http.get(env.envURL),
  { isStatusCode200, ...pageContentCheck('Services you can use with GOV.UK One Login') }))

  sleepBetween(1, 3)

  res = group(groups[1], () => timeRequest(() => // B02_ChangePassword_02_ClickSecurityTab
    http.get(env.envURL + '/security'),
  { isStatusCode200, 'verify page content': r => (r.body as string).includes('Delete your GOV.UK One Login') }))

  sleepBetween(1, 3)

  res = group(groups[2], () => timeRequest(() => // B02_ChangePassword_03_ClickChangePasswordLink
    http.get(env.envURL + '/enter-password?type=changePassword'),
  { isStatusCode200, ...pageContentCheck('Enter your current password') }))

  sleepBetween(1, 3)

  res = group(groups[3], () => timeRequest(() => // B02_ChangePassword_04_EnterCurrentPassword
    res.submitForm({
      formSelector: "form[action='/enter-password']",
      fields: {
        requestType: 'changePassword',
        password: credentials.currPassword
      }
    }),
  { isStatusCode200, ...pageContentCheck('Enter your new password') }))

  sleepBetween(1, 3)

  res = group(groups[4], () => timeRequest(() => // B02_ChangePassword_05_EnterNewPassword
    res.submitForm({
      formSelector: "form[action='/change-password']",
      fields: {
        password: credentials.newPassword,
        'confirm-password': credentials.newPassword
      }
    }),
  { isStatusCode200, ...pageContentCheck('You’ve changed your password') }))

  sleepBetween(1, 3)

  res = group(groups[5], () => timeRequest(() => // B02_ChangePassword_06_ClickBackToSecurity
    http.get(env.envURL + '/manage-your-account'),
  { isStatusCode200, ...pageContentCheck('Delete your GOV.UK One Login') }))

  sleepBetween(1, 3)

  res = group(groups[6], () => timeRequest(() => // B02_ChangePassword_07_SignOut
    res.submitForm({
      formSelector: "form[action='/sign-out']"
    }),
  { isStatusCode200, ...pageContentCheck('You have signed out') }))
  iterationsCompleted.add(1)
}

export function changePhone (): void {
  let res: Response
  const groups = groupMap.changePhone
  iterationsStarted.add(1)

  res = group(groups[0], () => timeRequest(() => // B03_ChangePhone_01_LaunchAccountsHome
    http.get(env.envURL),
  { isStatusCode200, ...pageContentCheck('Services you can use with GOV.UK One Login') }))

  sleepBetween(1, 3)

  res = group(groups[1], () => timeRequest(() => // B03_ChangePhone_02_ClickSecurityTab
    http.get(env.envURL + '/security'),
  { isStatusCode200, 'verify page content': r => (r.body as string).includes('Delete your GOV.UK One Login') }))

  sleepBetween(1, 3)

  res = group(groups[2], () => timeRequest(() => // B03_ChangePhone_03_ClickChangePhoneNumberLink
    http.get(env.envURL + '/enter-password?type=changePhoneNumber'),
  { isStatusCode200, ...pageContentCheck('Enter your password') }))

  sleepBetween(1, 3)

  res = group(groups[3], () => timeRequest(() => // B03_ChangePhone_04_EnterCurrentPassword
    res.submitForm({
      formSelector: "form[action='/enter-password']",
      fields: {
        requestType: 'changePhoneNumber',
        password: credentials.currPassword
      }
    }),
  { isStatusCode200, ...pageContentCheck('Enter your new mobile phone number') }))

  sleepBetween(1, 3)

  res = group(groups[4], () => timeRequest(() => // B03_ChangePhone_05_EnterNewPhoneID
    res.submitForm({
      formSelector: "form[action='/change-phone-number']",
      fields: {
        phoneNumber: phoneData.newPhone,
        internationalPhoneNumber: ''
      }
    }),
  { isStatusCode200, ...pageContentCheck('Check your phone') }))

  sleepBetween(1, 3)

  res = group(groups[5], () => timeRequest(() => // B03_ChangePhone_06_EnterSMSOTP
    res.submitForm({
      formSelector: "form[action='/check-your-phone']",
      fields: {
        phoneNumber: phoneData.newPhone,
        resendCodeLink: '/resend-phone-code',
        changePhoneNumberLink: '/change-phone-number',
        code: credentials.fixedPhoneOTP
      }
    }),
  { isStatusCode200, ...pageContentCheck('You’ve changed your phone number') }))

  sleepBetween(1, 3)

  res = group(groups[6], () => timeRequest(() => // B03_ChangePhone_07_ClickBackToSecurity
    http.get(env.envURL + '/manage-your-account'),
  { isStatusCode200, ...pageContentCheck('Delete your GOV.UK One Login') }))

  sleepBetween(1, 3)

  res = group(groups[7], () => timeRequest(() => // B03_ChangePhone_08_SignOut
    res.submitForm({
      formSelector: "form[action='/sign-out']"
    }),
  { isStatusCode200, ...pageContentCheck('You have signed out') }))
  iterationsCompleted.add(1)
}

export function deleteAccount (): void {
  const groups = groupMap.deleteAccount
  let res: Response
  iterationsStarted.add(1)

  res = group(groups[0], () => timeRequest(() => // B04_DeleteAccount_01_LaunchAccountsHome
    http.get(env.envURL),
  { isStatusCode200, ...pageContentCheck('Services you can use with GOV.UK One Login') }))

  sleepBetween(1, 3)

  res = group(groups[1], () => timeRequest(() => // B04_DeleteAccount_02_ClickSecurityTab
    http.get(env.envURL + '/security'),
  { isStatusCode200, 'verify page content': r => (r.body as string).includes('Delete your GOV.UK One Login') }))

  sleepBetween(1, 3)

  res = group(groups[2], () => timeRequest(() => // B04_DeleteAccount_03_ClickDeleteAccountLink
    http.get(env.envURL + '/enter-password?type=deleteAccount'),
  { isStatusCode200, ...pageContentCheck('Enter your password') }))

  sleepBetween(1, 3)

  res = group(groups[3], () => timeRequest(() => // B04_DeleteAccount_04_EnterCurrentPassword
    res.submitForm({
      formSelector: "form[action='/enter-password']",
      fields: {
        requestType: 'deleteAccount',
        password: credentials.currPassword
      }
    }),
  { isStatusCode200, ...pageContentCheck('Are you sure you want to delete your GOV.UK One Login') }))

  sleepBetween(1, 3)

  res = group(groups[4], () => timeRequest(() => // B04_DeleteAccount_05_DeleteAccountConfirm
    res.submitForm({
      formSelector: "form[action='/delete-account']"
    }),
  { isStatusCode200, ...pageContentCheck('You have signed out') }))
  iterationsCompleted.add(1)
}

export function validateUser (): void {
  const groups = groupMap.validateUser
  let res: Response
  const userData = validateData[exec.scenario.iterationInInstance % validateData.length]
  iterationsStarted.add(1)

  res = group(groups[0], () => timeRequest(() => // B05_ValidateUser_01_LaunchAccountsHome
    http.get(env.envURL),
  { isStatusCode200, ...pageContentCheck('Create a GOV.UK One Login or sign in') }))

  sleepBetween(1, 3)

  res = group(groups[1], () => timeRequest(() => // B05_ValidateUser_02_ClickSignIn
    res.submitForm({
      fields: {
        supportInternationalNumbers: 'true'
      }
    }),
  { isStatusCode200, 'verify page content': r => (r.body as string).includes('Enter your email address to sign in to your GOV.UK One Login') }))

  sleepBetween(1, 3)

  res = group(groups[2], () => timeRequest(() => // B05_ValidateUser_03_EnterEmailAddress
    res.submitForm({
      fields: { email: userData.email }
    }),
  { isStatusCode200, 'verify page content': r => (r.body as string).includes('Enter your password') }))

  sleepBetween(1, 3)

  let acceptNewTerms = false
  switch (userData.mfaOption) {
    case 'AUTH_APP': {
      res = group(groups[3], () => timeRequest(() => // B05_ValidateUser_04_AuthMFA_EnterPassword
        res.submitForm({
          fields: { password: credentials.currPassword }
        }),
      { isStatusCode200, 'verify page content': r => (r.body as string).includes('Enter the 6 digit security code shown in your authenticator app') }))

      sleepBetween(1, 3)

      const totp = new TOTP(credentials.authAppKey)
      res = group(groups[4], () => timeRequest(() => { // B05_ValidateUser_05_AuthMFA_EnterTOTP
        const response = res.submitForm({
          fields: { code: totp.generateTOTP() }
        })
        acceptNewTerms = (response.body as string).includes('terms of use update')
        return response
      },
      { isStatusCode200, 'verify page content': r => acceptNewTerms || (r.body as string).includes('Services you can use with GOV.UK One Login') }))
      break
    }
    case 'SMS': {
      res = group(groups[5], () => timeRequest(() => // B05_ValidateUser_06_SMSMFA_EnterPassword
        res.submitForm({
          fields: { password: credentials.currPassword }
        }),
      { isStatusCode200, 'verify page content': r => (r.body as string).includes('Check your phone') }))

      sleep(1)

      res = group(groups[6], () => timeRequest(() => { // B05_ValidateUser_07_SMSMFA_EnterOTP
        const response = res.submitForm({
          fields: { code: credentials.fixedPhoneOTP }
        })
        acceptNewTerms = (response.body as string).includes('terms of use update')
        return response
      },
      { isStatusCode200, 'verify page content': r => acceptNewTerms || (r.body as string).includes('Services you can use with GOV.UK One Login') }))
      break
    }
  }

  if (acceptNewTerms) {
    res = group(groups[7], () => timeRequest(() => // B05_ValidateUser_08_AcceptTermsConditions
      res.submitForm({
        fields: { termsAndConditionsResult: 'accept' }
      }),
    { isStatusCode200, 'verify page content': r => (r.body as string).includes('Services you can use with GOV.UK One Login') }))
  }

  // Wait for end of the next 5 second window to synchronise requests across VUs
  sleep((5000 - (Date.now() % 5000)) / 1000)

  for (let i = 0; i < 5; i++) {
    res = group(groups[8], () => timeRequest(() => // B05_ValidateUser_09_ClickSecurityTab
      http.get(env.envURL + '/security'),
    { isStatusCode200, 'verify current email address': r => (r.body as string).includes(`${userData.email}`) }))
  }

  sleepBetween(1, 3)

  res = group(groups[9], () => timeRequest(() => // B05_ValidateUser_10_Logout
    res.submitForm({
      formSelector: "form[action='/sign-out']"
    }),
  { isStatusCode200, 'verify page content': r => (r.body as string).includes('You have signed out') }))
  iterationsCompleted.add(1)
}

export function contactsPage (): void {
  const groups = groupMap.contactsPage
  iterationsStarted.add(1)

  group(groups[0], () => timeRequest(() => // B06_01_ContactsPage
    http.get(env.envURL + '/contact-gov-uk-one-login'),
  { isStatusCode200, ...pageContentCheck('Contact GOV.UK One Login') }))
  iterationsCompleted.add(1)
}
