import { check, group } from 'k6'
import http, { type CookieJar, type Response } from 'k6/http'
import { URL } from './url'

const env = {
  testClientExecuteUrl: __ENV.MOBILE_TEST_CLIENT_EXECUTE_URL,
  backEndUrl: __ENV.MOBILE_BACK_END_URL,
  frontEndUrl: __ENV.MOBILE_FRONT_END_URL,
  biometricSessionId: __ENV.MOBILE_BIOMETRIC_SESSION_ID
}

export enum SmartphoneType {
  Iphone = 'iphone',
  Android = 'android',
}

export enum DeviceType {
  Smartphone = 'smartphone',
  ComputerOrTablet = 'computerOrTablet',
}

export enum YesOrNo {
  YES = 'yes',
  NO = 'no',
}

export enum IphoneType {
  Iphone7OrNewer = 'iphone7OrNewer',
}

const OAUTH_ROUTE = '/dca/oauth2'

function isStatusCode200 (res: Response): boolean {
  return check(res, {
    'is status 200': (r) => r.status === 200
  })
}

function isStatusCode201 (res: Response): boolean {
  return check(res, {
    'is status 201': (r) => r.status === 201
  })
}

function isStatusCode302 (res: Response): boolean {
  return check(res, {
    'is status 302': (r) => r.status === 302
  })
}

function isPageContentCorrect (res: Response, pageContent: string): boolean {
  return check(res, {
    'verify page content': (r) => (r.body as string).includes(pageContent)
  })
}

function isPageRedirectCorrect (res: Response, pageUrl: string): boolean {
  return check(res, {
    'verify url redirect': (r) => r.url.includes(pageUrl)
  })
}

function isHeaderLocationCorrect (res: Response, content: string): boolean {
  return check(res, {
    'verify url redirect': (r) => {
      return r.headers.Location.includes(content)
    }
  })
}

