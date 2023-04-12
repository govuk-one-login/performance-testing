import { check } from "k6";
import http, { type Response } from "k6/http";


interface Cookies {
  sessionId?: string;
  device?: string;
  nfc?: "true" | "false";
  autoHandback?: "true" | "false";
  smartphone?: "iphone" | "android";
}

const env = {
  testClientExecuteUrl: __ENV.TEST_CLIENT_EXECUTE_URL,
  backEndUrl: __ENV.BACK_END_URL,
  frontEndUrl: __ENV.FRONT_END_URL,
  biometricSessionId: __ENV.BIOMETRIC_SESSION_ID
}

export enum SmartphoneType {
  Iphone = "iphone",
  Android = "android",
}

export enum DeviceType {
  Other = "other",
  ComputerOrTablet = "computerOrTablet",
}

export enum YesOrNo {
  YES = "yes",
  NO = "no",
}

export enum IphoneType {
  Iphone7OrNewer = "iphone7OrNewer",
}

const OAUTH_ROUTE = "/dca/oauth2/";
let redirectLocation: string;
let cookies: Cookies;
let res: Response | string;

function isStatusCode200(res: Response): boolean {
  return check(res, {
    "is status 200": (r) => r.status === 200,
  });
}

function isStatusCode201(res: Response): boolean {
  return check(res, {
    "is status 201": (r) => r.status === 201,
  });
}

function isStatusCode302(res: Response): boolean {
  return check(res, {
    "is status 302": (r) => r.status === 302,
  });
}

function isPageContentCorrect(res: Response, pageContent: string): boolean {
  return check(res, {
    "verify page content": (r) => (r.body as string).includes(pageContent),
  });
}

function isPageRedirectCorrect(res: Response, pageUrl: string): boolean {
  return check(res, {
    "verify url redirect": (r) => r.url.includes(pageUrl),
  });
}

function isHeaderLocationCorrect(res: Response, content: string): boolean {
  return check(res, {
    "verify url redirect": (r) => r.headers.Location.includes(content),
  });
}

export function getRedirectAndSessionId() {
  res = http.post(
    `${env.testClientExecuteUrl}start`,
    JSON.stringify({ target: env.backEndUrl, frontendUri: env.frontEndUrl }),
    { headers: { "Content-Type": "application/json" } }
  );
  const responseBody = res.body ? res.body.toString() : null;
  const verifyUrl = responseBody ? JSON.parse(responseBody).WebLocation : null;
  console.log(verifyUrl);

  isStatusCode201(res);

  // First redirect when calling /authorize
  res = http.get(verifyUrl, { redirects: 0 });
  cookies = { sessionId: res.cookies.sessionId[0].value };
  redirectLocation = res.headers.Location;
}

export function startDcmawJourney() {
  res = http.get(env.frontEndUrl + redirectLocation, {
    cookies: { ...cookies },
  });
  isStatusCode200(res);
  isPageContentCorrect(res, "Are you on a computer or a tablet right now?");
  isPageRedirectCorrect(res, "/selectDevice");
}

export function checkSelectDeviceRedirect(device: DeviceType) {
  cookies.device = device;
  res = http.post(
    env.frontEndUrl + OAUTH_ROUTE + "selectDevice",
    {
      "select-device-choice": device,
    },
    { cookies: { ...cookies } }
  );

  isStatusCode200(res);
  isPageRedirectCorrect(res, "/selectSmartphone");

  switch (device) {
    case DeviceType.ComputerOrTablet:
      isPageContentCorrect(res, "Do you have a smartphone you can use?");
      break;
    case DeviceType.Other:
      isPageContentCorrect(res, "Are you on a smartphone right now?");
      break;
  }
}

export function checkSelectSmartphoneRedirect(smartphone: SmartphoneType) {
  cookies.nfc = "false";
  cookies.smartphone = smartphone;
  res = http.post(
    env.frontEndUrl + OAUTH_ROUTE + "selectSmartphone",
    {
      "smartphone-choice": smartphone,
    },
    { cookies: { ...cookies } }
  );
  isStatusCode200(res);
  isPageContentCorrect(res, "Do you have a valid passport?");
  isPageRedirectCorrect(res, "/validPassport");
}

