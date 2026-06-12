import { check, sleep } from 'k6'
import encoding from 'k6/encoding'
import passkeys from 'k6/x/passkeys'
import { SharedArray } from 'k6/data'
import execution from 'k6/execution'
import http, { type Response } from 'k6/http'
import { type Options } from 'k6/options'
import TOTP from '../common/utils/authentication/totp'
import {
  isStatusCode200,
  isStatusCode302,
  pageContentCheck,
  redirectLocationValidation
} from '../common/utils/checks/assertions'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile,
  createI3SpikeSignUpScenario,
  createI3SpikeSignInScenario,
  createI4PeakTestSignUpScenario,
  createI4PeakTestSignInScenario,
  createStressTestSignInScenario,
  createStressTestSignUpScenario,
  createSoakTestSignUpScenario,
  createSoakTestSignInScenario
} from '../common/utils/config/load-profiles'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
import { timeGroup } from '../common/utils/request/timing'
import { getEnv } from '../common/utils/config/environment-variables'
import { browser, type Page, type Response as PageResponse } from 'k6/browser'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('signIn', LoadProfile.smoke),
    ...createScenario('signUp', LoadProfile.smoke),
    ...createScenario('passkeyCreationSignIn', LoadProfile.smoke),
    ...createScenario('userCreationForPasskey', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('signIn', LoadProfile.short, 30),
    ...createScenario('signUp', LoadProfile.short, 30)
  },
  load: {
    ...createScenario('signIn', LoadProfile.full, 500, 20)
  },
  stress: {
    ...createScenario('signIn', LoadProfile.full, 2000, 5),
    ...createScenario('signUp', LoadProfile.full, 100)
  },
  rampOnly: {
    ...createScenario('signUp', LoadProfile.rampOnly, 30)
  },
  browser: {
    uiSignIn: {
      executor: 'per-vu-iterations',
      exec: 'uiSignIn',
      vus: 1,
      iterations: 1,
      options: {
        browser: {
          type: 'chromium'
        }
      }
    }
  },
  lowVolPerf007Test: {
    signUp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 400,
      stages: [
        { target: 20, duration: '200s' },
        { target: 20, duration: '180s' }
      ],
      exec: 'signUp'
    },
    signIn: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { target: 10, duration: '200s' },
        { target: 10, duration: '180s' }
      ],
      exec: 'signIn'
    }
  },
  perf006Iteration1: {
    signUp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 297,
      stages: [
        { target: 90, duration: '90s' },
        { target: 90, duration: '15m' }
      ],
      exec: 'signUp'
    },
    signIn: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 306,
      stages: [
        { target: 17, duration: '9s' },
        { target: 17, duration: '15m' }
      ],
      exec: 'signIn'
    }
  },
  spikeI2HighTraffic: {
    ...createScenario('signUp', LoadProfile.spikeI2HighTraffic, 35, 48),
    ...createScenario('signIn', LoadProfile.spikeI2HighTraffic, 32, 24)
  },
  perf006Iteration2PeakTest: {
    signUp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 576,
      stages: [
        { target: 120, duration: '121s' },
        { target: 120, duration: '30m' }
      ],
      exec: 'signUp'
    },
    signIn: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 264,
      stages: [
        { target: 11, duration: '6s' },
        { target: 11, duration: '30m' }
      ],
      exec: 'signIn'
    }
  },
  perf006Iteration3PeakTest: {
    signUp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 100,
      maxVUs: 528,
      stages: [
        { target: 160, duration: '161s' },
        { target: 160, duration: '30m' }
      ],
      exec: 'signUp'
    },
    signIn: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 432,
      stages: [
        { target: 24, duration: '12s' },
        { target: 24, duration: '30m' }
      ],
      exec: 'signIn'
    }
  },
  perf006Iteration3SpikeTest: {
    ...createI3SpikeSignUpScenario('signUp', 490, 33, 491),
    ...createI3SpikeSignInScenario('signIn', 71, 18, 33)
  },
  perf006Iteration3RegressionTest: {
    signUp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 33,
      maxVUs: 66,
      stages: [
        { target: 20, duration: '21s' },
        { target: 20, duration: '5m' }
      ],
      exec: 'signUp'
    },
    signIn: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 45,
      maxVUs: 90,
      stages: [
        { target: 5, duration: '3s' },
        { target: 5, duration: '5m' }
      ],
      exec: 'signIn'
    }
  },
  perf006Iteration3SoakTest: {
    signUp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 33,
      maxVUs: 66,
      stages: [
        { target: 20, duration: '21s' },
        { target: 20, duration: '6h' }
      ],
      exec: 'signUp'
    },
    signIn: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 27,
      maxVUs: 54,
      stages: [
        { target: 3, duration: '3s' },
        { target: 3, duration: '6h' }
      ],
      exec: 'signIn'
    }
  },
  perf006Iteration3StressTest: {
    signUp: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '10s',
      preAllocatedVUs: 1584,
      maxVUs: 3168,
      stages: [
        { target: 160, duration: '161s' },
        { target: 160, duration: '300s' },
        { target: 320, duration: '161s' },
        { target: 320, duration: '300s' },
        { target: 480, duration: '161s' },
        { target: 480, duration: '300s' },
        { target: 640, duration: '161s' },
        { target: 640, duration: '300s' },
        { target: 800, duration: '161s' },
        { target: 800, duration: '300s' },
        { target: 960, duration: '161s' },
        { target: 960, duration: '300s' }
      ],
      exec: 'signUp'
    },
    signIn: {
      executor: 'ramping-arrival-rate',
      startRate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 1296,
      maxVUs: 2592,
      stages: [
        { target: 24, duration: '13s' },
        { target: 24, duration: '448s' },
        { target: 48, duration: '13s' },
        { target: 48, duration: '448s' },
        { target: 72, duration: '13s' },
        { target: 72, duration: '448s' },
        { target: 96, duration: '13s' },
        { target: 96, duration: '448s' },
        { target: 120, duration: '13s' },
        { target: 120, duration: '448s' },
        { target: 144, duration: '13s' },
        { target: 144, duration: '448s' }
      ],
      exec: 'signIn'
    }
  },
  perf006Iteration4PeakTest: {
    ...createI4PeakTestSignUpScenario('signUp', 470, 33, 471),
    ...createI4PeakTestSignInScenario('signIn', 43, 18, 21)
  },
  perf006Iteration4SpikeTest: {
    ...createI3SpikeSignUpScenario('signUp', 1130, 33, 1131),
    ...createI3SpikeSignInScenario('signIn', 129, 18, 60)
  },
  perf006Iteration5PeakTest: {
    ...createI4PeakTestSignUpScenario('signUp', 570, 33, 571),
    ...createI4PeakTestSignInScenario('signIn', 65, 18, 31)
  },
  perf006Iteration5SpikeTest: {
    ...createI3SpikeSignUpScenario('signUp', 1130, 33, 1131),
    ...createI3SpikeSignInScenario('signIn', 162, 18, 74)
  },
  perf006Iteration6PeakTest: {
    ...createI4PeakTestSignUpScenario('signUp', 920, 33, 921),
    ...createI4PeakTestSignInScenario('signIn', 104, 18, 48)
  },
  perf006Iteration6SpikeTest: {
    ...createI3SpikeSignUpScenario('signUp', 1830, 33, 1831),
    ...createI3SpikeSignInScenario('signIn', 260, 18, 119)
  },
  perf006Iteration7PeakTest: {
    ...createI4PeakTestSignUpScenario('signUp', 600, 33, 601),
    ...createI4PeakTestSignInScenario('signIn', 71, 18, 33)
  },
  perf006Iteration7SpikeTest: {
    ...createI3SpikeSignUpScenario('signUp', 1210, 33, 1211),
    ...createI3SpikeSignInScenario('signIn', 143, 18, 66)
  },
  perf006Iteration8PeakTest: {
    ...createI4PeakTestSignUpScenario('signUp', 420, 33, 421),
    ...createI4PeakTestSignInScenario('signIn', 126, 18, 58)
  },
  perf006Iteration8SpikeTest: {
    ...createI3SpikeSignUpScenario('signUp', 910, 33, 911),
    ...createI3SpikeSignInScenario('signIn', 227, 18, 104)
  },
  perf006Iteration9StressTest: {
    ...createStressTestSignUpScenario('signUp', 960, 33, 961),
    ...createStressTestSignInScenario('signIn', 250, 18, 115, 283)
  },
  redisFailoverTest: {
    ...createI4PeakTestSignUpScenario('signUp', 100, 33, 101),
    ...createI4PeakTestSignInScenario('signIn', 10, 18, 6)
  },
  perf006Iteration9SoakTest: {
    ...createSoakTestSignUpScenario('signUp', 110, 33, 111),
    ...createSoakTestSignInScenario('signIn', 15, 6, 8)
  }
}
const loadProfile = selectProfile(profiles)
const groupMap = {
  signUp: [
    'B01_SignUp_01_OrchStubSubmit',
    'B01_SignUp_01_OrchStubSubmit::01_OrchStub',
    'B01_SignUp_01_OrchStubSubmit::02_AuthCall',
    'B01_SignUp_01_RPStubSubmit',
    'B01_SignUp_01_RPStubSubmit::01_RPStub',
    'B01_SignUp_01_RPStubSubmit::02_OIDCCall',
    'B01_SignUp_01_RPStubSubmit::03_AuthCall',
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
    'B01_SignUp_11_ContinueAccountCreated::02_OrchStubCall',
    'B01_SignUp_11_ContinueAccountCreated::02_OIDCCall',
    'B01_SignUp_11_ContinueAccountCreated::03_RPStubCall'
  ],
  signIn: [
    'B02_SignIn_01_OrchStubSubmit',
    'B02_SignIn_01_OrchStubSubmit::01_OrchStub',
    'B02_SignIn_01_OrchStubSubmit::02_AuthCall',
    'B02_SignIn_01_RPStubSubmit',
    'B02_SignIn_01_RPStubSubmit::01_RPStub',
    'B02_SignIn_01_RPStubSubmit::02_OIDCCall',
    'B02_SignIn_01_RPStubSubmit::03_AuthCall',
    'B02_SignIn_02_ClickSignIn',
    'B02_SignIn_03_EnterEmailAddress',
    'B02_SignIn_04_EnterPassword',
    'B02_SignIn_05_EnterOTP',
    'B02_SignIn_05_EnterOTP::01_AuthCall',
    'B02_SignIn_05_EnterOTP::02_AuthAcceptTerms',
    'B02_SignIn_05_EnterOTP::03_AuthCall',
    'B02_SignIn_05_EnterOTP::04_OrchStub',
    'B02_SignIn_05_EnterOTP::04_OIDCCall',
    'B02_SignIn_05_EnterOTP::05_RPStub',
    'B02_SignIn_06_AcceptTermsConditions',
    'B02_SignIn_06_AcceptTermsConditions::01_AuthCall',
    'B02_SignIn_06_AcceptTermsConditions::02_OrchStub',
    'B02_SignIn_06_AcceptTermsConditions::02_OIDCCall',
    'B02_SignIn_06_AcceptTermsConditions::03_RPStub'
  ],
  uiSignIn: [],
  passkeyCreationSignIn: [
    'B03_PasskeyCreationSignIn_01_OrchStubSubmit', //pragma: allowlist secret
    'B03_PasskeyCreationSignIn_01_OrchStubSubmit::01_OrchStub',
    'B03_PasskeyCreationSignIn_01_OrchStubSubmit::02_AuthCall',
    'B03_PasskeyCreationSignIn_01_RPStubSubmit',
    'B03_PasskeyCreationSignIn_01_RPStubSubmit::01_RPStub',
    'B03_PasskeyCreationSignIn_01_RPStubSubmit::02_OIDCCall',
    'B03_PasskeyCreationSignIn_01_RPStubSubmit::03_AuthCall',
    'B03_PasskeyCreation_02_ClickSignIn',
    'B03_PasskeyCreation_03_EnterEmailAddress',
    'B03_PasskeyCreation_04_EnterPassword',
    'B03_PasskeyCreation_05_EnterOTP',
    'B03_PasskeyCreation_06_ClickContinuePasskeySetup',
    'B03_PasskeyCreation_06_ClickContinuePasskeySetup::01_AuthCall',
    'B03_PasskeyCreation_06_ClickContinuePasskeySetup::02_AMCRequest',
    'B03_PasskeyCreation_07_SetUpPasskey',
    'B03_PasskeyCreation_07_SetUpPasskey::01_AMCRequest',
    'B03_PasskeyCreation_07_SetUpPasskey::02_AuthCall',
    'B03_PasskeyCreation_08_ClickContinuePasskeyCreated',
    'B03_PasskeyCreation_08_ClickContinuePasskeyCreated::01_AuthCall',
    'B03_PasskeyCreation_08_ClickContinuePasskeyCreated::02_AuthAcceptTerms',
    'B03_PasskeyCreation_08_ClickContinuePasskeyCreated::03_AuthCall',
    'B03_PasskeyCreation_08_ClickContinuePasskeyCreated::04_OrchStub',
    'B03_PasskeyCreation_08_ClickContinuePasskeyCreated::04_OIDCCall',
    'B03_PasskeyCreation_08_ClickContinuePasskeyCreated::05_RPStub',
    'B03_PasskeyCreation_09_AcceptTermsConditions',
    'B03_PasskeyCreation_09_AcceptTermsConditions::01_AuthCall',
    'B03_PasskeyCreation_09_AcceptTermsConditions::02_OrchStubCall',
    'B03_PasskeyCreation_09_AcceptTermsConditions::02_OIDCCall',
    'B03_PasskeyCreation_09_AcceptTermsConditions::03_RPStub',
    'B04_SignInWithPasskey_02_ClickSignIn',
    'B04_SignInWithPasskey_03_EnterEmailAddress',
    'B04_SignInWithPasskey_04_ClickContinuePasskey',
    'B04_SignInWithPasskey_04_ClickContinuePasskey::01_AuthCall',
    'B04_SignInWithPasskey_04_ClickContinuePasskey::02_AuthAcceptTerms',
    'B04_SignInWithPasskey_04_ClickContinuePasskey::03_AuthCall',
    'B04_SignInWithPasskey_04_ClickContinuePasskey::04_OrchStub',
    'B04_SignInWithPasskey_04_ClickContinuePasskey::04_OIDCCall',
    'B04_SignInWithPasskey_04_ClickContinuePasskey::05_RPStub',
    'B04_SignInWithPasskey_05_AcceptTermsConditions', // pragma: allowlist secret
    'B04_SignInWithPasskey_05_AcceptTermsConditions::01_AuthCall',
    'B04_SignInWithPasskey_05_AcceptTermsConditions::02_OrchStubCall',
    'B04_SignInWithPasskey_05_AcceptTermsConditions::02_OIDCCall',
    'B04_SignInWithPasskey_05_AcceptTermsConditions::03_RPStub'
  ],
  signInWithPasskey: [
    'B04_SignInWithPasskey_01_OrchStubSubmit',
    'B04_SignInWithPasskey_01_OrchStubSubmit::01_OrchStub',
    'B04_SignInWithPasskey_01_OrchStubSubmit::02_AuthCall',
    'B04_SignInWithPasskey_01_RPStubSubmit',
    'B04_SignInWithPasskey_01_RPStubSubmit::01_RPStub',
    'B04_SignInWithPasskey_01_RPStubSubmit::02_OIDCCall',
    'B04_SignInWithPasskey_01_RPStubSubmit::03_AuthCall',
    'B04_SignInWithPasskey_02_ClickSignIn',
    'B04_SignInWithPasskey_03_EnterEmailAddress',
    'B04_SignInWithPasskey_04_ClickContinuePasskey',
    'B04_SignInWithPasskey_04_ClickContinuePasskey::01_AuthCall',
    'B04_SignInWithPasskey_04_ClickContinuePasskey::02_AuthAcceptTerms',
    'B04_SignInWithPasskey_04_ClickContinuePasskey::03_AuthCall',
    'B04_SignInWithPasskey_04_ClickContinuePasskey::04_OrchStub',
    'B04_SignInWithPasskey_04_ClickContinuePasskey::04_OIDCCall',
    'B04_SignInWithPasskey_04_ClickContinuePasskey::05_RPStub',
    'B04_SignInWithPasskey_05_AcceptTermsConditions', // pragma: allowlist secret
    'B04_SignInWithPasskey_05_AcceptTermsConditions::01_AuthCall',
    'B04_SignInWithPasskey_05_AcceptTermsConditions::02_OrchStubCall',
    'B04_SignInWithPasskey_05_AcceptTermsConditions::02_OIDCCall',
    'B04_SignInWithPasskey_05_AcceptTermsConditions::03_RPStub'
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
  // We have 10k users for each auth type setup in auth.
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

interface PasskeyData {
  email: string
}

const passkeyCSV: PasskeyData[] = new SharedArray('Passkey Data CSV', () => {
  return open('./data/passkeyData.csv')
    .split('\n')
    .slice(1)
    .map(email => {
      return {
        email
      }
    })
})

const credentials = {
  authAppKey: getEnv('ACCOUNT_APP_KEY'),
  password: getEnv('ACCOUNT_APP_PASSWORD'),
  emailOTP: getEnv('ACCOUNT_EMAIL_OTP'),
  phoneOTP: getEnv('ACCOUNT_PHONE_OTP')
}

const route = getEnv('ROUTE').toLocaleUpperCase()
const validRoute = ['RP', 'ORCH']
if (!validRoute.includes(route)) throw new Error(`Route '${route}' not in [${validRoute.toString()}]`)

const env = {
  stubEndpoint: getEnv(`ACCOUNT_${route}_STUB`),
  staticResources: __ENV.K6_NO_STATIC_RESOURCES == 'true',
  authStagingURL: getEnv('ACCOUNT_STAGING_URL'),
  amcURL: getEnv('ACCOUNT_AMC_STAGING_URL'),
  amcName: getEnv('ACCOUNT_AMC_NAME'),
  amcID: getEnv('ACCOUNT_AMC_ID'),
  amcOrigin: getEnv('ACCOUNT_AMC_ORIGIN')
}
const rpPasskeyCreation = passkeys.newRelyingParty(env.amcName, env.amcID, env.amcOrigin)
const rpPasskeySignIn = passkeys.newRelyingParty(env.amcName, env.amcID, env.authStagingURL)

async function ClickButton(p: Page, selector: string = 'button[type="Submit"]'): Promise<[PageResponse | null, void]> {
  return Promise.all([p.waitForNavigation(), p.locator(selector).click()])
}

export async function uiSignIn() {
  iterationsStarted.add(1)
  // https://community.grafana.com/t/unique-login-for-each-virtual-user/99596
  const userData = dataSignIn[execution.vu.idInTest - 1]

  const page: Page = await browser.newPage()

  let targetUrl = env.stubEndpoint
  if (route === 'RP') {
    targetUrl += '/start'
  } else if (route === 'ORCH') {
    targetUrl += '?reauthenticate=&level=Cl.Cm&authenticated=no&authenticatedLevel=Cl.Cm&channel=none'
  }
  try {
    await page.goto(targetUrl)
    await ClickButton(page, 'button#sign-in-button')

    page.locator('input[name="email"]').type(userData.email)
    await ClickButton(page)

    page.locator('input#password').type(credentials.password)
    await ClickButton(page)

    switch (userData.mfaOption) {
      case 'AUTH_APP': {
        const totp = new TOTP(credentials.authAppKey)
        page.locator('input#code').type(totp.generateTOTP())
        await ClickButton(page)
        break
      }
      case 'SMS': {
        page.locator('input#code').type(credentials.phoneOTP)
        await ClickButton(page)
        break
      }
    }

    if (page.url().endsWith('updated-terms-and-conditions')) {
      await ClickButton(page)
    }

    const content = await page.content()
    check(null, { validatePageContent: () => content.includes(userData.email.toLowerCase()) })
  } finally {
    page.close()
  }
  iterationsCompleted.add(1)
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

  // B01_SignUp_01_StubSubmit
  if (route === 'RP') {
    res = rpStubSubmit(groups)
  } else if (route === 'ORCH') {
    res = orchStubSubmit(groups)
  }

  sleep(1)

  // B01_SignUp_02_CreateOneLogin
  res = timeGroup(
    groups[7],
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
  res = timeGroup(groups[8], () => res.submitForm({ fields: { email: testEmail } }), {
    isStatusCode200,
    ...pageContentCheck('Check your email')
  })

  sleep(1)

  // B01_SignUp_04_EnterOTP
  res = timeGroup(
    groups[9],
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
    groups[10],
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
        groups[11],
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
        groups[12],
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
        groups[13],
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
        groups[14],
        () =>
          res.submitForm({
            fields: { phoneNumber }
          }),
        { isStatusCode200, ...pageContentCheck('Check your phone') }
      )

      sleep(1)

      // B01_SignUp_10_MFA_EnterSMSOTP
      res = timeGroup(
        groups[15],
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
  timeGroup(groups[16], () => {
    // 01_AuthCall (common for ORCH and RP route)
    res = timeGroup(groups[17].split('::')[1], () => res.submitForm({ params: { redirects: 1 } }), {
      isStatusCode302
    })
    if (route === 'ORCH') {
      // 02_OrchStub
      res = timeGroup(groups[18].split('::')[1], () => http.get(res.headers.Location), {
        isStatusCode200,
        ...pageContentCheck(testEmail.toLowerCase())
      })
    } else if (route === 'RP') {
      // 02_OIDCCall
      res = timeGroup(groups[19].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
        isStatusCode302
      })
      //03_RPStub
      res = timeGroup(groups[20].split('::')[1], () => http.get(res.headers.Location), {
        isStatusCode200,
        ...pageContentCheck(testEmail.toLowerCase())
      })
    }
  })
  iterationsCompleted.add(1)
}

export function orchStubSubmit(groups: readonly string[]): Response {
  let res: Response

  // OrchStubSubmit
  return timeGroup(groups[0], () => {
    // 01_OrchStubCall
    res = timeGroup(
      groups[1].split('::')[1],
      () =>
        http.post(
          env.stubEndpoint,
          {
            reauthenticate: '',
            level: 'Cl.Cm',
            authenticated: 'no',
            authenticatedLevel: 'Cl.Cm',
            channel: 'none'
          },
          { redirects: 0 }
        ),
      {
        isStatusCode302
      }
    )
    // 02_AuthCall
    return timeGroup(
      groups[2].split('::')[1],
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
}

export function rpStubSubmit(groups: readonly string[]): Response {
  let res: Response

  return timeGroup(groups[3], () => {
    // 01_RPStubCall (Initial Request)
    res = timeGroup(groups[4].split('::')[1], () => http.get(env.stubEndpoint + '/start', { redirects: 0 }), {
      //changed orchStub to stubEndPoint
      isStatusCode302
    })

    // 02_OIDCStubCall (Redirect Handling)
    res = timeGroup(
      groups[5].split('::')[1],
      () => http.get(res.headers.Location, { redirects: 0 }), // Follow the redirect
      {
        isStatusCode302,
        ...redirectLocationValidation(`${env.authStagingURL}/authorize`)
      }
    )
    // 03_AuthCall
    return timeGroup(groups[6].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('Create your GOV.UK One Login or sign in')
    })
  })
}

export function signIn(): void {
  let res: Response
  const groups = groupMap.signIn
  const userData = dataSignIn[execution.vu.idInTest - 1]
  iterationsStarted.add(1)

  // B02_SignIn_01_StubSubmit
  if (route === 'RP') {
    res = rpStubSubmit(groups)
  } else if (route === 'ORCH') {
    res = orchStubSubmit(groups)
  }

  sleep(1)

  // B02_SignIn_02_ClickSignIn
  res = timeGroup(
    groups[7],
    () =>
      res.submitForm({
        submitSelector: '#sign-in-button'
      }),
    {
      isStatusCode200,
      ...pageContentCheck('Enter your email address to sign in to your GOV.UK One Login')
    }
  )

  sleep(1)

  // B02_SignIn_03_EnterEmailAddress
  res = timeGroup(
    groups[8],
    () =>
      res.submitForm({
        fields: { email: userData.email }
      }),
    { isStatusCode200, ...pageContentCheck('Enter your password') }
  )

  sleep(1)

  function getOTP(): string {
    switch (userData.mfaOption) {
      case 'AUTH_APP': {
        const totp = new TOTP(credentials.authAppKey)
        return totp.generateTOTP()
      }
      case 'SMS':
        return credentials.phoneOTP
    }
  }

  const header =
    userData.mfaOption === 'AUTH_APP'
      ? 'Enter the 6 digit security code shown in your authenticator app'
      : 'Check your phone'

  let acceptNewTerms = false

  // B02_SignIn_04_EnterPassword
  res = timeGroup(
    groups[9],
    () =>
      res.submitForm({
        fields: { password: credentials.password }
      }),
    {
      isStatusCode200,
      ...pageContentCheck(header)
    }
  )
  sleep(1)

  // B02_SignIn_05_EnterOTP
  timeGroup(groups[10], () => {
    //01_AuthCall
    res = timeGroup(
      groups[11].split('::')[1],
      () =>
        res.submitForm({
          fields: { code: getOTP() },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )

    acceptNewTerms = res.headers.Location.endsWith('updated-terms-and-conditions')
    if (acceptNewTerms) {
      // 02_AuthAcceptTerms
      res = timeGroup(groups[12].split('::')[1], () => http.get(env.authStagingURL + res.headers.Location), {
        isStatusCode200,
        ...pageContentCheck('We’ve updated our terms of use')
      })
    } else {
      // 03_AuthCall
      res = timeGroup(
        groups[13].split('::')[1],
        () => http.get(env.authStagingURL + res.headers.Location, { redirects: 0 }),
        {
          isStatusCode302
        }
      )

      if (route === 'ORCH') {
        // 04_OrchStub
        res = timeGroup(groups[14].split('::')[1], () => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck(userData.email.toLowerCase())
        })
      } else if (route === 'RP') {
        // 04_OIDCCall
        res = timeGroup(groups[15].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
          isStatusCode302
        })
        //05_RPStub
        res = timeGroup(groups[16].split('::')[1], () => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck(userData.email.toLowerCase())
        })
      }
    }

    if (acceptNewTerms) {
      // B02_SignIn_06_AcceptTermsConditions
      timeGroup(groups[17], () => {
        // 01_AuthCall
        res = timeGroup(
          groups[18].split('::')[1],
          () =>
            res.submitForm({
              fields: { termsAndConditionsResult: 'accept' },
              params: { redirects: 1 }
            }),
          { isStatusCode302 }
        )

        if (route === 'ORCH') {
          // 02_OrchStub
          res = timeGroup(groups[19].split('::')[1], () => http.get(res.headers.Location), {
            isStatusCode200,
            ...pageContentCheck(userData.email.toLowerCase())
          })
        } else if (route === 'RP') {
          // 02_OIDCCall
          res = timeGroup(groups[20].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
            isStatusCode302
          })
          //03_RPStub
          res = timeGroup(groups[21].split('::')[1], () => http.get(res.headers.Location), {
            isStatusCode200,
            ...pageContentCheck(userData.email.toLowerCase())
          })
        }
      })
    }
  })
  iterationsCompleted.add(1)
}

export function passkeyCreationSignIn(): void {
  let res: Response
  let amcPage: Response
  let userHandle: string
  const groups = groupMap.passkeyCreationSignIn
  const maxVUs = (loadProfile.scenarios.passkeyCreationSignIn as { maxVUs: number })?.maxVUs ?? 1
  const passkeyIndex = execution.vu.idInTest - 1 + execution.vu.iterationInScenario * maxVUs
  if (passkeyIndex >= passkeyCSV.length) {
    execution.test.abort(`Insufficient passkey data: index ${passkeyIndex} exceeds available rows ${passkeyCSV.length}`)
  }
  const passkeyUsers = passkeyCSV[passkeyIndex]
  const credential = passkeys.newCredential()
  iterationsStarted.add(1)

  // B03_PasskeyCreation_01_StubSubmit
  if (route === 'RP') {
    res = rpStubSubmit(groups)
  } else if (route === 'ORCH') {
    res = orchStubSubmit(groups)
  }

  sleep(1)

  // B03_PasskeyCreation_02_ClickSignIn
  res = timeGroup(
    groups[7],
    () =>
      res.submitForm({
        submitSelector: '#sign-in-button'
      }),
    {
      isStatusCode200,
      ...pageContentCheck('Enter your email address to sign in to your GOV.UK One Login')
    }
  )

  sleep(1)

  // B03_PasskeyCreation_03_EnterEmailAddress
  res = timeGroup(
    groups[8],
    () => {
      const r = res.submitForm({
        fields: { email: passkeyUsers.email, browserSupportsWebAuthn: 'true' }
      })
      if (pageContentCheck('Use your passkey to sign in to GOV.UK One Login').validatePageContent(r)) {
        console.log('Passkey already set up for the user: - ' + passkeyUsers.email)
      }
      return r
    },
    { isStatusCode200, ...pageContentCheck('Enter your password') }
  )

  sleep(1)

  let acceptNewTerms = false

  // B03_PasskeyCreation_04_EnterPassword
  res = timeGroup(
    groups[9],
    () =>
      res.submitForm({
        fields: { password: credentials.password }
      }),
    {
      isStatusCode200,
      ...pageContentCheck('Enter the 6 digit')
    }
  )
  sleep(1)

  let mfaOption: mfaType
  if ((res.body as string).includes('Check your phone')) {
    mfaOption = 'SMS'
    console.log(`MFA option in the SMS condition is ${mfaOption}`)
  } else if ((res.body as string).includes('Enter the 6 digit security code shown in your authenticator app')) {
    mfaOption = 'AUTH_APP'
    console.log(`MFA option in the APP condition is ${mfaOption}`)
  }

  function getOTP(): string {
    switch (mfaOption) {
      case 'AUTH_APP': {
        const totp = new TOTP(credentials.authAppKey)
        return totp.generateTOTP()
      }
      case 'SMS':
        return credentials.phoneOTP
    }
  }

  // B03_PasskeyCreation_05_EnterOTP
  res = timeGroup(groups[10], () => res.submitForm({ fields: { code: getOTP() } }), {
    isStatusCode200,
    ...pageContentCheck('Sign in faster with your face, fingerprint or passcode')
  })
  sleep(1)

  // B03_PasskeyCreation_06_ClickContinuePasskeySetup
  timeGroup(groups[11], () => {
    //01_AuthCall
    res = timeGroup(
      groups[12].split('::')[1],
      () =>
        res.submitForm({
          fields: { createPasskeyOption: 'submit' },
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )

    // 02_AMCRequest — store in dedicated variable
    amcPage = timeGroup(groups[13].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck(
        'You’ll be asked to scan your face or fingerprint, or enter your device passcode, PIN or pattern'
      )
    })
  })

  // B03_PasskeyCreation_07_SetUpPasskey
  timeGroup(groups[14], () => {
    const csrfTokenCreation = amcPage.html('input[name="_csrf"]').attr('value') ?? 'CSRF Token not found'
    const matchDataRegOptions = (amcPage.body as string).match(/data-registration-options="([^"]+)"/)
    if (!matchDataRegOptions) throw new Error('data-registration-options not found in response')

    // Step 1: decode \uXXXX sequences (e.g. \u0026 → &)
    const unicodeDecodedRegOptions = JSON.parse(
      `"${matchDataRegOptions[1].replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    ) as string
    // Step 2: decode HTML entities (&quot; → ", &amp; → &, etc.)
    const registrationOptionsJSON = unicodeDecodedRegOptions
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')

    const registrationOptions = JSON.parse(registrationOptionsJSON)
    userHandle = registrationOptions.user.id // extract userHandle here (base64url encoded)
    const rawRegResponseCreation = passkeys.createAttestationResponse(
      rpPasskeyCreation,
      credential,
      JSON.stringify(registrationOptions)
    )

    // Augment with fields expected by @simplewebauthn/server
    const augmentedRegResponseCreation = JSON.parse(rawRegResponseCreation)
    augmentedRegResponseCreation.authenticatorAttachment = 'platform'
    augmentedRegResponseCreation.clientExtensionResults = { credProps: { rk: true } }
    augmentedRegResponseCreation.response.transports = ['internal']
    const registrationResponseCreation = JSON.stringify(augmentedRegResponseCreation)
    //01_AMCRequest
    res = timeGroup(
      groups[15].split('::')[1],
      () =>
        http.post(
          env.amcURL + '/cannot-set-up-passkey',
          {
            action: 'register',
            _csrf: csrfTokenCreation,
            registrationResponse: registrationResponseCreation
          },
          {
            redirects: 0
          }
        ),
      { isStatusCode302 }
    )

    // 02_AuthCall
    res = timeGroup(groups[16].split('::')[1], () => http.get(res.headers.Location), {
      isStatusCode200,
      ...pageContentCheck('You’ve set up a passkey')
    })
  })

  //B03_PasskeyCreation_08_ClickContinuePasskeyCreated
  timeGroup(groups[17], () => {
    //01_AuthCall
    res = timeGroup(
      groups[18].split('::')[1],
      () =>
        res.submitForm({
          params: { redirects: 0 }
        }),
      { isStatusCode302 }
    )

    acceptNewTerms = res.headers.Location.endsWith('updated-terms-and-conditions')
    if (acceptNewTerms) {
      // 02_AuthAcceptTerms
      res = timeGroup(groups[19].split('::')[1], () => http.get(env.authStagingURL + res.headers.Location), {
        isStatusCode200,
        ...pageContentCheck('We’ve updated our terms of use')
      })
    } else {
      // 03_AuthCall
      res = timeGroup(
        groups[20].split('::')[1],
        () => http.get(env.authStagingURL + res.headers.Location, { redirects: 0 }),
        {
          isStatusCode302
        }
      )

      if (route === 'ORCH') {
        // 04_OrchStub
        res = timeGroup(groups[21].split('::')[1], () => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck(passkeyUsers.email.toLowerCase())
        })
      } else if (route === 'RP') {
        // 04_OIDCCall
        res = timeGroup(groups[22].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
          isStatusCode302
        })
        //05_RPStub
        res = timeGroup(groups[23].split('::')[1], () => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck(passkeyUsers.email.toLowerCase())
        })
      }
    }

    if (acceptNewTerms) {
      // B03_PasskeyCreation_09_AcceptTermsConditions
      timeGroup(groups[24], () => {
        // 01_AuthCall
        res = timeGroup(
          groups[25].split('::')[1],
          () =>
            res.submitForm({
              fields: { termsAndConditionsResult: 'accept' },
              params: { redirects: 1 }
            }),
          { isStatusCode302 }
        )

        if (route === 'ORCH') {
          // 02_OrchStub
          res = timeGroup(groups[26].split('::')[1], () => http.get(res.headers.Location), {
            isStatusCode200,
            ...pageContentCheck(passkeyUsers.email.toLowerCase())
          })
        } else if (route === 'RP') {
          // 02_OIDCCall
          res = timeGroup(groups[27].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
            isStatusCode302
          })
          //03_RPStub
          res = timeGroup(groups[28].split('::')[1], () => http.get(res.headers.Location), {
            isStatusCode200,
            ...pageContentCheck(passkeyUsers.email.toLowerCase())
          })
        }
      })
    }
  })

  // B04_SignInWithPasskey_01_StubSubmit
  if (route === 'RP') {
    res = rpStubSubmit(groups)
  } else if (route === 'ORCH') {
    res = orchStubSubmit(groups)
  }

  sleep(1)

  // B04_SignInWithPasskey_02_ClickSignIn
  res = timeGroup(
    groups[29],
    () =>
      res.submitForm({
        submitSelector: '#sign-in-button'
      }),
    {
      isStatusCode200,
      ...pageContentCheck('Enter your email address to sign in to your GOV.UK One Login')
    }
  )

  sleep(1)

  // B04_SignInWithPasskey_03_EnterEmailAddress
  res = timeGroup(
    groups[30],
    () =>
      res.submitForm({
        fields: { email: passkeyUsers.email, browserSupportsWebAuthn: 'true' }
      }),
    { isStatusCode200, ...pageContentCheck('Use your passkey to sign in to GOV.UK One Login.') }
  )

  acceptNewTerms = false

  //B04_SignInWithPasskey_04_ClickContinuePasskey
  timeGroup(groups[31], () => {
    const csrfTokenSignIn = res.html('input[name="_csrf"]').attr('value') ?? 'CSRF Token not found'
    const matchDataAuthOptions = (res.body as string).match(/data-authentication-options="([^"]+)"/)
    if (!matchDataAuthOptions) throw new Error('data-authentication-options not found in response')
    // Step 1: decode \uXXXX sequences (e.g. \u0026 → &)
    const unicodeDecodedAuthOptions = JSON.parse(
      `"${matchDataAuthOptions[1].replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    ) as string
    // Step 2: decode HTML entities (&quot; → ", &amp; → &, etc.)
    const authenticationOptionsJSON = unicodeDecodedAuthOptions
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')

    const authenticationOptions = JSON.parse(authenticationOptionsJSON)
    const userHandleDecoded = encoding.b64decode(userHandle, 'rawurl', 's')
    const rawRegResponseSignIn = passkeys.createAssertionResponse(
      rpPasskeySignIn,
      credential,
      userHandleDecoded,
      JSON.stringify(authenticationOptions)
    )

    // Augment with fields expected by @simplewebauthn/server
    const augmentedResResponseSignIn = JSON.parse(rawRegResponseSignIn)
    augmentedResResponseSignIn.authenticatorAttachment = 'platform'
    augmentedResResponseSignIn.clientExtensionResults = {}
    const registrationResponseSignIn = JSON.stringify(augmentedResResponseSignIn)
    //01_AuthCall
    res = timeGroup(
      groups[32].split('::')[1],
      () =>
        http.post(
          env.authStagingURL + '/sign-in-passkey',
          {
            _csrf: csrfTokenSignIn,
            authenticationResponse: registrationResponseSignIn
          },
          {
            redirects: 0
          }
        ),
      { isStatusCode302 }
    )

    acceptNewTerms = res.headers.Location.endsWith('updated-terms-and-conditions')
    if (acceptNewTerms) {
      // 02_AuthAcceptTerms
      res = timeGroup(groups[33].split('::')[1], () => http.get(env.authStagingURL + res.headers.Location), {
        isStatusCode200,
        ...pageContentCheck('We’ve updated our terms of use')
      })
    } else {
      // 03_AuthCall
      res = timeGroup(
        groups[34].split('::')[1],
        () => http.get(env.authStagingURL + res.headers.Location, { redirects: 0 }),
        {
          isStatusCode302
        }
      )

      if (route === 'ORCH') {
        // 04_OrchStub
        res = timeGroup(groups[35].split('::')[1], () => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck(passkeyUsers.email.toLowerCase())
        })
      } else if (route === 'RP') {
        // 04_OIDCCall
        res = timeGroup(groups[36].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
          isStatusCode302
        })
        //05_RPStub
        res = timeGroup(groups[37].split('::')[1], () => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck(passkeyUsers.email.toLowerCase())
        })
      }
    }

    if (acceptNewTerms) {
      // B04_SignInWithPasskey_05_AcceptTermsConditions
      timeGroup(groups[38], () => {
        // 01_AuthCall
        res = timeGroup(
          groups[39].split('::')[1],
          () =>
            res.submitForm({
              fields: { termsAndConditionsResult: 'accept' },
              params: { redirects: 1 }
            }),
          { isStatusCode302 }
        )

        if (route === 'ORCH') {
          // 02_OrchStub
          res = timeGroup(groups[40].split('::')[1], () => http.get(res.headers.Location), {
            isStatusCode200,
            ...pageContentCheck(passkeyUsers.email.toLowerCase())
          })
        } else if (route === 'RP') {
          // 02_OIDCCall
          res = timeGroup(groups[41].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
            isStatusCode302
          })
          //03_RPStub
          res = timeGroup(groups[42].split('::')[1], () => http.get(res.headers.Location), {
            isStatusCode200,
            ...pageContentCheck(passkeyUsers.email.toLowerCase())
          })
        }
      })
    }
  })

  iterationsCompleted.add(1)
}

