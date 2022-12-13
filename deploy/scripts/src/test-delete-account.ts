import { sleep, group, check, fail } from "k6";
import { Options } from "k6/options";
import http, { Response } from "k6/http";
import { SharedArray } from "k6/data";
import exec from "k6/execution";
import { Trend } from "k6/metrics";
import { selectProfile, ProfileList, describeProfile} from "./utils/config/load-profiles";

const profiles: ProfileList = {
  smoke: {
    deleteAccount: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1m",
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: "2m" }, //Ramps up to target load
        //  { target: 1, duration: '60s' },    //Holds at target load
      ],
      exec: "deleteAccount",
    },
  },
  load: {
    deleteAccount: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1m",
      preAllocatedVUs: 1,
      maxVUs: 50,
      stages: [
        { target: 60, duration: "120s" }, //Ramps up to target load
        { target: 60, duration: "120s" }, //Holds at target load
      ],
      exec: "deleteAccount",
    },
  },
};

let loadProfile = selectProfile(profiles);

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    //http_req_duration: ['p(95)<1000'], // 95th percntile response time <1000ms
    "http_req_duration{reqName:01_LaunchStagingAccountsHome}": ["p(95)<1000"],
    "http_req_duration{reqName:02_ClickSignIn}": ["p(95)<1000"],
    "http_req_duration{reqName:03_EnterEmailID}": ["p(95)<1000"],
    "http_req_duration{reqName:04_EnterSignInPassword}": ["p(95)<1000"],
    "http_req_duration{reqName:05_EnterSMSOTP}": ["p(95)<1000"],
    "http_req_duration{reqName:06_ClickChangePhoneNumber}": ["p(95)<1000"],
    "http_req_duration{reqName:07_EnterCurrentPassword}": ["p(95)<1000"],
    "http_req_duration{reqName:08_EnterNewPhoneNumber}": ["p(95)<1000"],
    "http_req_duration{reqName:09_EnteNewPhoneOTP}": ["p(95)<1000"],
    "http_req_duration{reqName:10_ClickBackToMyAccounts}": ["p(95)<1000"],
    "http_req_duration{reqName:11_SignOut}": ["p(95)<1000"],
    http_req_failed: ["rate<0.05"], // Error rate <5%
  },
};

export function setup() {
  describeProfile(loadProfile);
}

const env = {
  /*FE_URL: __ENV.CFN_HelloWorldApi,      //Output from demo_sap_app
      BE_URL: __ENV.CFN_ApiGatewayEndpoint, //Output from demo_node_app*/
  launchURL: `https://${__ENV.stagingLaunch}`, //home.staging.account.gov.uk
  baseUrl: `https://${__ENV.stagingBase}`,
};

const transactionDuration = new Trend("Transaction Duration");

type User = { currEmail: string; currPassword: string; currEmailOTP: string };
const csvData: User[] = new SharedArray("csv", function () {
  return open("./data/deleteAccount_TestData.csv").split("\n").slice(1).map((s) => {
      let data = s.split(",");
      return {
        currEmail: data[0],
        currPassword: data[1],
        currEmailOTP: data[2],
      };
    });
});

