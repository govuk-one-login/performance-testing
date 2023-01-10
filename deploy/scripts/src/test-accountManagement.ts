import { sleep, group, check, fail } from "k6";
import { Options } from "k6/options";
import http, { Response } from "k6/http";
import { SharedArray } from "k6/data";
import exec from "k6/execution";
import { Rate, Trend } from "k6/metrics";
import TOTP from './utils/authentication/totp';
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

    changePassword: {
        executor: "ramping-arrival-rate",
        startRate: 1,
        timeUnit: "1m",
        preAllocatedVUs: 1,
        maxVUs: 1,
        stages: [
          { target: 1, duration: "2m" }, //Ramps up to target load
          //  { target: 1, duration: '60s' },    //Holds at target load
        ],
        exec: "changePassword",
      },

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

    changePassword: {
        executor: "ramping-arrival-rate",
        startRate: 1,
        timeUnit: "1m",
        preAllocatedVUs: 1,
        maxVUs: 50,
        stages: [
          { target: 60, duration: "120s" }, //Ramps up to target load
          { target: 60, duration: "120s" }, //Holds at target load
        ],
        exec: "changePassword",
      },

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
    http_req_duration: ["p(95)<1000"],
    http_req_failed: ["rate<0.05"], // Error rate <5%
  },
};

type UserEmailChange = {
  currEmail: string;
  currEmailOTP: string;
  newEmail: string;
  newEmailOTP: string;
};

const csvData1: UserEmailChange[] = new SharedArray("csvEmailChange",function () {
    return open("./data/changeEmail_TestData.csv").split("\n").slice(1).map((s) => {
        let data = s.split(",");
        return {
          currEmail: data[0],
          currEmailOTP: data[1],
          newEmail: data[2],
          newEmailOTP: data[3],
        };
      });
  }
);

type UserPasswordChange = {
  currEmail: string;
};

const csvData2: UserPasswordChange[] = new SharedArray("csvPasswordChange",function () {
    return open("./data/changePassword_TestData.csv").split("\n").slice(1).map((s) => {
        let data = s.split(",");
        return {
          currEmail: data[0],
        };
      });
  }
);

type UserPhoneNumberChange = {
  currEmail: string;
  currEmailOTP: string;
  currPhone: string;
  newPhone: string;
  newPhoneOTP: string;
};

const csvData3: UserPhoneNumberChange[] = new SharedArray("csvPhoneNumChange",function () {
    return open("./data/changePhoneNumber_TestData.csv").split("\n").slice(1).map((s) => {
        let data = s.split(",");
        return {
          currEmail: data[0],
          currEmailOTP: data[1],
          currPhone: data[2],
          newPhone: data[3],
          newPhoneOTP: data[4],
        };
      });
  }
);

type UserDeleteAccount = { currEmail: string; currEmailOTP: string };

const csvData4: UserDeleteAccount[] = new SharedArray("csvDelAccount",function () {
    return open("./data/deleteAccount_TestData.csv").split("\n").slice(1).map((s) => {
        let data = s.split(",");
        return {
          currEmail: data[0],
          currEmailOTP: data[1],
        };
      });
  }
);

export function setup() {
  describeProfile(loadProfile);
}

const env = {
  launchURL: `https://${__ENV.stagingLaunch}`, //home.staging.account.gov.uk home.build.account.gov.uk 
  baseUrl: `https://${__ENV.stagingBase}`,
};

const credentials ={
  authAppKey: __ENV.AUTH_APP_KEY,
  currPassword: __ENV.APP_PASSWORD,
  newPassword: __ENV.APP_PASSWORD_NEW,
}

const transactionDuration = new Trend("Transaction Duration");