export function userCreationForPasskey(): void {
  let res: Response
  const groups = groupMap.signUp
  const timestamp = new Date().toISOString().slice(2, 19).replace(/[-:T]/g, '') // YYMMDDTHHmmss
  const iteration = execution.scenario.iterationInInstance.toString().padStart(6, '0')
  const testEmail = `perftestPasskeys${timestamp}${iteration}@digital.cabinet-office.gov.uk`
  const phoneNumber = '07700900000'
  const mfaOption: mfaType = 'SMS'
  iterationsStarted.add(1)

  // B01_SignUp_01_StubSubmit
  if (route === 'RP') {
    res = rpStubSubmit(groups)
  } else if (route === 'ORCH') {
    res = orchStubSubmit(groups)
  }

  sleep(1)

  // B01_SignUp_02_CreateOneLogin
  res = timeGroup(
    groups[7],
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
  res = timeGroup(groups[8], () => res.submitForm({ fields: { email: testEmail } }), {
    isStatusCode200,
    ...pageContentCheck('Check your email')
  })

  sleep(1)

  // B01_SignUp_04_EnterOTP
  res = timeGroup(
    groups[9],
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
    groups[10],
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

  // B01_SignUp_08_MFA_SMS
  res = timeGroup(
    groups[13],
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
    groups[14],
    () =>
      res.submitForm({
        fields: { phoneNumber }
      }),
    { isStatusCode200, ...pageContentCheck('Check your phone') }
  )

  sleep(1)

  // B01_SignUp_10_MFA_EnterSMSOTP
  res = timeGroup(
    groups[15],
    () =>
      res.submitForm({
        fields: { code: credentials.phoneOTP }
      }),
    {
      isStatusCode200,
      ...pageContentCheck('You’ve created your GOV.UK One Login')
    }
  )
  console.log(testEmail)
  /*
  sleep(1)

  // B01_SignUp_11_ContinueAccountCreated
  timeGroup(groups[16], () => {
    // 01_AuthCall (common for ORCH and RP route)
    res = timeGroup(groups[17].split('::')[1], () => res.submitForm({ params: { redirects: 1 } }), {
      isStatusCode302
    })
    if (route === 'ORCH') {
      // 02_OrchStub
      res = timeGroup(groups[18].split('::')[1], () => http.get(res.headers.Location), {
        isStatusCode200,
        ...pageContentCheck(testEmail.toLowerCase())
      })
    } else if (route === 'RP') {
      // 02_OIDCCall
      res = timeGroup(groups[19].split('::')[1], () => http.get(res.headers.Location, { redirects: 0 }), {
        isStatusCode302
      })
      //03_RPStub
      res = timeGroup(groups[20].split('::')[1], () => http.get(res.headers.Location), {
        isStatusCode200,
        ...pageContentCheck(testEmail.toLowerCase())
      })
    }
  })*/
  iterationsCompleted.add(1)
}
