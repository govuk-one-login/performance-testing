import { sleep, group, check, fail } from "k6";
import { Options } from "k6/options";
import http, { Response } from "k6/http";
import { SharedArray } from "k6/data";
import exec from "k6/execution";
import { Trend } from "k6/metrics";
import {selectProfile, ProfileList, describeProfile} from "./utils/config/load-profiles";

const profiles: ProfileList = {
  smoke: {
    changeEmail: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1m",
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: "2m" }, //Ramps up to target load
        //  { target: 1, duration: '60s' },    //Holds at target load
      ],
      exec: "changeEmail",
    },
  },
  load: {
    changeEmail: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1m",
      preAllocatedVUs: 1,
      maxVUs: 50,
      stages: [
        { target: 60, duration: "120s" }, //Ramps up to target load
        { target: 60, duration: "120s" }, //Holds at target load
      ],
      exec: "changeEmail",
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
    "http_req_duration{reqName:04_EnterLoginPassword}": ["p(95)<1000"],
    "http_req_duration{reqName:05_EnterSMSOTP}": ["p(95)<1000"],
    "http_req_duration{reqName:06_ClickChangeEmailLink}": ["p(95)<1000"],
    "http_req_duration{reqName:07_EnterCurrentPassword}": ["p(95)<1000"],
    "http_req_duration{reqName:08_EnterNewEmailID}": ["p(95)<1000"],
    "http_req_duration{reqName:09_EnterEmailOTP}": ["p(95)<1000"],
    "http_req_duration{reqName:10_ClickBackToMyAccount}": ["p(95)<1000"],
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

type User = {
  currEmail: string;
  currPassword: string;
  currEmailOTP: string;
  newEmail: string;
  newEmailOTP: string;
};

const csvData: User[] = new SharedArray("csv", function () {
  return open("./data/changeEmail_TestData.csv").split("\n").slice(1).map((s) => {
      let data = s.split(",");
      return {
        currEmail: data[0],
        currPassword: data[1],
        currEmailOTP: data[2],
        newEmail: data[3],
        newEmailOTP: data[4],
      };
    });
});

export function changeEmail() {
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

  group(`02 - GET Click Sign In`, function () {
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
        tags: { reqName: "04_EnterLoginPassword" },
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

  sleep(2);

  group(`05 - POST Enter SMS OTP Sign In`, () => {
    res = http.post(
      env.baseUrl + "/enter-code",
      {
        phoneNumber: phoneNumHidden,
        _csrf: csrfToken,
        code: user.currEmailOTP,
      },
      {
        tags: { reqName: "05_EnterSMSOTP" },
      }
    );

    check(res, {
      "is status 200": (r) => r.status === 200,
      "verify page content": (r) =>
        (r.body as String).includes("Delete your GOV.UK account"),
    })
      ? transactionDuration.add(res.timings.duration)
      : fail("Response Validation Failed");
  });

  /*
      group(`05 - POST Enter Auth OTP Sign In`, () => {
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

  function changeEmailSteps(loopCount: number) {
    for (let i = 1; i <= loopCount; i++) {
      console.log(
        `Start of function - Value of old email ID is ${user.currEmail} and OTP is ${user.currEmailOTP}`
      );

      console.log(
        `Start of function - Value of new email ID is ${user.newEmail} and OTP is ${user.newEmailOTP}`
      );

      group(`06 - GET Click Change Email Link`, function () {
        res = http.get(env.launchURL + "/enter-password?type=changeEmail", {
          tags: { reqName: "06_ClickChangeEmailLink" },
        });

        check(res, {
          "is status 200": (r) => r.status === 200,
          "verify page content": (r) =>
            (r.body as String).includes("Enter your current password"),
        })
          ? transactionDuration.add(res.timings.duration)
          : fail("Response Validation Failed");

        csrfToken = getCSRF(res);
      });

      sleep(Math.random() * 3);

      group(`07 - POST Enter Current Password`, () => {
        res = http.post(
          env.launchURL + "/enter-password",
          {
            _csrf: csrfToken,
            requestType: "changeEmail",
            password: user.currPassword,
          },
          {
            tags: { reqName: "07_EnterCurrentPassword" },
          }
        );

        check(res, {
          "is status 200": (r) => r.status === 200,
          "verify page content": (r) =>
            (r.body as String).includes("Enter your new email address"),
        })
          ? transactionDuration.add(res.timings.duration)
          : fail("Response Validation Failed");

        csrfToken = getCSRF(res);
      });

      sleep(Math.random() * 3);

      group(`08 - POST Enter new email ID`, () => {
        res = http.post(
          env.launchURL + "/change-email",
          {
            _csrf: csrfToken,
            email: user.newEmail,
          },
          {
            tags: { reqName: "08_EnterNewEmailID" },
          }
        );

        check(res, {
          "is status 200": (r) => r.status === 200,
          "verify page content": (r) =>
            (r.body as String).includes("We have sent an email to"),
        })
          ? transactionDuration.add(res.timings.duration)
          : fail("Response Validation Failed");

        csrfToken = getCSRF(res);
      });

      sleep(Math.random() * 3);

      group(`09 - POST Enter email OTP`, () => {
        res = http.post(
          env.launchURL + "/check-your-email",
          {
            _csrf: csrfToken,
            email: user.newEmail,
            code: user.newEmailOTP,
          },
          {
            tags: { reqName: "09_EnterEmailOTP" },
          }
        );

        check(res, {
          "is status 200": (r) => r.status === 200,
          "verify page content": (r) =>
            (r.body as String).includes("You have changed your email address"),
        })
          ? transactionDuration.add(res.timings.duration)
          : fail("Response Validation Failed");

        csrfToken = getCSRF(res);
      });

      sleep(Math.random() * 3);

      group(`10 - GET Click Back to my account`, function () {
        res = http.get(env.launchURL + "/manage-your-account", {
          tags: { reqName: "10_ClickBackToMyAccount" },
        });

        check(res, {
          "is status 200": (r) => r.status === 200,
          "verify page content": (r) =>
            (r.body as String).includes("Delete your GOV.UK account"),
        })
          ? transactionDuration.add(res.timings.duration)
          : fail("Response Validation Failed");
      });

      sleep(Math.random() * 3);

      //Swap the value of passwords by destructuring assignment

      [user.currEmail, user.newEmail] = [user.newEmail, user.currEmail];
      [user.currEmailOTP, user.newEmailOTP] = [user.newEmailOTP, user.currEmailOTP];

      console.log(`End of function - Value of old email ID is ${user.currEmail} and OTP is ${user.currEmailOTP}`);
      console.log(`End of function - Value of new email ID is ${user.newEmail} and OTP is ${user.newEmailOTP}`);
    }
  }

  changeEmailSteps(2);  //Calling the email change function

  group(`11 - GET SignOut`, function () {
    res = http.get(env.launchURL + "/sign-out", {
      tags: { reqName: "11_SignOut" },
    });

    check(res, {
      "is status 200": (r) => r.status === 200,
      "verify page content": (r) =>
        (r.body as String).includes("You have signed out"),
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
