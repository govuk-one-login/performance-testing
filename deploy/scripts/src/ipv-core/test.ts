import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter';
import encoding from 'k6/encoding';
import { group } from 'k6';
import { type Options } from 'k6/options';
import http, { type Response } from 'k6/http';
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles';
// import { getStaticResources } from '../common/utils/request/static'
import { timeRequest } from '../common/utils/request/timing';
import { passportPayload, addressPayloadP, kbvPayloadP, fraudPayloadP } from './data/passportData';
import { addressPayloadDL, kbvPayloaDL, fraudPayloadDL, drivingLicencePayload } from './data/drivingLicenceData';
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions';
import { sleepBetween } from '../common/utils/sleep/sleepBetween';
import { SharedArray } from 'k6/data';
import { uuidv4 } from '../common/utils/jslib/index';
import execution from 'k6/execution';
import { getEnv } from '../common/utils/config/environment-variables';
import { getThresholds } from '../common/utils/config/thresholds';

const profiles: ProfileList = {
  smoke: {
    ...createScenario('passport', LoadProfile.smoke),
    ...createScenario('drivingLicence', LoadProfile.smoke),
    ...createScenario('idReuse', LoadProfile.smoke)
  },
  deployment: {
    ...createScenario('passport', LoadProfile.deployment, 2),
    ...createScenario('drivingLicence', LoadProfile.deployment, 2),
    ...createScenario('idReuse', LoadProfile.deployment, 10)
  },
  lowVolume: {
    ...createScenario('passport', LoadProfile.short, 20),
    ...createScenario('drivingLicence', LoadProfile.short, 20),
    ...createScenario('idReuse', LoadProfile.short, 20)
  },
  load: {
    ...createScenario('passport', LoadProfile.full, 100),
    ...createScenario('drivingLicence', LoadProfile.full, 30),
    ...createScenario('idReuse', LoadProfile.full, 1900, 5)
  },
  dataCreationForIDReuse: {
    passport: {
      executor: 'per-vu-iterations',
      vus: 250,
      iterations: 200,
      maxDuration: '120m',
      exec: 'passport'
    }
  }
};

