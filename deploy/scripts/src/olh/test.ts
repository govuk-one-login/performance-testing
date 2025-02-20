import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { sleep } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import TOTP from '../common/utils/authentication/totp'
import exec from 'k6/execution'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { SharedArray } from 'k6/data'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions'
import { sleepBetween } from '../common/utils/sleep/sleepBetween'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'

const dprofile = {
  startRate: parseInt(getEnv('K6_START_RATE') || '1', 10),
  timeUnit: getEnv('K6_TIME_UNIT'),
  maxVUs: parseInt(getEnv('K6_MAXVUS') || '400', 10),
  target: parseInt(getEnv('K6_TARGET') || '20', 10),
  ruduration: getEnv('K6_RU_DURATION'),
  ssduration: getEnv('K6_SS_DURATION')
}

const profiles: ProfileList = {
  smoke: {
    ...createScenario('changeEmail', LoadProfile.smoke),
    ...createScenario('changePassword', LoadProfile.smoke),
    ...createScenario('changePhone', LoadProfile.smoke),
    ...createScenario('deleteAccount', LoadProfile.smoke),
    ...createScenario('validateUser', LoadProfile.smoke),
    ...createScenario('contactsPage', LoadProfile.smoke)
  },
  load: {
    ...createScenario('changeEmail', LoadProfile.full, 30, 32),
    ...createScenario('changePassword', LoadProfile.full, 30, 28),
    ...createScenario('changePhone', LoadProfile.full, 30, 32),
    ...createScenario('deleteAccount', LoadProfile.full, 30, 24),
    ...createScenario('validateUser', LoadProfile.full, 10, 40),
    ...createScenario('contactsPage', LoadProfile.full, 10, 4)
  },
  lowVolumePERF007Test: {
    changeEmail: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 10, duration: '200s' }, // Target to be updated based on the percentage split confirmed by the app team
        { target: 10, duration: '180s' } // Target to be updated based on the percentage split confirmed by the app team
      ],
      exec: 'changeEmail'
    },
    changePassword: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 10, duration: '200s' }, // Target to be updated based on the percentage split confirmed by the app team
        { target: 10, duration: '180s' } // Target to be updated based on the percentage split confirmed by the app team
      ],
      exec: 'changePassword'
    },
    changePhone: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 10, duration: '200s' }, // Target to be updated based on the percentage split confirmed by the app team
        { target: 10, duration: '180s' } // Target to be updated based on the percentage split confirmed by the app team
      ],
      exec: 'changePhone'
    },
    deleteAccount: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 10, duration: '200s' }, // Target to be updated based on the percentage split confirmed by the app team
        { target: 10, duration: '180s' } // Target to be updated based on the percentage split confirmed by the app team
      ],
      exec: 'deleteAccount'
    }
  },
  dynamicProfile: {
    changeEmail: {
      executor: 'ramping-arrival-rate',
      startRate: dprofile.startRate,
      timeUnit: dprofile.timeUnit,
      preAllocatedVUs: 100,
      maxVUs: dprofile.maxVUs,
      stages: [
        { target: dprofile.target, duration: dprofile.ruduration },
        { target: dprofile.target, duration: dprofile.ssduration }
      ],
      exec: 'changeEmail'
    }
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  changeEmail: [
    'B01_ChangeEmail_01_LaunchAccountsHome',
    'B01_ChangeEmail_01_LaunchAccountsHome::01_OLHCall',
    'B01_ChangeEmail_01_LaunchAccountsHome::02_OIDCStubCall',
    'B01_ChangeEmail_02_SelectStubScenario',
    'B01_ChangeEmail_02_SelectStubScenario::01_OIDCStubCall',
    'B01_ChangeEmail_02_SelectStubScenario::02_OLHCall',
    'B01_ChangeEmail_03_ClickSecurityTab',
    'B01_ChangeEmail_04_ClickChangeEmailLink',
    'B01_ChangeEmail_05_EnterCurrentPassword',
    'B01_ChangeEmail_06_EnterNewEmailID',
    'B01_ChangeEmail_07_EnterEmailOTP',
    'B01_ChangeEmail_08_Logout'
  ],
  changePassword: [
    'B02_ChangePassword_01_LaunchAccountsHome',
    'B02_ChangePassword_01_LaunchAccountsHome::01_OLHCall',
    'B02_ChangePassword_01_LaunchAccountsHome::02_OIDCStubCall',
    'B02_ChangePassword_02_SelectStubScenario',
    'B02_ChangePassword_02_SelectStubScenario::01_OIDCStubCall',
    'B02_ChangePassword_02_SelectStubScenario::02_OLHCall',
    'B02_ChangePassword_03_ClickSecurityTab', //pragma: allowlist secret
    'B02_ChangePassword_04_ClickChangePasswordLink',
    'B02_ChangePassword_05_EnterCurrentPassword',
    'B02_ChangePassword_06_EnterNewPassword',
    'B02_ChangePassword_07_SignOut',
    'B02_ChangePassword_07_SignOut::01_OLHCall',
    'B02_ChangePassword_07_SignOut::01_OIDCStubCall'
  ],
  changePhone: [
    'B03_ChangePhone_01_LaunchAccountsHome',
    'B03_ChangePhone_01_LaunchAccountsHome::01_OLHCall',
    'B03_ChangePhone_01_LaunchAccountsHome::01_OIDCStubCall',
    'B03_ChangePhone_02_SelectStubScenario',
    'B03_ChangePhone_02_SelectStubScenario::01_OIDCStubCall',
    'B03_ChangePhone_02_SelectStubScenario::02_OLHCall',
    'B03_ChangePhone_03_ClickSecurityTab',
    'B03_ChangePhone_04_ClickChangePhoneNumberLink',
    'B03_ChangePhone_05_EnterCurrentPassword',
    'B03_ChangePhone_06_EnterNewPhoneID',
    'B03_ChangePhone_07_EnterSMSOTP',
    'B03_ChangePhone_08_SignOut'
  ],
  deleteAccount: [
    'B04_DeleteAccount_01_LaunchAccountsHome',
    'B04_DeleteAccount_01_LaunchAccountsHome::01_OLHCall',
    'B04_DeleteAccount_01_LaunchAccountsHome::02_OIDCStubCall',
    'B04_DeleteAccount_02_SelectStubScenario',
    'B04_DeleteAccount_02_SelectStubScenario::01_OIDCStubCall',
    'B04_DeleteAccount_02_SelectStubScenario::02_OLHCall',
    'B04_DeleteAccount_03_ClickSecurityTab',
    'B04_DeleteAccount_04_ClickDeleteAccountLink',
    'B04_DeleteAccount_05_EnterCurrentPassword',
    'B04_DeleteAccount_06_DeleteAccountConfirm'
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
  contactsPage: ['B06_01_ContactsPage']
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
interface ValidateUserData {
  email: string
  mfaOption: mfaType
}
const validateData: ValidateUserData[] = new SharedArray('data', () =>
  Array.from({ length: 10000 }, (_, i) => {
    const id: string = Math.floor(i / 2 + 1)
      .toString()
      .padStart(5, '0')
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
  })
)

const env = {
  envURL: getEnv('ACCOUNT_HOME_URL')
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

export function changeEmail(): void {
  const groups = groupMap.changeEmail
  let res: Response
  const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:]/g, '') // YYMMDDTHHmm
  const iteration = exec.scenario.iterationInInstance.toString().padStart(6, '0')
  const newEmail = `perftest${timestamp}${iteration}@digital.cabinet-office.gov.uk`
  iterationsStarted.add(1)

  // B01_ChangeEmail_01_LaunchAccountsHome

  timeGroup(groups[0], () => {
    //01_OLHCall
    res = timeGroup(groups[1].split('::')[1], () => http.get(env.envURL, { redirects: 0 }), { isStatusCode302 })

    //02_OIDCStubCall
    res = timeGroup(
      groups[2].split('::')[1],
      () => {
        const r = http.get(res.headers.Location)
        if (!pageContentCheck('API Simulation Tool').validatePageContent(r)) {
          console.log('Expected "API Simulation Tool", got: ', r.html('h1').first().text())
        }
        return r
      },
      {
        isStatusCode200,
        ...pageContentCheck('API Simulation Tool')
      }
    )
  })

  sleepBetween(1, 3)

  //B01_ChangeEmail_02_SelectStubScenario

  timeGroup(groups[3], () => {
    //01_OIDCStubCall
    res = timeGroup(
      groups[4].split('::')[1],
      () => res.submitForm({ fields: { scenario: 'userPerformanceTest' }, params: { redirects: 0 } }),
      { isStatusCode302 }
    )

    //02_OLHCall
    res = timeGroup(
      groups[5].split('::')[1],
      () => {
        const r = http.get(res.headers.Location)
        if (!pageContentCheck('Services you can use with GOV.UK One Login').validatePageContent(r)) {
          console.log(' Expected "Services you can use with GOV.UK One Login", got: ', r.html('h2').eq(1).text())
        }
        return r
      },
      {
        isStatusCode200,
        ...pageContentCheck('Services you can use with GOV.UK One Login')
      }
    )
  })

  sleepBetween(1, 3)

  // B01_ChangeEmail_03_ClickSecurityTab
  res = timeGroup(
    groups[6],
    () => {
      const r = http.get(env.envURL + '/security')
      if (!pageContentCheck('Delete your GOV.UK One Login').validatePageContent(r)) {
        console.log(' Expected "Delete your GOV.UK One Login", got: ', r.html('h2').eq(3).text())
      }
      return r
    },
    {
      isStatusCode200,
      ...pageContentCheck('Delete your GOV.UK One Login')
    }
  )

  sleepBetween(1, 3)

  // B01_ChangeEmail_04_ClickChangeEmailLink
  res = timeGroup(
    groups[7],
    () => {
      const r = http.get(env.envURL + '/enter-password?type=changeEmail')
      if (!pageContentCheck('Enter your password').validatePageContent(r)) {
        console.log(' Expected "Enter your password", got: ', r.html('h1').text())
      }
      return r
    },
    {
      isStatusCode200,
      ...pageContentCheck('Enter your password')
    }
  )

  sleepBetween(1, 3)

  // B01_ChangeEmail_05_EnterCurrentPassword
  res = timeGroup(
    groups[8],
    () => {
      const r = res.submitForm({
        formSelector: "form[action='/enter-password']",
        fields: {
          requestType: 'changeEmail',
          password: credentials.currPassword
        }
      })
      if (!pageContentCheck('Enter your new email address').validatePageContent(r)) {
        console.log(' Expected "Enter your new email address", got: ', r.html('h1').text())
      }
      return r
    },
    {
      isStatusCode200,
      ...pageContentCheck('Enter your new email address')
    }
  )

  sleepBetween(1, 3)

  // B01_ChangeEmail_06_EnterNewEmailID
  res = timeGroup(
    groups[9],
    () => {
      const r = res.submitForm({
        formSelector: "form[action='/change-email']",
        fields: {
          email: newEmail
        }
      })
      if (!pageContentCheck('Check your email').validatePageContent(r)) {
        console.log(' Expected "Check your email", got: ', r.html('h1').text())
      }
      return r
    },
    {
      isStatusCode200,
      ...pageContentCheck('Check your email')
    }
  )

  sleepBetween(1, 3)

  // B01_ChangeEmail_07_EnterEmailOTP
  res = timeGroup(
    groups[10],
    () => {
      const r = res.submitForm({
        formSelector: "form[action='/check-your-email']",
        fields: {
          email: newEmail,
          code: credentials.fixedEmailOTP
        }
      })
      if (!pageContentCheck('You’ve changed your email address').validatePageContent(r)) {
        console.log('Expected "You’ve changed your email address", got: ', r.html('h1').text())
      }
      return r
    },
    {
      isStatusCode200,
      ...pageContentCheck('You’ve changed your email address')
    }
  )

  sleepBetween(1, 3)

  // B01_ChangeEmail_08_SignOut
  res = timeGroup(
    groups[11],
    () => {
      const r = res.submitForm({
        formSelector: "form[action='/sign-out']"
      })
      if (!pageContentCheck('You have signed out').validatePageContent(r)) {
        console.log('Expected "You have signed out", got: ', r.html('h1').text())
      }
      return r
    },
    { isStatusCode200, ...pageContentCheck('You have signed out') }
  )

  iterationsCompleted.add(1)
}

export function changePassword(): void {
  let res: Response
  const groups = groupMap.changePassword
  iterationsStarted.add(1)

  // B02_ChangePassword_01_LaunchAccountsHome
  timeGroup(groups[0], () => {
    //01_OLHCall
    res = timeGroup(groups[1].split('::')[1], () => http.get(env.envURL, { redirects: 0 }), { isStatusCode302 })

    //02_OIDCStubCall
    res = timeGroup(groups[2].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('API Simulation Tool')
    })
  })

  sleepBetween(1, 3)

  timeGroup(groups[3], () => {
    //01_OIDCStubCall
    res = timeGroup(
      groups[4].split('::')[1],
      () => res.submitForm({ fields: { scenario: 'userPerformanceTest' }, params: { redirects: 0 } }),
      { isStatusCode302 }
    )

    //02_OLHCall
    res = timeGroup(groups[5].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Services you can use with GOV.UK One Login')
    })
  })

  sleepBetween(1, 3)

  // B02_ChangePassword_03_ClickSecurityTab
  res = timeGroup(groups[6], () => http.get(env.envURL + '/security'), {
    isStatusCode200,
    ...pageContentCheck('Delete your GOV.UK One Login')
  })

  sleepBetween(1, 3)

  // B02_ChangePassword_04_ClickChangePasswordLink
  res = timeGroup(groups[7], () => http.get(env.envURL + '/enter-password?type=changePassword'), {
    isStatusCode200,
    ...pageContentCheck('Enter your current password')
  })

  sleepBetween(1, 3)

  // B02_ChangePassword_05_EnterCurrentPassword
  res = timeGroup(
    groups[8],
    () =>
      res.submitForm({
        formSelector: "form[action='/enter-password']",
        fields: {
          requestType: 'changePassword',
          password: credentials.currPassword
        }
      }),
    { isStatusCode200, ...pageContentCheck('Enter your new password') }
  )

  sleepBetween(1, 3)

  // B02_ChangePassword_06_EnterNewPassword
  res = timeGroup(
    groups[9],
    () =>
      res.submitForm({
        formSelector: "form[action='/change-password']",
        fields: {
          password: credentials.newPassword,
          'confirm-password': credentials.newPassword
        }
      }),
    { isStatusCode200, ...pageContentCheck('You’ve changed your password') }
  )

  sleepBetween(1, 3)

  // B02_ChangePassword_07_SignOut

  timeGroup(groups[10], () => {
    //01_OLHCall
    res = timeGroup(
      groups[11].split('::')[1],
      () => res.submitForm({ formSelector: "form[action='/sign-out']", params: { redirects: 0 } }),
      { isStatusCode302 }
    )

    //02_OIDCStubCall
    res = timeGroup(groups[12].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('API Simulation Tool')
    })
  })

  iterationsCompleted.add(1)
}