// Call to /start journey
function postToVerifyURL (): Response {
  return http.post(
    getUrl('start', env.testClientExecuteUrl),
    JSON.stringify({ target: env.backEndUrl, frontendUri: env.frontEndUrl }),
    {
      tags: { name: 'Post request to Verify URL' },
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

// Returning only the WebLocation with /authorize url
function parseVerifyUrl (response: Response): string {
  const responseBody = response.body?.toString()
  const verifyUrl =
    typeof responseBody === 'string'
      ? JSON.parse(responseBody).WebLocation
      : null

  if (verifyUrl === null) {
    throw new Error('Failed to parse verify URL from response')
  }

  return verifyUrl
}

export function setSessionCookie (jar: CookieJar, sessionId: string): void {
  jar.set(getFrontendUrl('/'), 'sessionId', sessionId)
}

// session id captured from first request to /authorize
export function getSessionId (): string {
  const res = postToVerifyURL()
  isStatusCode201(res)

  const verifyUrl = parseVerifyUrl(res)
  const verifyRes = http.get(verifyUrl, { redirects: 0 })
  const sessionId = verifyRes.cookies.sessionId.find(
    (s) => s.value.length > 0
  )?.value

  if (sessionId == null) {
    throw new Error('Cannot find sessionId cookie')
  }
  return sessionId
}

function getUrl (
  path: string,
  base: string,
  query?: Record<string, string>
): string {
  const url = new URL(path, base)

  if (query != null) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return url.toString()
}

function getFrontendUrl (path: string, query?: Record<string, string>): string {
  return getUrl(OAUTH_ROUTE + path, env.frontEndUrl, query)
}

function getBackendUrl (path: string, query?: Record<string, string>): string {
  return getUrl(path, env.backEndUrl, query)
}

export function startDcmawJourney (): void {
  group('Start DCMAW Journey', () => {
    const res = http.get(getFrontendUrl('/selectDevice'), {
      tags: { name: 'Start DCMAW Journey' }
    })
    isStatusCode200(res)
    isPageContentCorrect(res, 'Are you on a computer or a tablet right now?')
    isPageRedirectCorrect(res, '/selectDevice')
  })
}

export function checkSelectDeviceRedirect (device: DeviceType): void {
  group(`Select device: ${device} from /selectdevice page`, () => {
    const res = http.post(
      getFrontendUrl('/selectDevice'),
      { 'select-device-choice': device },
      { tags: { name: 'Select Device Page' } }
    )
    isStatusCode200(res)
    isPageRedirectCorrect(res, '/selectSmartphone')

    switch (device) {
      case DeviceType.ComputerOrTablet:
        isPageContentCorrect(res, 'Do you have a smartphone you can use?')
        break
      case DeviceType.Smartphone:
        isPageContentCorrect(res, 'Which smartphone are you using?')
        break
    }
  })
}

export function checkSelectSmartphoneRedirect (
  smartphone: SmartphoneType
): void {
  group(`Select smartphone: ${smartphone} from /selectSmartphone page`, () => {
    const res = http.post(
      getFrontendUrl('/selectSmartphone'),
      { 'smartphone-choice': smartphone },
      { tags: { name: 'Select Smartphone Page' } }
    )
    isStatusCode200(res)
    isPageContentCorrect(res, 'Do you have a valid passport?')
    isPageRedirectCorrect(res, '/validPassport')
  })
}

export function checkValidPassportPageRedirect (validPassport: YesOrNo): void {
  group(
    `Select valid passport: ${validPassport} from /validPassport page`,
    () => {
      const res = http.post(
        getFrontendUrl('/validPassport'),
        { 'select-option': validPassport },
        { tags: { name: 'Select Valid Passport Page' } }
      )
      isStatusCode200(res)

      switch (validPassport) {
        case YesOrNo.YES:
          isPageContentCorrect(
            res,
            'Does your passport have this symbol on the cover?'
          )
          isPageRedirectCorrect(res, '/biometricChip')
          break
        case YesOrNo.NO:
          isPageContentCorrect(
            res,
            'Do you have a valid UK biometric residence permit (BRP)?'
          )
          isPageRedirectCorrect(res, '/validBrp')
      }
    }
  )
}

export function checkValidBrpRedirect (validBrp: YesOrNo): void {
  group(
    `Select valid brp: ${validBrp} from /validBrp page`,
    () => {
      const res = http.post(
        getFrontendUrl('/validBrp'),
        { 'select-option': validBrp },
        { tags: { name: 'Select Valid Brp Page' } }
      )
      isStatusCode200(res)

      switch (validBrp) {
        case YesOrNo.YES:
          isPageContentCorrect(
            res,
            'Use your UK BRP and a GOV.UK app to confirm your identity'
          )
          isPageRedirectCorrect(res, '/idCheckApp')
          break
        case YesOrNo.NO:
          isPageContentCorrect(
            res,
            'Do you have a valid UK photocard driving licence?'
          )
          isPageRedirectCorrect(res, '/validDrivingLicence')
      }
    }
  )
}

export function checkValidDrivingLicenseRedirect (
  validDrivingLicense: YesOrNo
): void {
  group(
    `Select valid driving license: ${validDrivingLicense} from /validDrivingLicence page`,
    () => {
      const res = http.post(
        getFrontendUrl('/validDrivingLicence'),
        { 'driving-licence-choice': validDrivingLicense },
        { tags: { name: 'Select Valid Driving License Page' } }
      )
      isStatusCode200(res)
      isPageContentCorrect(
        res,
        'Use your UK driving licence and a GOV.UK app to confirm your identity'
      )
    }
  )
}

export function checkBiometricChipRedirect (
  validChip: YesOrNo,
  smartphone: SmartphoneType
): void {
  group(
    `Select valid biometric chip: ${validChip} from /biometricChip page`,
    () => {
      const res = http.post(
        getFrontendUrl('/biometricChip'),
        { 'select-option': validChip },
        { tags: { name: 'Select Valid Chip Page' } }
      )
      isStatusCode200(res)

      switch (validChip) {
        case YesOrNo.YES:
          if (smartphone === SmartphoneType.Iphone) {
            isPageContentCorrect(res, 'Which iPhone model do you have?')
            isPageRedirectCorrect(res, '/iphoneModel')
          } else if (smartphone === SmartphoneType.Android) {
            isPageContentCorrect(
              res,
              'Use your passport and a GOV.UK app to confirm your identity'
            )
            isPageRedirectCorrect(res, '/idCheckApp')
          }
          break
        case YesOrNo.NO:
          isPageContentCorrect(
            res,
            'Do you have a valid UK photocard driving licence?'
          )
          isPageRedirectCorrect(res, '/validDrivingLicence')
          break
      }
    }
  )
}

export function checkIphoneModelRedirect (iphoneModel: IphoneType): void {
  group(`Select iphone model: ${iphoneModel} from /iphoneModel page`, () => {
    const res = http.post(
      getFrontendUrl('/iphoneModel'),
      { 'select-option': iphoneModel },
      { tags: { name: 'Select Iphone Model Page' } }
    )
    isStatusCode200(res)
    isPageContentCorrect(
      res,
      'Use your passport and a GOV.UK app to confirm your identity'
    )
    isPageRedirectCorrect(res, '/idCheckApp')
  })
}

export function checkWorkingCameraRedirect (workingCameraAnswer: YesOrNo): void {
  group(
    `Select working camera: ${workingCameraAnswer} from /workingCamera page`,
    () => {
      const res = http.post(
        getFrontendUrl('/workingCamera'),
        { 'working-camera-choice': workingCameraAnswer },
        { tags: { name: 'Select Working Camera' } }
      )
      isStatusCode200(res)
      isPageContentCorrect(
        res,
        'The app uses flashing colours. Do you want to continue?'
      )
      isPageRedirectCorrect(res, '/flashingWarning')
    }
  )
}

export function updateCookiesFromIdCheckAppPage (): void {
  group('Get idCheckApp from /idCheckApp page', () => {
    const res = http.post(getFrontendUrl('/idCheckApp'))
    isStatusCode200(res)
  })
}

export function checkFlashingWarningRedirect (
  warningAnswer: YesOrNo,
  device: DeviceType
): void {
  group(
    `Select flashing warning: ${warningAnswer} from /flashingWarning page`,
    () => {
      const res = http.post(
        getFrontendUrl('/flashingWarning'),
        { 'flashing-colours-choice': warningAnswer },
        { tags: { name: 'Select Flashing Warning Page' } }
      )

      isStatusCode200(res)
      switch (device) {
        case DeviceType.Smartphone:
          isPageContentCorrect(res, 'Download the GOV.UK ID Check app')
          isPageRedirectCorrect(res, '/downloadApp')
          break
        case DeviceType.ComputerOrTablet:
          isPageContentCorrect(
            res,
            'Scan the QR code to continue confirming your identity on your phone'
          )
          isPageRedirectCorrect(res, '/downloadApp')
          break
      }
    }
  )
}

export function getBiometricToken (sessionId: string): void {
  group('Get Biometric Token BE Request', () => {
    const biometricTokenUrl = getBackendUrl('/biometricToken', {
      authSessionId: sessionId
    })
    const res = http.get(biometricTokenUrl, {
      tags: { name: 'Get Biometric Token' }
    })

    isStatusCode200(res)
  })
}

export function postFinishBiometricToken (sessionId: string): void {
  group('Post Finish Biometric Token BE Request', () => {
    const finishBiometricSessionUrl = getBackendUrl('/finishBiometricSession', {
      authSessionId: sessionId,
      biometricSessionId: env.biometricSessionId
    })
    const res = http.post(finishBiometricSessionUrl)

    isStatusCode200(res)
  })
}

export function checkRedirectPage (sessionId: string): void {
  group('Check Redirect Final Page /redirect', () => {
    const redirectUrl = getFrontendUrl('/redirect', { sessionId })
    const res = http.get(redirectUrl, {
      redirects: 0,
      tags: { name: 'Redirect Final Page' }
    })
    isStatusCode302(res)
    isHeaderLocationCorrect(res, '/redirect')
  })
}