export function changeEmail() {
  let res: Response;
  let csrfToken: string;

  const user1 = csvData1[exec.scenario.iterationInTest % csvData1.length];
 
  let totp = new TOTP(credentials.authAppKey); 

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
          email: user1.currEmail,
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
            password: credentials.currPassword,
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
      });

  sleep(2);

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
              'verify page content': r => (r.body as String).includes('Your services'),
          })
          ? transactionDuration.add(res.timings.duration) : fail("Respone Validation Failed");
      });

      sleep(Math.random() * 3);  

      group(`06 - GET Click Settings Tab`, () => {
        res = http.get(env.launchURL + "/settings", {
          tags: { reqName: "06_ClickSettingsTab" },
        });
  
        check(res, {
            'is status 200': r => r.status === 200,
            'verify page content': r => (r.body as String).includes('Delete your GOV.UK account'),
        })
        ? transactionDuration.add(res.timings.duration) : fail("Response Validation Failed");
     });

  sleep(Math.random() * 3);

  function changeEmailSteps(loopCount: number) {
    for (let i = 1; i <= loopCount; i++) {

      group(`07 - GET Click Change Email Link`, function () {
        res = http.get(env.launchURL + "/enter-password?type=changeEmail", {
          tags: { reqName: "07_ClickChangeEmailLink" },
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

      group(`08 - POST Enter Current Password`, () => {
        res = http.post(
          env.launchURL + "/enter-password",
          {
            _csrf: csrfToken,
            requestType: "changeEmail",
            password: credentials.currPassword,
          },
          {
            tags: { reqName: "08_EnterCurrentPassword" },
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

      group(`09 - POST Enter new email ID`, () => {
        res = http.post(
          env.launchURL + "/change-email",
          {
            _csrf: csrfToken,
            email: user1.newEmail,
          },
          {
            tags: { reqName: "09_EnterNewEmailID" },
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

      group(`10 - POST Enter email OTP`, () => {
        res = http.post(
          env.launchURL + "/check-your-email",
          {
            _csrf: csrfToken,
            email: user1.newEmail,
            code: user1.newEmailOTP,
          },
          {
            tags: { reqName: "10_EnterEmailOTP" },
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

      group(`11 - GET Click Back to my account`, function () {
        res = http.get(env.launchURL + "/manage-your-account", {
          tags: { reqName: "11_ClickBackToMyAccount" },
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

      [user1.currEmail, user1.newEmail] = [user1.newEmail, user1.currEmail];
      [user1.currEmailOTP, user1.newEmailOTP] = [user1.newEmailOTP, user1.currEmailOTP];
    }
  }

  changeEmailSteps(2);  //Calling the email change function

  group(`12 - GET SignOut`, function () {
    res = http.get(env.launchURL + "/sign-out", {
      tags: { reqName: "12_SignOut" },
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

export function changePassword() {
    let res: Response;
    let csrfToken: string;
  
    const user2 = csvData2[exec.scenario.iterationInTest % csvData2.length];

    let totp = new TOTP(credentials.authAppKey); 
  
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
          email: user2.currEmail,
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
          password: credentials.currPassword,
        },
        {
          tags: { reqName: "04_EnterLoginPassword" },
        }
      );
  
      check(res, {
        "is status 200": (r) => r.status === 200,
        "verify page content": (r) =>
          (r.body as String).includes(
            "Enter the 6 digit security code shown in your authenticator app"
          ),
      })
        ? transactionDuration.add(res.timings.duration)
        : fail("Response Validation Failed");
  
      csrfToken = getCSRF(res);
    });
  
    sleep(Math.random() * 3);
  
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
              'verify page content': r => (r.body as String).includes('Your services'),
          })
          ? transactionDuration.add(res.timings.duration) : fail("Response Validation Failed");
      });
    
    sleep(Math.random() * 3);  

    group(`06 - GET Click Settings Tab`, () => {
      res = http.get(env.launchURL + "/settings", {
        tags: { reqName: "06_ClickSettingsTab" },
      });

      check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as String).includes('Delete your GOV.UK account'),
      })
      ? transactionDuration.add(res.timings.duration) : fail("Response Validation Failed");
   });
  
    sleep(Math.random() * 3);
  
    function changePassSteps(loopCount: number) {
      for (let i = 1; i <= loopCount; i++) {
  
        group(`07 - GET Click Change Password Link`, function () {
          res = http.get(env.launchURL + "/enter-password?type=changePassword", {
            tags: { reqName: "07_ClickChangePasswordLink" },
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
  
        group(`08 - POST Enter Current Password`, () => {
          res = http.post(
            env.launchURL + "/enter-password",
            {
              _csrf: csrfToken,
              requestType: "changePassword",
              password: credentials.currPassword,
            },
            {
              tags: { reqName: "08_EnterCurrentPassword" },
            }
          );
  
          check(res, {
            "is status 200": (r) => r.status === 200,
            "verify page content": (r) =>
              (r.body as String).includes("Enter your new password"),
          })
            ? transactionDuration.add(res.timings.duration)
            : fail("Response Validation Failed");
  
          csrfToken = getCSRF(res);
        });
  
        sleep(Math.random() * 3);
  
        group(`09 - POST Enter and confirm new password`, () => {
          res = http.post(
            env.launchURL + "/change-password",
            {
              _csrf: csrfToken,
              password: credentials.newPassword,
              "confirm-password": credentials.newPassword,
            },
            {
              tags: { reqName: "09_EnterNewPassword" },
            }
          );
  
          check(res, {
            "is status 200": (r) => r.status === 200,
            "verify page content": (r) =>
              (r.body as String).includes("You have changed your password"),
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
  
        [credentials.currPassword, credentials.newPassword] = [credentials.newPassword,credentials.currPassword];
  
        sleep(Math.random() * 3);
      }
    }
  
    changePassSteps(2); //Calling the password change function twice to change the password back to the original one
  
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

export function changePhone() {
    let res: Response;
    let csrfToken: string;
    let phoneNumHidden: string;
  
    const user3 = csvData3[exec.scenario.iterationInTest % csvData3.length];
  
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
          email: user3.currEmail,
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
          password: credentials.currPassword,
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
          code: user3.currEmailOTP,
        },
        {
          tags: { reqName: "05_EnterSMSOTP" },
        }
      );
  
      check(res, {
        "is status 200": (r) => r.status === 200,
        "verify page content": (r) =>
          (r.body as String).includes("Your services"),
      })
        ? transactionDuration.add(res.timings.duration)
        : fail("Response Validation Failed");
    });

    sleep(Math.random() * 3);  

    group(`06 - GET Click Settings Tab`, () => {
      res = http.get(env.launchURL + "/settings", {
        tags: { reqName: "06_ClickSettingsTab" },
      });

      check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as String).includes('Delete your GOV.UK account'),
      })
      ? transactionDuration.add(res.timings.duration) : fail("Response Validation Failed");
   });
  
    sleep(Math.random() * 3);
  
    function changePhoneSteps(loopCount: number) {
      for (let i = 1; i <= loopCount; i++) {
  
        group(`07 - GET Click Change Phone Number Link`, function () {
          res = http.get(
            env.launchURL + "/enter-password?type=changePhoneNumber",
            {
              tags: { reqName: "07_ClickChangePhoneNumber" },
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
  
        group(`08 - POST Enter Current Password`, () => {
          res = http.post(
            env.launchURL + "/enter-password",
            {
              _csrf: csrfToken,
              requestType: "changePhoneNumber",
              password: credentials.currPassword,
            },
            {
              tags: { reqName: "08_EnterCurrentPassword" },
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
  
        group(`09 - POST Enter new phone number`, () => {
          res = http.post(
            env.launchURL + "/change-phone-number",
            {
              _csrf: csrfToken,
              supportInternationalNumbers: "",
              phoneNumber: user3.newPhone,
            },
            {
              tags: { reqName: "09_EnterNewPhoneNumber" },
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
  
        group(`10 - POST Enter New Phone Num OTP`, () => {
          res = http.post(
            env.launchURL + "/check-your-phone",
            {
              _csrf: csrfToken,
              phoneNumber: phoneNumHidden,
              code: user3.newPhoneOTP,
            },
            {
              tags: { reqName: "10_EnteNewPhoneOTP" },
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
  
        group(`11 - GET Click Back to my account`, function () {
          res = http.get(env.launchURL + "/manage-your-account", {
            tags: { reqName: "11_ClickBackToMyAccounts" },
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
        [user3.currPhone, user3.newPhone] = [user3.newPhone, user3.currPhone];
        [user3.currEmailOTP, user3.newPhoneOTP] = [user3.newPhoneOTP,user3.currEmailOTP];
  
        sleep(Math.random() * 3);
      }
    }
  
    changePhoneSteps(2);  //Calling the password change function
  
    group(`12 - GET SignOut`, function () {
      res = http.get(env.launchURL + "/sign-out", {
        tags: { reqName: "12_SignOut" },
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

export function deleteAccount() {
    let res: Response;
    let csrfToken: string;
    let phoneNumHidden: string;
    
    const user4 = csvData4[exec.scenario.iterationInTest % csvData4.length];

    let totp = new TOTP(credentials.authAppKey); 
  
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
          email: user4.currEmail,
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
          password: credentials.currPassword,
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
              'verify page content': r => (r.body as String).includes('Your services'),
          })
          ? transactionDuration.add(res.timings.duration) : fail("Respone Validation Failed");
      });
    
    sleep(Math.random() * 3);  

    group(`06 - GET Click Settings Tab`, () => {
      res = http.get(env.launchURL + "/settings", {
        tags: { reqName: "06_ClickSettingsTab" },
      });

      check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as String).includes('Delete your GOV.UK account'),
      })
      ? transactionDuration.add(res.timings.duration) : fail("Response Validation Failed");
    });
  
    sleep(Math.random() * 3);
  
    group(`07 - GET Click Delete Account Link`, function () {
      res = http.get(env.launchURL + "/enter-password?type=deleteAccount", {
        tags: { reqName: "07_ClickDeleteAccountLink" },
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
  
    group(`08 - POST Enter Password to confirm account deletion`, () => {
      res = http.post(
        env.launchURL + "/enter-password",
        {
          _csrf: csrfToken,
          requestType: "deleteAccount",
          password: credentials.currPassword,
        },
        {
          tags: { reqName: "08_EnterCurrentPassword" },
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
  
    group(`09 - POST Click Delete your account button`, () => {
      res = http.post(
        env.launchURL + "/delete-account",
        {
          _csrf: csrfToken,
        },
        {
          tags: { reqName: "09_DeleteAccountConfirm" },
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