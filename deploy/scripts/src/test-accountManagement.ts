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
        maxVUs: 50,
        stages: [
          { target: 5, duration: "2m" }, //Starts at the target start load 10
          { target: 15, duration: '2m' }, //Starts at the target start load 30
          { target: 25, duration: '2m' }, //50
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
        maxVUs: 100,
        stages: [
          { target: 50, duration: "120s" }, //Ramp Up to Load - 550 transactions per minute i.e. 9.16 tps
          { target: 100, duration: "120s" }, //Ramp Up to Load - 1100 transactions per minute i.e. 18.33 tps
          { target: 150, duration: "120s" }, //Ramp Up to Load - 1650 transactions per minute i.e. 27.5 tps
          { target: 200, duration: "120s" }, //Ramp Up to Load - 2200 transactions per minute i.e. 36.66 tps
          { target: 300, duration: "120s" }, //Ramp Up to Load - 3300 transactions per minute i.e. 55 tps
          { target: 300, duration: "1800s" }, //Steady State of 55 tps for 30 minutes
          { target: 200, duration: "120s" }, //Ramp Down to Load - 36.66 tps in a minute
          { target: 100, duration: "120s" }, //Ramp Down to Load - 18.33 tps in a minute
          { target: 0, duration: "60s" }, //Ramp Down to Load - 0 tps in a minute
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

const csvData2 : UserPasswordChange[]= new SharedArray("csvPasswordChange",function () {
    return open("./data/changePassword_TestData.csv").split("\n").slice(1).map((s) => {
      return {
        currEmail: s,
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

type UserDeleteAccount = { currEmail: string; };

const csvData4: UserDeleteAccount[] = new SharedArray("csvDelAccount",function () {
    return open("./data/deleteAccount_TestData.csv").split("\n").slice(1).map((s) => {
        return {
          currEmail: s,
        };
      });
  }
);

export function setup() {
  describeProfile(loadProfile);
}

const env = {
  envURL: `https://${__ENV.launchURL}`, //home.staging.account.gov.uk home.build.account.gov.uk 
  signinURL: `https://${__ENV.signinURL}`,
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

  group(`B01_ChangeEmail_01_LaunchAccountsHome GET`, function () {
    res = http.get(env.envURL, {
      tags: { name: "B01_ChangeEmail_01_LaunchAccountsHome" },
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

  group(`B01_ChangeEmail_02_ClickSignIn GET`, function () {
    res = http.get(env.signinURL + "/sign-in-or-create?redirectPost=true", {
      tags: { name: "B01_ChangeEmail_02_ClickSignIn" },
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

    group(`B01_ChangeEmail_03_EnterEmailID POST`, () => {
      res = http.post(
        env.signinURL + "/enter-email",
        {
          _csrf: csrfToken,
          email: user1.currEmail,
        },
        {
          tags: { name: "B01_ChangeEmail_03_EnterEmailID" },
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

      group(`B01_ChangeEmail_04_EnterLoginPassword POST`, () => {
        res = http.post(
          env.signinURL + "/enter-password",
          {
            _csrf: csrfToken,
            password: credentials.currPassword,
          },
          {
            tags: { name: "B01_ChangeEmail_04_EnterLoginPassword" },
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

      group(`B01_ChangeEmail_05_EnterAuthAppOTP POST`, () => {
          res = http.post(env.signinURL + '/enter-authenticator-app-code',
              {
                  _csrf: csrfToken,
                  code: totp.generateTOTP(),
              },
              {
                  tags: {name: "B01_ChangeEmail_05_EnterAuthAppOTP"}
              }
          );
  
          check(res, {
              'is status 200': r => r.status === 200,
              'verify page content': r => (r.body as String).includes('Your services'),
          })
          ? transactionDuration.add(res.timings.duration) : fail("Respone Validation Failed");
      });

      sleep(Math.random() * 3);  

      group(`B01_ChangeEmail_06_ClickSettingsTab GET`, () => {
        res = http.get(env.envURL + "/settings", {
          tags: { name: "B01_ChangeEmail_06_ClickSettingsTab" },
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

      group(`B01_ChangeEmail_07_ClickChangeEmailLink GET`, function () {
        res = http.get(env.envURL + "/enter-password?type=changeEmail", {
          tags: { name: "B01_ChangeEmail_07_ClickChangeEmailLink" },
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

      group(`B01_ChangeEmail_08_EnterCurrentPassword POST`, () => {
        res = http.post(
          env.envURL + "/enter-password",
          {
            _csrf: csrfToken,
            requestType: "changeEmail",
            password: credentials.currPassword,
          },
          {
            tags: { name: "B01_ChangeEmail_08_EnterCurrentPassword" },
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

      group(`B01_ChangeEmail_09_EnterNewEmailID POST`, () => {
        res = http.post(
          env.envURL + "/change-email",
          {
            _csrf: csrfToken,
            email: user1.newEmail,
          },
          {
            tags: { name: "B01_ChangeEmail_09_EnterNewEmailID" },
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

      group(`B01_ChangeEmail_10_EnterEmailOTP POST`, () => {
        res = http.post(
          env.envURL + "/check-your-email",
          {
            _csrf: csrfToken,
            email: user1.newEmail,
            code: user1.newEmailOTP,
          },
          {
            tags: { name: "B01_ChangeEmail_10_EnterEmailOTP" },
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

      group(`B01_ChangeEmail_11_ClickBackToMyAccount GET`, function () {
        res = http.get(env.envURL + "/manage-your-account", {
          tags: { name: "B01_ChangeEmail_11_ClickBackToMyAccount" },
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

  group(`B01_ChangeEmail_12_SignOut GET`, function () {
    res = http.get(env.envURL + "/sign-out", {
      tags: { name: "B01_ChangeEmail_12_SignOut" },
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
  
    group(`B02_ChangePassword_01_LaunchAccountsHome GET`, function () {
      res = http.get(env.envURL,{
        tags: { name: "B02_ChangePassword_01_LaunchAccountsHome" },
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
  
    group(`B02_ChangePassword_02_ClickSignIn GET`, function () {
      res = http.get(env.signinURL + "/sign-in-or-create?redirectPost=true",{
        tags: { name: "B02_ChangePassword_02_ClickSignIn" },
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
  
    group(`B02_ChangePassword_03_EnterEmailID POST`, () => {
      res = http.post(
        env.signinURL + "/enter-email",
        {
          _csrf: csrfToken,
          email: user2.currEmail,
        },
        {
          tags: { name: "B02_ChangePassword_03_EnterEmailID" },
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
  
    group(`B02_ChangePassword_04_EnterLoginPassword POST`, () => {
      res = http.post(
        env.signinURL + "/enter-password",
        {
          _csrf: csrfToken,
          password: credentials.currPassword,
        },
        {
          tags: { name: "B02_ChangePassword_04_EnterLoginPassword" },
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
  
    group(`B02_ChangePassword_05_EnterAuthAppOTP POST`, () => {
          res = http.post(env.signinURL + '/enter-authenticator-app-code',
              {
                  _csrf: csrfToken,
                  code: totp.generateTOTP(),
              },
              {
                tags: { name: "B02_ChangePassword_05_EnterAuthAppOTP" },
              }
          );
  
          check(res, {
              'is status 200': r => r.status === 200,
              'verify page content': r => (r.body as String).includes('Your services'),
          })
          ? transactionDuration.add(res.timings.duration) : fail("Response Validation Failed");
      });
    
    sleep(Math.random() * 3);  

    group(`B02_ChangePassword_06_ClickSettingsTab GET`, () => {
      res = http.get(env.envURL + "/settings",{
        tags: { name: "B02_ChangePassword_06_ClickSettingsTab" },
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
  
        group(`B02_ChangePassword_07_ClickChangePasswordLink GET`, function () {
          res = http.get(env.envURL + "/enter-password?type=changePassword",{
            tags: { name: "B02_ChangePassword_07_ClickChangePasswordLink" },
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
  
        group(`B02_ChangePassword_08_EnterCurrentPassword POST`, () => {
          res = http.post(
            env.envURL + "/enter-password",
            {
              _csrf: csrfToken,
              requestType: "changePassword",
              password: credentials.currPassword,
            },
            {
              tags: { name: "B02_ChangePassword_08_EnterCurrentPassword" },
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
  
        group(`B02_ChangePassword_09_EnterNewPassword POST`, () => {
          res = http.post(
            env.envURL + "/change-password",
            {
              _csrf: csrfToken,
              password: credentials.newPassword,
              "confirm-password": credentials.newPassword,
            },
            {
              tags: { name: "B02_ChangePassword_09_EnterNewPassword" },
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
  
        group(`B02_ChangePassword_10_ClickBackToMyAccounts GET`, function () {
          res = http.get(env.envURL + "/manage-your-account",{
            tags: { name: "B02_ChangePassword_10_ClickBackToMyAccounts" },
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
  
    group(`B02_ChangePassword_11_SignOut GET`, function () {
      res = http.get(env.envURL + "/sign-out",{
        tags: { name: "B02_ChangePassword_11_SignOut" },
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
  
    group(`B03_ChangePhone_01_LaunchAccountsHome GET`, function () {
      res = http.get(env.envURL, {
        tags: { name: "B03_ChangePhone_01_LaunchAccountsHome" },
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
  
    group(`B03_ChangePhone_02_ClickSignIn GET`, function () {
      res = http.get(env.signinURL + "/sign-in-or-create?redirectPost=true", {
        tags: { name: "B03_ChangePhone_02_ClickSignIn" },
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
  
    group(`B03_ChangePhone_03_EnterEmailID POST`, () => {
      res = http.post(
        env.signinURL + "/enter-email",
        {
          _csrf: csrfToken,
          email: user3.currEmail,
        },
        {
          tags: { name: "B03_ChangePhone_03_EnterEmailID" },
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
  
    group(`B03_ChangePhone_04_EnterSignInPassword POST`, () => {
      res = http.post(
        env.signinURL + "/enter-password",
        {
          _csrf: csrfToken,
          password: credentials.currPassword,
        },
        {
          tags: { name: "B03_ChangePhone_04_EnterSignInPassword" },
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
  
    group(`B03_ChangePhone_05_EnterSMSOTP POST`, () => {
      res = http.post(
        env.signinURL + "/enter-code",
        {
          phoneNumber: phoneNumHidden,
          _csrf: csrfToken,
          code: user3.currEmailOTP,
        },
        {
          tags: { name: "B03_ChangePhone_05_EnterSMSOTP" },
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

    group(`B03_ChangePhone_06_ClickSettingsTab GET`, () => {
      res = http.get(env.envURL + "/settings", {
        tags: { name: "B03_ChangePhone_06_ClickSettingsTab" },
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
  
        group(`B03_ChangePhone_07_ClickChangePhoneNumber GET`, function () {
          res = http.get(
            env.envURL + "/enter-password?type=changePhoneNumber",
            {
              tags: { name: "B03_ChangePhone_07_ClickChangePhoneNumber" },
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
  
        group(`B03_ChangePhone_08_EnterCurrentPassword POST`, () => {
          res = http.post(
            env.envURL + "/enter-password",
            {
              _csrf: csrfToken,
              requestType: "changePhoneNumber",
              password: credentials.currPassword,
            },
            {
              tags: { name: "B03_ChangePhone_08_EnterCurrentPassword" },
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
  
        group(`B03_ChangePhone_09_EnterNewPhoneNumber POST`, () => {
          res = http.post(
            env.envURL + "/change-phone-number",
            {
              _csrf: csrfToken,
              supportInternationalNumbers: "",
              phoneNumber: user3.newPhone,
            },
            {
              tags: { name: "B03_ChangePhone_09_EnterNewPhoneNumber" },
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
  
        group(`B03_ChangePhone_10_EnteNewPhoneOTP POST`, () => {
          res = http.post(
            env.envURL + "/check-your-phone",
            {
              _csrf: csrfToken,
              phoneNumber: phoneNumHidden,
              code: user3.newPhoneOTP,
            },
            {
              tags: { name: "B03_ChangePhone_10_EnteNewPhoneOTP" },
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
  
        group(`B03_ChangePhone_11_ClickBackToMyAccounts GET`, function () {
          res = http.get(env.envURL + "/manage-your-account", {
            tags: { name: "B03_ChangePhone_11_ClickBackToMyAccounts" },
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
  
    group(`B03_ChangePhone_12_SignOut GET`, function () {
      res = http.get(env.envURL + "/sign-out", {
        tags: { name: "B03_ChangePhone_12_SignOut" },
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
  
    group(`B04_DeleteAccount_01_LaunchAccountsHome GET`, function () {
      res = http.get(env.envURL, {
        tags: { name: "B04_DeleteAccount_01_LaunchAccountsHome" },
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
  
    group(`B04_DeleteAccount_02_ClickSignIn GET`, function () {
      res = http.get(env.signinURL + "/sign-in-or-create?redirectPost=true", {
        tags: { name: "B04_DeleteAccount_02_ClickSignIn" },
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
  
    group(`B04_DeleteAccount_03_EnterEmailID POST`, () => {
      res = http.post(
        env.signinURL + "/enter-email",
        {
          _csrf: csrfToken,
          email: user4.currEmail,
        },
        {
          tags: { name: "B04_DeleteAccount_03_EnterEmailID" },
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
  
    group(`B04_DeleteAccount_04_EnterSignInPassword POST`, () => {
      res = http.post(
        env.signinURL + "/enter-password",
        {
          _csrf: csrfToken,
          password: credentials.currPassword,
        },
        {
          tags: { name: "B04_DeleteAccount_04_EnterSignInPassword" },
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
      phoneNumHidden = getPhone(res);
    });
  
    sleep(Math.random() * 3);
   
   group(`B04_DeleteAccount_05_EnterAuthAppOTP POST`, () => {
          res = http.post(env.signinURL + '/enter-authenticator-app-code',
              {
                  _csrf: csrfToken,
                  code: totp.generateTOTP(),
              },
              {
                  tags: {name: "B04_DeleteAccount_05_EnterAuthAppOTP"}
              }
          );
  
          check(res, {
              'is status 200': r => r.status === 200,
              'verify page content': r => (r.body as String).includes('Your services'),
          })
          ? transactionDuration.add(res.timings.duration) : fail("Respone Validation Failed");
      });
    
    sleep(Math.random() * 3);  

    group(`B04_DeleteAccount_06_ClickSettingsTab GET`, () => {
      res = http.get(env.envURL + "/settings", {
        tags: { name: "B04_DeleteAccount_06_ClickSettingsTab" },
      });

      check(res, {
          'is status 200': r => r.status === 200,
          'verify page content': r => (r.body as String).includes('Delete your GOV.UK account'),
      })
      ? transactionDuration.add(res.timings.duration) : fail("Response Validation Failed");
    });
  
    sleep(Math.random() * 3);
  
    group(`B04_DeleteAccount_07_ClickDeleteAccountLink GET`, function () {
      res = http.get(env.envURL + "/enter-password?type=deleteAccount", {
        tags: { name: "B04_DeleteAccount_07_ClickDeleteAccountLink" },
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
  
    group(`B04_DeleteAccount_08_EnterCurrentPassword POST`, () => {
      res = http.post(
        env.envURL + "/enter-password",
        {
          _csrf: csrfToken,
          requestType: "deleteAccount",
          password: credentials.currPassword,
        },
        {
          tags: { name: "B04_DeleteAccount_08_EnterCurrentPassword" },
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
  
    group(`B04_DeleteAccount_09_DeleteAccountConfirm POST`, () => {
      res = http.post(
        env.envURL + "/delete-account",
        {
          _csrf: csrfToken,
        },
        {
          tags: { name: "B04_DeleteAccount_09_DeleteAccountConfirm" },
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