export function deleteAccount() {
  let res: Response;
  let csrfToken: string;
  let phoneNumHidden: string;

  const user = csvData[exec.scenario.iterationInTest % csvData.length]; //Pick a unique user from a csv

  group(`01 - GET Launch Accounts Entry Point`, function () {
    res = http.get(env.launchURL, {
      tags: { reqName: "01_LaunchStagingAccountsHome" },
    });

    check(res, {
      "is status 200": (r) => r.status === 200,
      "verify page content": (r) =>
        (r.body as String).includes("Create a GOV.UK account or sign in"),
    })
      ? transactionDuration.add(res.timings.duration)
      : fail("Response Validation Failed");
  });

  sleep(Math.random() * 3);

  group(`02- GET Click Sign In`, function () {
    res = http.get(env.baseUrl + "/sign-in-or-create?redirectPost=true", {
      tags: { reqName: "02_ClickSignIn" },
    });

    check(res, {
      "is status 200": (r) => r.status === 200,
      "verify page content": (r) =>
        (r.body as String).includes(
          "Enter your email address to sign in to your GOV.UK account"
        ),
    })
      ? transactionDuration.add(res.timings.duration)
      : fail("Response Validation Failed");

    csrfToken = getCSRF(res);
  });

  sleep(Math.random() * 3);

  group(`03 - POST Enter Email ID`, () => {
    res = http.post(
      env.baseUrl + "/enter-email",
      {
        _csrf: csrfToken,
        email: user.currEmail,
      },
      {
        tags: { reqName: "03_EnterEmailID" },
      }
    );

    check(res, {
      "is status 200": (r) => r.status === 200,
      "verify page content": (r) =>
        (r.body as String).includes("Enter your password"),
    })
      ? transactionDuration.add(res.timings.duration)
      : fail("Response Validation Failed");

    csrfToken = getCSRF(res);
  });

  sleep(Math.random() * 3);

  group(`04 - POST Enter Sign in Password`, () => {
    res = http.post(
      env.baseUrl + "/enter-password",
      {
        _csrf: csrfToken,
        password: user.currPassword,
      },
      {
        tags: { reqName: "04_EnterSignInPassword" },
      }
    );

    check(res, {
      "is status 200": (r) => r.status === 200,
      "verify page content": (r) =>
        (r.body as String).includes(
          "We sent a code to the phone number linked to your account"
        ),
    })
      ? transactionDuration.add(res.timings.duration)
      : fail("Response Validation Failed");

    csrfToken = getCSRF(res);
    phoneNumHidden = getPhone(res);
  });

  sleep(Math.random() * 3);

  group(`05 - POST Enter SMS OTP`, () => {
    res = http.post(
      env.launchURL + "/check-your-phone",
      {
        _csrf: csrfToken,
        phoneNumber: phoneNumHidden,
        code: user.currEmailOTP,
      },
      {
        tags: { reqName: "05_EnterSMSOTP" },
      }
    );

    check(res, {
      "is status 200": (r) => r.status === 200,
      "verify page content": (r) =>
        (r.body as String).includes("You have changed your phone number"),
    })
      ? transactionDuration.add(res.timings.duration)
      : fail("Response Validation Failed");

    csrfToken = getCSRF(res);
  });

  /*   group(`05 - POST Enter Auth OTP Sign In`, () => {
        res = http.post(env.baseUrl + '/enter-authenticator-app-code',
            {
                _csrf: csrfToken,
                code: totp.generateTOTP(),
            },
            {
                tags: {reqName: "05_EnterAuthAppOTP"}
            }
        );

        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Delete your GOV.UK account'),
        })
        ? transactionDuration.add(res.timings.duration) : fail("Respone Validation Failed");
    });
*/

  sleep(Math.random() * 3);

  group(`06 - GET Click Delete Account Link`, function () {
    res = http.get(env.launchURL + "/enter-password?type=deleteAccount", {
      tags: { reqName: "06_ClickDeleteAccountLink" },
    });

    check(res, {
      "is status 200": (r) => r.status === 200,
      "verify page content": (r) =>
        (r.body as String).includes(`Enter your password`),
    })
      ? transactionDuration.add(res.timings.duration)
      : fail("Response Validation Failed");

    csrfToken = getCSRF(res);
  });

  sleep(Math.random() * 3);

  group(`07 - POST Enter Password to confirm account deletion`, () => {
    res = http.post(
      env.launchURL + "/enter-password",
      {
        _csrf: csrfToken,
        requestType: "deleteAccount",
        password: user.currPassword,
      },
      {
        tags: { reqName: "07_EnterCurrentPassword" },
      }
    );

    check(res, {
      "is status 200": (r) => r.status === 200,
      "verify page content": (r) =>
        (r.body as String).includes(
          "Are you sure you want to delete your GOV.UK account"
        ),
    })
      ? transactionDuration.add(res.timings.duration)
      : fail("Response Validation Failed");

    csrfToken = getCSRF(res);
  });

  sleep(Math.random() * 3);

  group(`08 - POST Click Delete your account button`, () => {
    res = http.post(
      env.launchURL + "/delete-account",
      {
        _csrf: csrfToken,
      },
      {
        tags: { reqName: "08_DeleteAccountConfirm" },
      }
    );

    check(res, {
      "is status 200": (r) => r.status === 200,
      "verify page content": (r) =>
        (r.body as String).includes("You have deleted your GOV.UK account"),
    })
      ? transactionDuration.add(res.timings.duration)
      : fail("Response Validation Failed");
  });
}

function getCSRF(r: Response): string {
  return r.html().find("input[name='_csrf']").val() || "";
}

function getPhone(r: Response): string {
  return r.html().find("input[name='phoneNumber']").val() || "";
}