export function changePhone(): void {
  let res: Response
  const groups = groupMap.changePhone
  iterationsStarted.add(1)

  // B03_ChangePhone_01_LaunchAccountsHome

  timeGroup(groups[0], () => {
    //01_OLHCall
    res = timeGroup(groups[1].split('::')[1], () => http.get(env.envURL, { redirects: 0 }), { isStatusCode302 })

    //02_OIDCStubCall
    res = timeGroup(groups[2].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('API Simulation Tool')
    })
  })

  sleepBetween(1, 3)

  //B03_ChangePhone_02_SelectStubScenario

  timeGroup(groups[3], () => {
    //01_OIDCStubCall
    res = timeGroup(
      groups[4].split('::')[1],
      () => res.submitForm({ fields: { scenario: 'userPerformanceTest' }, params: { redirects: 0 } }),
      { isStatusCode302 }
    )

    //02_OLHCall
    res = timeGroup(groups[5].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Services you can use with GOV.UK One Login')
    })
  })

  sleepBetween(1, 3)

  // B03_ChangePhone_03_ClickSecurityTab
  res = timeGroup(groups[6], () => http.get(env.envURL + '/security'), {
    isStatusCode200,
    ...pageContentCheck('Delete your GOV.UK One Login')
  })

  sleepBetween(1, 3)

  // B03_ChangePhone_04_ClickChangePhoneNumberLink
  res = timeGroup(groups[7], () => http.get(env.envURL + '/enter-password?type=changePhoneNumber'), {
    isStatusCode200,
    ...pageContentCheck('Enter your password')
  })

  sleepBetween(1, 3)

  // B03_ChangePhone_05_EnterCurrentPassword
  res = timeGroup(
    groups[8],
    () =>
      res.submitForm({
        formSelector: "form[action='/enter-password']",
        fields: {
          requestType: 'changePhoneNumber',
          password: credentials.currPassword
        }
      }),
    {
      isStatusCode200,
      ...pageContentCheck('Enter your new mobile phone number')
    }
  )

  sleepBetween(1, 3)

  // B03_ChangePhone_06_EnterNewPhoneID
  res = timeGroup(
    groups[9],
    () =>
      res.submitForm({
        formSelector: "form[action='/change-phone-number']",
        fields: {
          phoneNumber: phoneData.newPhone,
          internationalPhoneNumber: ''
        }
      }),
    { isStatusCode200, ...pageContentCheck('Check your phone') }
  )

  sleepBetween(1, 3)

  // B03_ChangePhone_07_EnterSMSOTP
  res = timeGroup(
    groups[10],
    () =>
      res.submitForm({
        formSelector: "form[action='/check-your-phone']",
        fields: {
          phoneNumber: phoneData.newPhone,
          resendCodeLink: '/resend-phone-code',
          changePhoneNumberLink: '/change-phone-number',
          code: credentials.fixedPhoneOTP
        }
      }),
    {
      isStatusCode200,
      ...pageContentCheck('You’ve changed your phone number')
    }
  )

  sleepBetween(1, 3)

  // B03_ChangePhone_08_SignOut
  res = timeGroup(
    groups[11],
    () =>
      res.submitForm({
        formSelector: "form[action='/sign-out']"
      }),
    { isStatusCode200, ...pageContentCheck('You have signed out') }
  )

  iterationsCompleted.add(1)
}

