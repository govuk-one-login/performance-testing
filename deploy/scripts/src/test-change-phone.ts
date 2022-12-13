import { sleep, group, check, fail } from "k6";
import { Options } from "k6/options";
import http, { Response } from "k6/http";
import { SharedArray } from "k6/data";
import exec from "k6/execution";
import { Trend } from "k6/metrics";
import { selectProfile, ProfileList, describeProfile} from "./utils/config/load-profiles";

const profiles: ProfileList = {
  smoke: {
    changePhone: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1m",
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: "2m" }, //Ramps up to target load
        //  { target: 1, duration: '60s' },    //Holds at target load
      ],
      exec: "changePhone",
    },
  },
  load: {
    changePhone: {
      executor: "ramping-arrival-rate",
      startRate: 1,
      timeUnit: "1m",
      preAllocatedVUs: 1,
      maxVUs: 50,
      stages: [
        { target: 60, duration: "120s" }, //Ramps up to target load
        { target: 60, duration: "120s" }, //Holds at target load
      ],
      exec: "changePhone",
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

type User = {
  currEmail: string;
  currPassword: string;
  currEmailOTP: string;
  currPhone: string;
  newPhone: string;
  newPhoneOTP: string;
};

const csvData: User[] = new SharedArray("csv", function () {
  return open("./data/changePhoneNumber_TestData.csv").split("\n").slice(1).map((s) => {
      let data = s.split(",");
      return {
        currEmail: data[0],
        currPassword: data[1],
        currEmailOTP: data[2],
        currPhone: data[3],
        newPhone: data[4],
        newPhoneOTP: data[5],
      };
    });
});

export function changePhone() {
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

  sleep(Math.random() * 3);

  function changePhoneSteps(loopCount: number) {
    for (let i = 1; i <= loopCount; i++) {
      console.log(`Start of function - Value of old phone number is ${user.currPhone} and OTP is ${user.currEmailOTP}`);
      console.log(`Start of function - Value of old phone number is ${user.newPhone} and OTP is ${user.newPhoneOTP}`);

      group(`06 - GET Click Change Phone Number Link`, function () {
        res = http.get(
          env.launchURL + "/enter-password?type=changePhoneNumber",
          {
            tags: { reqName: "06_ClickChangePhoneNumber" },
          }
        );

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
            requestType: "changePhoneNumber",
            password: user.currPassword,
          },
          {
            tags: { reqName: "07_EnterCurrentPassword" },
          }
        );

        check(res, {
          "is status 200": (r) => r.status === 200,
          "verify page content": (r) =>
            (r.body as String).includes("Enter your new mobile phone number"),
        })
          ? transactionDuration.add(res.timings.duration)
          : fail("Response Validation Failed");

        csrfToken = getCSRF(res);
      });

      sleep(Math.random() * 3);

      group(`08 - POST Enter new phone number`, () => {
        res = http.post(
          env.launchURL + "/change-phone-number",
          {
            _csrf: csrfToken,
            supportInternationalNumbers: "",
            phoneNumber: user.newPhone,
          },
          {
            tags: { reqName: "08_EnterNewPhoneNumber" },
          }
        );

        check(res, {
          "is status 200": (r) => r.status === 200,
          "verify page content": (r) =>
            (r.body as String).includes("Check your phone"),
        })
          ? transactionDuration.add(res.timings.duration)
          : fail("Response Validation Failed");

        csrfToken = getCSRF(res);
        phoneNumHidden = getPhone(res);
      });

      sleep(Math.random() * 3);

      group(`09 - POST Enter New Phone Num OTP`, () => {
        res = http.post(
          env.launchURL + "/check-your-phone",
          {
            _csrf: csrfToken,
            phoneNumber: phoneNumHidden,
            code: user.newPhoneOTP,
          },
          {
            tags: { reqName: "09_EnteNewPhoneOTP" },
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

      sleep(Math.random() * 3);

      group(`10 - GET Click Back to my account`, function () {
        res = http.get(env.launchURL + "/manage-your-account", {
          tags: { reqName: "10_ClickBackToMyAccounts" },
        });

        check(res, {
          "is status 200": (r) => r.status === 200,
          "verify page content": (r) =>
            (r.body as String).includes("Delete your GOV.UK account"),
        })
          ? transactionDuration.add(res.timings.duration)
          : fail("Response Validation Failed");
      });

      //Swap the value of the variables by destructuring assignment
      [user.currPhone, user.newPhone] = [user.newPhone, user.currPhone];
      [user.currEmailOTP, user.newPhoneOTP] = [user.newPhoneOTP,user.currEmailOTP];

      console.log(`Start of function - Value of old phone number is ${user.currPhone} and OTP is ${user.currEmailOTP}`);
      console.log(`Start of function - Value of old phone number is ${user.newPhone} and OTP is ${user.newPhoneOTP}`);

      sleep(Math.random() * 3);
    }
  }

  changePhoneSteps(2);  //Calling the password change function

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