export function checkValidPassportPageRedirect(validPassport: YesOrNo): void {
  res = http.post(
    env.frontEndUrl + OAUTH_ROUTE + "validPassport",
    {
      "select-option": validPassport,
    },
    { cookies: { ...cookies } }
  );
  isStatusCode200(res);

  switch (validPassport) {
    case YesOrNo.YES:
      isPageContentCorrect(
        res,
        "Does your passport have this symbol on the cover?"
      );
      isPageRedirectCorrect(res, "/biometricChip");
      break;
    case YesOrNo.NO:
      isPageContentCorrect(
        res,
        "Do you have a valid UK photocard driving licence?"
      );
      isPageRedirectCorrect(res, "/validDrivingLicence");
      break;
  }
}

export function checkValidDrivingLicenseRedirect(validDrivingLicense: YesOrNo) {
  res = http.post(
    env.frontEndUrl + OAUTH_ROUTE + "validDrivingLicence",
    {
      "driving-licence-choice": validDrivingLicense,
    },
    { cookies: { ...cookies } }
  );

  isStatusCode200(res);
  isPageContentCorrect(
    res,
    "Use your UK driving licence and a GOV.UK app to confirm your identity"
  );
  isPageRedirectCorrect(res, "/idCheckApp");
}

export function checkBiometricChipRedirect(
  validChip: YesOrNo,
  smartphone: SmartphoneType
) {
  res = http.post(
    env.frontEndUrl + OAUTH_ROUTE + "biometricChip",
    {
      "select-option": validChip, // valid biometric chip
    },
    { cookies: { ...cookies } }
  );

  isStatusCode200(res);

  switch (validChip) {
    case YesOrNo.YES:
      if (smartphone == SmartphoneType.Iphone) {
        isPageContentCorrect(res, "Which iPhone model do you have?");
        isPageRedirectCorrect(res, "/iphoneModel");
      } else if (smartphone == SmartphoneType.Android) {
        isPageContentCorrect(
          res,
          "Use your passport and a GOV.UK app to confirm your identity"
        );
        isPageRedirectCorrect(res, "/idCheckApp");
      }
      break;
    case YesOrNo.NO:
      isPageContentCorrect(
        res,
        "Do you have a valid UK photocard driving licence?"
      );
      isPageRedirectCorrect(res, "/validDrivingLicence");
      break;
  }
  cookies.nfc = "true";
}

export function checkIphoneModelRedirect(iphoneModel: IphoneType) {
  res = http.post(
    env.frontEndUrl + OAUTH_ROUTE + "iphoneModel",
    {
      "select-option": iphoneModel,
    },
    { cookies: { ...cookies } }
  );

  isStatusCode200(res);
  isPageContentCorrect(
    res,
    "Use your passport and a GOV.UK app to confirm your identity"
  );
  isPageRedirectCorrect(res, "/idCheckApp");
}

export function checkWorkingCameraRedirect(workingCameraAnswer: YesOrNo) {
  res = http.post(
    env.frontEndUrl + OAUTH_ROUTE + "workingCamera",
    {
      "working-camera-choice": workingCameraAnswer,
    },
    { cookies: { ...cookies } }
  );

  isStatusCode200(res);
  isPageContentCorrect(
    res,
    "The app uses flashing colours. Do you want to continue?"
  );
  isPageRedirectCorrect(res, "/flashingWarning");
}

export function checkFlashingWarningRedirect(
  warningAnswer: YesOrNo,
  device: DeviceType
) {
  res = http.post(
    env.frontEndUrl + OAUTH_ROUTE + "flashingWarning",
    {
      "flashing-colours-choice": warningAnswer,
    },
    { cookies: { ...cookies } }
  );

  isStatusCode200(res);

  switch (device) {
    case DeviceType.Other:
      isPageContentCorrect(res, "Download the GOV.UK ID Check app");
      isPageRedirectCorrect(res, "/downloadApp");
      break;
    case DeviceType.ComputerOrTablet:
      isPageContentCorrect(
        res,
        "Scan the QR code to continue confirming your identity on your phone"
      );
      isPageRedirectCorrect(res, "/downloadApp");
      break;
  }
}

export function getBiometricToken() {
  res = http.get(
    env.backEndUrl + "/biometricToken?authSessionId=" + cookies.sessionId
  );

  isStatusCode200(res);
}

export function postFinishBiometricToken() {
  res = http.post(
    env.backEndUrl +
      "/finishBiometricSession?authSessionId=" +
      cookies.sessionId +
      "&biometricSessionId=" +
      env.biometricSessionId
  );

  isStatusCode200(res);
}

export function checkRedirectPage() {
  res = http.get(
    env.frontEndUrl + OAUTH_ROUTE + "redirect?sessionId=" + cookies.sessionId,
    { cookies: { ...cookies }, redirects: 0 }
  );

  isStatusCode302(res);
  isHeaderLocationCorrect(res, "/redirect");
}
