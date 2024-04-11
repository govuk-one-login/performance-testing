import {
  iterationsStarted,
  iterationsCompleted
} from '../common/utils/custom_metric/counter';
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
import { env, encodedCredentials } from './utils/config';
import { timeRequest } from '../common/utils/request/timing';
import {
  isStatusCode200,
  isStatusCode302,
  pageContentCheck
} from '../common/utils/checks/assertions';
import { sleepBetween } from '../common/utils/sleep/sleepBetween';
import { getEnv } from '../common/utils/config/environment-variables';
import { getThresholds } from '../common/utils/config/thresholds';

const profiles: ProfileList = {
  smoke: {
    ...createScenario('kbv', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('kbv', LoadProfile.short, 5)
  },
  stress: {
    ...createScenario('kbv', LoadProfile.full, 14)
  }
};

const loadProfile = selectProfile(profiles);
const groupMap = {
  kbvScenario1: [
    'B01_KBV_01_CoreStubEditUserContinue',
    'B01_KBV_02_KBVQuestion1',
    'B01_KBV_03_KBVQuestion2',
    'B01_KBV_04_KBVQuestion3',
    'B01_KBV_04_KBVQuestion3::01_KBVCRICall',
    'B01_KBV_04_KBVQuestion3::02_CoreStubCall'
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

const kbvAnswersOBJ = {
  kbvAnswers: getEnv('IDENTITY_KBV_ANSWERS')
};

export function kbv(): void {
  const groups = groupMap.kbvScenario1;
  let res: Response;
  interface kbvAnswers {
    kbvAns1: string;
    kbvAns2: string;
    kbvAns3: string;
  }
  const kbvAnsJSON: kbvAnswers = JSON.parse(kbvAnswersOBJ.kbvAnswers);
  iterationsStarted.add(1);

  // B01_KBV_01_CoreStubEditUserContinue
  res = group(groups[0], () =>
    timeRequest(
      () =>
        http.get(
          env.ipvCoreStub +
            '/authorize?cri=kbv-cri-' +
            env.envName +
            '&rowNumber=197',
          {
            headers: { Authorization: `Basic ${encodedCredentials}` }
          }
        ),
      {
        isStatusCode200,
        ...pageContentCheck('You can find this amount on your loan agreement')
      }
    )
  );

  sleepBetween(1, 3);

  // B01_KBV_02_KBVQuestion1
  res = group(groups[1], () =>
    timeRequest(
      () =>
        res.submitForm({
          fields: { Q00042: kbvAnsJSON.kbvAns1 },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('This includes any interest') }
    )
  );

  sleepBetween(1, 3);

  // B01_KBV_03_KBVQuestion2
  res = group(groups[2], () =>
    timeRequest(
      () =>
        res.submitForm({
          fields: { Q00015: kbvAnsJSON.kbvAns2 },
          submitSelector: '#continue'
        }),
      {
        isStatusCode200,
        ...pageContentCheck(
          'Think about the amount you agreed to pay back every month'
        )
      }
    )
  );

  sleepBetween(1, 3);

  // B01_KBV_04_KBVQuestion3
  group(groups[3], () => {
    timeRequest(() => {
      // 01_KBVCRICall
      res = group(groups[4].split('::')[1], () =>
        timeRequest(
          () =>
            res.submitForm({
              fields: { Q00018: kbvAnsJSON.kbvAns3 },
              params: { redirects: 2 },
              submitSelector: '#continue'
            }),
          { isStatusCode302 }
        )
      );
      // 02_CoreStubCall
      res = group(groups[5].split('::')[1], () =>
        timeRequest(
          () =>
            http.get(res.headers.Location, {
              headers: { Authorization: `Basic ${encodedCredentials}` }
            }),
          {
            isStatusCode200,
            ...pageContentCheck('verificationScore&quot;: 2')
          }
        )
      );
    }, {});
  });
  iterationsCompleted.add(1);
}