const loadProfile = selectProfile(profiles);
const groupMap = {
  passport: [
    'B01_Passport_01_LaunchOrchestratorStub',
    'B01_Passport_02_GoToFullJourneyRoute',
    'B01_Passport_03_ClickContinueStartPage',
    'B01_Passport_03_ClickContinueStartPage::01_CoreCall',
    'B01_Passport_03_ClickContinueStartPage::02_DCMAWStub',
    'B01_Passport_04_DCMAWContinue',
    'B01_Passport_04_DCMAWContinue::01_DCMAWStub',
    'B01_Passport_04_DCMAWContinue::02_CoreCall',
    'B01_Passport_05_ContinueOnPYIStartPage',
    'B01_Passport_05_ContinueOnPYIStartPage::01_CoreCall',
    'B01_Passport_05_ContinueOnPYIStartPage::02_PassStub',
    'B01_Passport_06_PassportDataContinue',
    'B01_Passport_06_PassportDataContinue::01_PassStub',
    'B01_Passport_06_PassportDataContinue::02_CoreCall',
    'B01_Passport_06_PassportDataContinue::03_AddStub',
    'B01_Passport_07_AddrDataContinue',
    'B01_Passport_07_AddrDataContinue::01_AddStub',
    'B01_Passport_07_AddrDataContinue::02_CoreCall',
    'B01_Passport_07_AddrDataContinue::03_FraudStub',
    'B01_Passport_08_FraudDataContinue',
    'B01_Passport_08_FraudDataContinue::01_FraudStub',
    'B01_Passport_08_FraudDataContinue::02_CoreCall',
    'B01_Passport_09_PreKBVTransition',
    'B01_Passport_09_PreKBVTransition::01_CoreCall',
    'B01_Passport_09_PreKBVTransition::02_KBVStub',
    'B01_Passport_10_KBVDataContinue',
    'B01_Passport_10_KBVDataContinue::01_KBVStub',
    'B01_Passport_10_KBVDataContinue::02_CoreCall',
    'B01_Passport_11_ContinuePYISuccessPage',
    'B01_Passport_11_ContinuePYISuccessPage::01_CoreCall',
    'B01_Passport_11_ContinuePYISuccessPage::02_OrchStub'
  ],
  drivingLicence: [
    'B02_DrivingLicence_01_LaunchOrchestratorStub',
    'B02_DrivingLicence_02_SelectUserIDContinue',
    'B02_DrivingLicence_03_ContinueStartPage',
    'B02_DrivingLicence_03_ContinueStartPage::01_CoreCall',
    'B02_DrivingLicence_03_ContinueStartPage::02_DCMAWStub',
    'B02_DrivingLicence_04_DCMAWContinue',
    'B02_DrivingLicence_04_DCMAWContinue::01_DCMAWStub',
    'B02_DrivingLicence_04_DCMAWContinue::02_CoreCall',
    'B02_DrivingLicence_05_ContinueOnPYIStartPage',
    'B02_DrivingLicence_05_ContinueOnPYIStartPage::01_CoreCall',
    'B02_DrivingLicence_05_ContinueOnPYIStartPage::02_DLStub',
    'B02_DrivingLicence_06_DrivingLicenceDataContinue',
    'B02_DrivingLicence_06_DrivingLicenceDataContinue::01_DLStub',
    'B02_DrivingLicence_06_DrivingLicenceDataContinue::02_CoreCall',
    'B02_DrivingLicence_06_DrivingLicenceDataContinue::03_AddStub',
    'B02_DrivingLicence_07_AddrDataContinue',
    'B02_DrivingLicence_07_AddrDataContinue::01_AddStub',
    'B02_DrivingLicence_07_AddrDataContinue::02_CoreCall',
    'B02_DrivingLicence_07_AddrDataContinue::03_FraudStub',
    'B02_DrivingLicence_08_FraudDataContinue',
    'B02_DrivingLicence_08_FraudDataContinue::01_FraudStub',
    'B02_DrivingLicence_08_FraudDataContinue::02_CoreCall',
    'B02_DrivingLicence_09_PreKBVTransition',
    'B02_DrivingLicence_09_PreKBVTransition::01_CoreCall',
    'B02_DrivingLicence_09_PreKBVTransition::02_KBVStub',
    'B02_DrivingLicence_10_KBVDataContinue',
    'B02_DrivingLicence_10_KBVDataContinue::01_KBVStub',
    'B02_DrivingLicence_10_KBVDataContinue::02_CoreCall',
    'B02_DrivingLicence_11_ContinueDrivingLicenceSuccessPage',
    'B02_DrivingLicence_11_ContinueDrivingLicenceSuccessPage::01_CoreCall',
    'B02_DrivingLicence_11_ContinueDrivingLicenceSuccessPage::02_OrchStub'
  ],
  idReuse: [
    'B03_IDReuse_01_LoginToCore',
    'B03_IDReuse_01_LoginToCore::01_OrchStub',
    'B03_IDReuse_01_LoginToCore::02_CoreCall',
    'B03_IDReuse_02_ClickContinue',
    'B03_IDReuse_02_ClickContinue::01_CoreCall',
    'B03_IDReuse_02_ClickContinue::02_OrchStub'
  ]
} as const;

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
};

export function setup(): void {
  describeProfile(loadProfile);
}

interface IDReuseUserID {
  userID: string;
  emailID: string;
}

const csvData: IDReuseUserID[] = new SharedArray('ID Reuse User ID', function () {
  return open('./data/idReuseTestData.csv')
    .split('\n')
    .slice(1)
    .map((s) => {
      const data = s.split(',');
      return { userID: data[0], emailID: data[1] };
    });
});

const environment = getEnv('ENVIRONMENT').toLocaleUpperCase();
const validEnvironments = ['BUILD', 'DEV'];
if (!validEnvironments.includes(environment))
  throw new Error(`Environment '${environment}' not in [${validEnvironments.toString()}]`);

const env = {
  orchStubEndPoint: __ENV[`IDENTITY_${environment}_ORCH_STUB_URL`],
  ipvCoreURL: __ENV[`IDENTITY_${environment}_CORE_URL`]
  // staticResources: getEnv('K6_NO_STATIC_RESOURCES') !== 'true'
};

const stubCreds = {
  userName: getEnv('IDENTITY_ORCH_STUB_USERNAME'),
  password: getEnv('IDENTITY_ORCH_STUB_PASSWORD')
};