export function deleteAccount(): void {
  const groups = groupMap.deleteAccount
  let res: Response
  iterationsStarted.add(1)

  // B04_DeleteAccount_01_LaunchAccountsHome

  timeGroup(groups[0], () => {
    //01_OLHCall
    res = timeGroup(groups[1].split('::')[1], () => http.get(env.envURL, { redirects: 0 }), { isStatusCode302 })

    //02_OIDCStubCall
    res = timeGroup(groups[2].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('API Simulation Tool')
    })
  })

  sleepBetween(1, 3)

  //B04_DeleteAccount_02_SelectStubScenario

  timeGroup(groups[3], () => {
    //01_OIDCStubCall
    res = timeGroup(
      groups[4].split('::')[1],
      () => res.submitForm({ fields: { scenario: 'userPerformanceTest' }, params: { redirects: 0 } }),
      { isStatusCode302 }
    )

    //02_OLHCall
    res = timeGroup(groups[5].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Services you can use with GOV.UK One Login')
    })
  })

  sleepBetween(1, 3)

  // B04_DeleteAccount_03_ClickSecurityTab
  res = timeGroup(groups[6], () => http.get(env.envURL + '/security'), {
    isStatusCode200,
    ...pageContentCheck('Delete your GOV.UK One Login')
  })

  sleepBetween(1, 3)

  // B04_DeleteAccount_04_ClickDeleteAccountLink
  res = timeGroup(groups[7], () => http.get(env.envURL + '/enter-password?type=deleteAccount'), {
    isStatusCode200,
    ...pageContentCheck('Enter your password')
  })

  sleepBetween(1, 3)

  // B04_DeleteAccount_05_EnterCurrentPassword
  res = timeGroup(
    groups[8],
    () =>
      res.submitForm({
        formSelector: "form[action='/enter-password']",
        fields: {
          requestType: 'deleteAccount',
          password: credentials.currPassword
        }
      }),
    {
      isStatusCode200,
      ...pageContentCheck('Are you sure you want to delete your GOV.UK One Login')
    }
  )

  sleepBetween(1, 3)

  // B04_DeleteAccount_06_DeleteAccountConfirm
  res = timeGroup(
    groups[9],
    () =>
      res.submitForm({
        formSelector: "form[action='/delete-account']"
      }),
    { isStatusCode200, ...pageContentCheck('You have signed out') }
  )
  iterationsCompleted.add(1)
}