export function passport(): void {
  const groups = groupMap.passport;
  let res: Response;
  const credentials = `${stubCreds.userName}:${stubCreds.password}`;
  const encodedCredentials = encoding.b64encode(credentials);
  const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:]/g, ''); // YYMMDDTHHmm
  const iteration = execution.scenario.iterationInInstance.toString().padStart(6, '0');
  const testEmail = `perftest${timestamp}${iteration}@digital.cabinet-office.gov.uk`;
  iterationsStarted.add(1);
  // B01_Passport_01_LaunchOrchestratorStub
  res = group(groups[0], () =>
    timeRequest(
      () =>
        http.get(env.orchStubEndPoint, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('Enter userId manually') }
    )
  );

  const userId = getUserId(res);
  const signInJourneyId = getSignInJourneyId(res);

  sleepBetween(0.5, 1);

  // B01_Passport_02_GoToFullJourneyRoute
  res = group(groups[1], () =>
    timeRequest(
      () => {
        const response = http.get(
          env.orchStubEndPoint +
            `/authorize?journeyType=full&userIdText=${userId}&signInJourneyIdText=${signInJourneyId}&vtrText=Cl.Cm.P2&targetEnvironment=${environment}&reproveIdentity=NOT_PRESENT&emailAddress=${testEmail}&votText=&jsonPayload=&evidenceJsonPayload=&error=recoverable`,
          {
            headers: { Authorization: `Basic ${encodedCredentials}` }
          }
        );
        // if (env.staticResources) getStaticResources(response)
        return response;
      },
      {
        isStatusCode200,
        ...pageContentCheck('Tell us if you have one of the following types of photo ID')
      }
    )
  );

  sleepBetween(0.5, 1);

  // B01_Passport_03_ClickContinueStartPage
  group(groups[2], () => {
    timeRequest(() => {
      // 01_CoreCall
      res = group(groups[3].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: { journey: 'next' },
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_DCMAWStub
      res = group(groups[4].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('DOC Checking App (Stub)')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B01_Passport_04_DCMAWContinue
  group(groups[5], () => {
    timeRequest(() => {
      // 01_DCMAWStub
      res = group(groups[6].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: {
                requested_oauth_error_endpoint: 'auth',
                requested_oauth_error: 'access_denied'
              },
              params: { redirects: 1 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_CoreCall
      res = group(groups[7].split('::')[1], () =>
        timeRequest(() => http.get(env.ipvCoreURL + res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('Enter your UK passport details and answer security questions online')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B01_Passport_05_ContinueOnPYIStartPage
  group(groups[8], () => {
    timeRequest(() => {
      // 01_CoreCall
      res = group(groups[9].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: { journey: 'next/passport' },
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_PassStub
      res = group(groups[10].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('UK Passport (Stub)')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B01_Passport_06_PassportDataContinue
  group(groups[11], () => {
    timeRequest(() => {
      // 01_PassStub
      res = group(groups[12].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: {
                jsonPayload: passportPayload,
                strengthScore: '4',
                validityScore: '2'
              },
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_CoreCall
      res = group(groups[13].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location, { redirects: 0 }), {
          isStatusCode302
        })
      );
      // 03_AddStub
      res = group(groups[14].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('Address (Stub)')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B01_Passport_07_AddrDataContinue
  group(groups[15], () => {
    timeRequest(() => {
      // 01_AddStub
      res = group(groups[16].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: { jsonPayload: addressPayloadP },
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_CoreCall
      res = group(groups[17].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location, { redirects: 0 }), {
          isStatusCode302
        })
      );
      // 03_FraudStub
      res = group(groups[18].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('Fraud Check (Stub)')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B01_Passport_08_FraudDataContinue
  group(groups[19], () => {
    timeRequest(() => {
      // 01_FraudStub
      res = group(groups[20].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: {
                jsonPayload: fraudPayloadP,
                identityFraudScore: '2'
              },
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_CoreCall
      res = group(groups[21].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('Answer security questions')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B01_Passport_09_PreKBVTransition
  group(groups[22], () => {
    timeRequest(() => {
      // 01_CoreCall
      res = group(groups[23].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_KBVStub
      res = group(groups[24].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('Knowledge Based Verification (Stub)')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B01_Passport_10_KBVDataContinue
  group(groups[25], () => {
    timeRequest(() => {
      // 01_KBVStub
      res = group(groups[26].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: {
                jsonPayload: kbvPayloadP,
                verificationScore: '2'
              },
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_CoreCall
      res = group(groups[27].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('You’ve successfully proved your identity')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B01_Passport_11_ContinuePYISuccessPage
  group(groups[28], () => {
    timeRequest(() => {
      // 01_CoreCall
      res = group(groups[29].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_OrchStub
      res = group(groups[30].split('::')[1], () =>
        timeRequest(
          () =>
            http.get(res.headers.Location, {
              headers: { Authorization: `Basic ${encodedCredentials}` }
            }),
          { isStatusCode200, ...pageContentCheck('User information') }
        )
      );
    }, {});
  });
  iterationsCompleted.add(1);
}

export function drivingLicence(): void {
  const groups = groupMap.drivingLicence;
  let res: Response;
  const credentials = `${stubCreds.userName}:${stubCreds.password}`;
  const encodedCredentials = encoding.b64encode(credentials);
  const timestamp = new Date().toISOString().slice(2, 16).replace(/[-:]/g, ''); // YYMMDDTHHmm
  const iteration = execution.scenario.iterationInInstance.toString().padStart(6, '0');
  const testEmail = `perftest${timestamp}${iteration}@digital.cabinet-office.gov.uk`;
  iterationsStarted.add(1);

  // B02_DrivingLicence_01_LaunchOrchestratorStub
  res = group(groups[0], () =>
    timeRequest(
      () =>
        http.get(env.orchStubEndPoint, {
          headers: { Authorization: `Basic ${encodedCredentials}` }
        }),
      { isStatusCode200, ...pageContentCheck('Enter userId manually') }
    )
  );
  const userId = getUserId(res);
  const signInJourneyId = getSignInJourneyId(res);

  sleepBetween(0.5, 1);

  // B02_DrivingLicence_02_SelectUserIDContinue
  res = group(groups[1], () =>
    timeRequest(
      () => {
        const response = http.get(
          env.orchStubEndPoint +
            `/authorize?journeyType=full&userIdText=${userId}&signInJourneyIdText=${signInJourneyId}&vtrText=Cl.Cm.P2&targetEnvironment=${environment}&reproveIdentity=NOT_PRESENT&emailAddress=${testEmail}&votText=&jsonPayload=&evidenceJsonPayload=&error=recoverable`,
          {
            headers: { Authorization: `Basic ${encodedCredentials}` }
          }
        );
        // if (env.staticResources) getStaticResources(response)
        return response;
      },
      {
        isStatusCode200,
        ...pageContentCheck('Tell us if you have one of the following types of photo ID')
      }
    )
  );

  sleepBetween(0.5, 1);

  // B02_DrivingLicence_03_ContinueStartPage
  group(groups[2], () => {
    timeRequest(() => {
      // 01_CoreCall
      res = group(groups[3].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: { journey: 'next' },
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_DCMAWStub
      res = group(groups[4].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('DOC Checking App (Stub)')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B02_DrivingLicence_04_DCMAWContinue
  group(groups[5], () => {
    timeRequest(() => {
      // 01_DCMAWStub
      res = group(groups[6].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: {
                requested_oauth_error_endpoint: 'auth',
                requested_oauth_error: 'access_denied'
              },
              params: { redirects: 1 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_CoreCall
      res = group(groups[7].split('::')[1], () =>
        timeRequest(() => http.get(env.ipvCoreURL + res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('Enter your UK photocard driving licence details and answer security questions online')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B02_DrivingLicence_05_ContinueOnPYIStartPage
  group(groups[8], () => {
    timeRequest(() => {
      // 01_CoreCall
      res = group(groups[9].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: { journey: 'next/driving-licence' },
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_DLStub
      res = group(groups[10].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('Driving Licence (Stub)')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B02_DrivingLicence_06_DrivingLicenceDataContinue
  group(groups[11], () => {
    timeRequest(() => {
      // 01_DLStub
      res = group(groups[12].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: {
                jsonPayload: drivingLicencePayload,
                strengthScore: '3',
                validityScore: '2',
                activityHistoryScore: '1'
              },
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_CoreCall
      res = group(groups[13].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location, { redirects: 0 }), {
          isStatusCode302
        })
      );
      // 03_AddStub
      res = group(groups[14].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('Address (Stub)')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B02_DrivingLicence_07_AddrDataContinue
  group(groups[15], () => {
    timeRequest(() => {
      // 01_AddStub
      res = group(groups[16].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: { jsonPayload: addressPayloadDL },
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_CoreCall
      res = group(groups[17].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location, { redirects: 0 }), {
          isStatusCode302
        })
      );
      // 03_FraudStub
      res = group(groups[18].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('Fraud Check (Stub)')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B02_DrivingLicence_08_FraudDataContinue
  group(groups[19], () => {
    timeRequest(() => {
      // 01_FraudStub
      res = group(groups[20].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: {
                jsonPayload: fraudPayloadDL,
                identityFraudScore: '2',
                activityHistoryScore: '2'
              },
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_CoreCall
      res = group(groups[21].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('Answer security questions')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B02_DrivingLicence_09_PreKBVTransition
  group(groups[22], () => {
    timeRequest(() => {
      // 01_CoreCall
      res = group(groups[23].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_KBVStub
      res = group(groups[24].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('Knowledge Based Verification (Stub)')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B02_DrivingLicence_10_KBVDataContinue
  group(groups[25], () => {
    timeRequest(() => {
      // 01_KBVStub
      res = group(groups[26].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: {
                jsonPayload: kbvPayloaDL,
                verificationScore: '2'
              },
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_CoreCall
      res = group(groups[27].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('Continue to the service you want to use')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B02_DrivingLicence_11_ContinueDrivingLicenceSuccessPage
  group(groups[28], () => {
    timeRequest(() => {
      // 01_CoreCall
      res = group(groups[29].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              params: { redirects: 0 }
            }),
          { isStatusCode302 }
        )
      );
      // 02_OrchStub
      res = group(groups[30].split('::')[1], () =>
        timeRequest(
          () =>
            http.get(res.headers.Location, {
              headers: { Authorization: `Basic ${encodedCredentials}` }
            }),
          { isStatusCode200, ...pageContentCheck('User information') }
        )
      );
    }, {});
  });
  iterationsCompleted.add(1);
}

export function idReuse(): void {
  const groups = groupMap.idReuse;
  let res: Response;
  const credentials = `${stubCreds.userName}:${stubCreds.password}`;
  const encodedCredentials = encoding.b64encode(credentials);
  const idReuseUserID = csvData[Math.floor(Math.random() * csvData.length)];
  iterationsStarted.add(1);
  const signInJourneyId = uuidv4();

  // B03_IDReuse_01_LoginToCore
  group(groups[0], () => {
    timeRequest(() => {
      // 01_OrchStub
      res = group(groups[1].split('::')[1], () =>
        timeRequest(
          () =>
            http.get(
              env.orchStubEndPoint +
                `/authorize?journeyType=full&userIdText=${idReuseUserID.userID}&signInJourneyIdText=${signInJourneyId}&vtrText=P2&targetEnvironment=${environment}&reproveIdentity=NOT_PRESENT&emailAddress=${idReuseUserID.emailID}&votText=&jsonPayload=&evidenceJsonPayload=&error=recoverable`,
              {
                headers: { Authorization: `Basic ${encodedCredentials}` },
                redirects: 0
              }
            ),
          { isStatusCode302 }
        )
      );
      // 02_CoreCall
      res = group(groups[2].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('You have already proved your identity')
        })
      );
    }, {});
  });

  sleepBetween(0.5, 1);

  // B03_IDReuse_02_ClickContinue
  group(groups[3], () => {
    timeRequest(() => {
      // 01_CoreCall
      res = group(groups[4].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: { submitButton: '' },
              params: { redirects: 0 },
              submitSelector: '#continue'
            }),
          { isStatusCode302 }
        )
      );
      // 02_OrchStub
      res = group(groups[5].split('::')[1], () =>
        timeRequest(
          () =>
            http.get(res.headers.Location, {
              headers: { Authorization: `Basic ${encodedCredentials}` }
            }),
          { isStatusCode200, ...pageContentCheck('User information') }
        )
      );
    }, {});
  });
  iterationsCompleted.add(1);
}

function getUserId(r: Response): string {
  return r.html().find("input[name='userIdText']").val() ?? 'User ID not found';
}

function getSignInJourneyId(r: Response): string {
  return r.html().find("input[name='signInJourneyIdText']").val() ?? 'Sign In Journey ID not found';
}