export function validateUser(): void {
  const groups = groupMap.validateUser
  let res: Response
  const userData = validateData[exec.scenario.iterationInInstance % validateData.length]
  iterationsStarted.add(1)

  // B05_ValidateUser_01_LaunchAccountsHome
  res = timeGroup(groups[0], () => http.get(env.envURL), {
    isStatusCode200,
    ...pageContentCheck('Create a GOV.UK One Login or sign in')
  })

  sleepBetween(1, 3)

  // B05_ValidateUser_02_ClickSignIn
  res = timeGroup(
    groups[1],
    () =>
      res.submitForm({
        fields: {
          supportInternationalNumbers: 'true'
        }
      }),
    {
      isStatusCode200,
      ...pageContentCheck('Enter your email address to sign in to your GOV.UK One Login')
    }
  )

  sleepBetween(1, 3)

  // B05_ValidateUser_03_EnterEmailAddress
  res = timeGroup(
    groups[2],
    () =>
      res.submitForm({
        fields: { email: userData.email }
      }),
    { isStatusCode200, ...pageContentCheck('Enter your password') }
  )

  sleepBetween(1, 3)

  let acceptNewTerms = false
  switch (userData.mfaOption) {
    case 'AUTH_APP': {
      // B05_ValidateUser_04_AuthMFA_EnterPassword
      res = timeGroup(
        groups[3],
        () =>
          res.submitForm({
            fields: { password: credentials.currPassword }
          }),
        {
          isStatusCode200,
          ...pageContentCheck('Enter the 6 digit security code shown in your authenticator app')
        }
      )

      sleepBetween(1, 3)

      const totp = new TOTP(credentials.authAppKey)
      // B05_ValidateUser_05_AuthMFA_EnterTOTP
      res = timeGroup(
        groups[4],
        () => {
          const response = res.submitForm({
            fields: { code: totp.generateTOTP() }
          })
          acceptNewTerms = (response.body as string).includes('terms of use update')
          return response
        },
        {
          isStatusCode200,
          'verify page content': r =>
            acceptNewTerms || (r.body as string).includes('Services you can use with GOV.UK One Login')
        }
      )
      break
    }
    case 'SMS': {
      // B05_ValidateUser_06_SMSMFA_EnterPassword
      res = timeGroup(
        groups[5],
        () =>
          res.submitForm({
            fields: { password: credentials.currPassword }
          }),
        { isStatusCode200, ...pageContentCheck('Check your phone') }
      )

      sleep(1)

      // B05_ValidateUser_07_SMSMFA_EnterOTP
      res = timeGroup(
        groups[6],
        () => {
          const response = res.submitForm({
            fields: { code: credentials.fixedPhoneOTP }
          })
          acceptNewTerms = (response.body as string).includes('terms of use update')
          return response
        },
        {
          isStatusCode200,
          'verify page content': r =>
            acceptNewTerms || (r.body as string).includes('Services you can use with GOV.UK One Login')
        }
      )
      break
    }
  }

  if (acceptNewTerms) {
    // B05_ValidateUser_08_AcceptTermsConditions
    res = timeGroup(
      groups[7],
      () =>
        res.submitForm({
          fields: { termsAndConditionsResult: 'accept' }
        }),
      {
        isStatusCode200,
        ...pageContentCheck('Services you can use with GOV.UK One Login')
      }
    )
  }

  // Wait for end of the next 5 second window to synchronise requests across VUs
  sleep((5000 - (Date.now() % 5000)) / 1000)

  for (let i = 0; i < 5; i++) {
    // B05_ValidateUser_09_ClickSecurityTab
    res = timeGroup(groups[8], () => http.get(env.envURL + '/security'), {
      isStatusCode200,
      ...pageContentCheck(`${userData.email}`)
    })
  }

  sleepBetween(1, 3)

  // B05_ValidateUser_10_Logout
  res = timeGroup(
    groups[9],
    () =>
      res.submitForm({
        formSelector: "form[action='/sign-out']"
      }),
    { isStatusCode200, ...pageContentCheck('You have signed out') }
  )
  iterationsCompleted.add(1)
}

export function contactsPage(): void {
  const groups = groupMap.contactsPage
  iterationsStarted.add(1)

  // B06_01_ContactsPage
  timeGroup(groups[0], () => http.get(env.envURL + '/contact-gov-uk-one-login'), {
    isStatusCode200,
    ...pageContentCheck('Contact GOV.UK One Login')
  })
  iterationsCompleted.add(1)
}
