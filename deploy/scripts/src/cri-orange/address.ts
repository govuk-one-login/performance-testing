import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter';
import { group, fail } from 'k6';
import { type Options } from 'k6/options';
import http, { type Response } from 'k6/http';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles';
import { env, encodedCredentials } from './utils/config';
import { timeRequest } from '../common/utils/request/timing';
import { isStatusCode200, isStatusCode302, pageContentCheck } from '../common/utils/checks/assertions';
import { sleepBetween } from '../common/utils/sleep/sleepBetween';
import { getThresholds } from '../common/utils/config/thresholds';

const profiles: ProfileList = {
  smoke: {
    ...createScenario('address', LoadProfile.smoke)
  },
  lowVolume: {
    ...createScenario('address', LoadProfile.short, 30)
  },
  stress: {
    ...createScenario('address', LoadProfile.full, 65)
  }
};

const loadProfile = selectProfile(profiles);
const groupMap = {
  address: [
    'B02_Address_01_AddressCRIEntryFromStub',
    'B02_Address_01_AddressCRIEntryFromStub::01_CoreStubCall',
    'B02_Address_01_AddressCRIEntryFromStub::02_AddCRICall',
    'B02_Address_02_SearchPostCode',
    'B02_Address_03_SelectAddress',
    'B02_Address_04_VerifyAddress',
    'B02_Address_05_ConfirmDetails',
    'B02_Address_05_ConfirmDetails::01_AddCRICall',
    'B02_Address_05_ConfirmDetails::02_CoreStubCall'
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

interface Address {
  postcode: string;
}

const csvData1: Address[] = new SharedArray('csvDataAddress', () => {
  return open('./data/addressCRIData.csv')
    .split('\n')
    .slice(1)
    .map((postcode) => {
      return {
        postcode
      };
    });
});

export function address(): void {
  const groups = groupMap.address;
  let res: Response;
  const user1Address = csvData1[exec.scenario.iterationInTest % csvData1.length];
  iterationsStarted.add(1);

  // B02_Address_01_AddressCRIEntryFromStub
  group(groups[0], () => {
    timeRequest(() => {
      // 01_CoreStubCall
      res = group(groups[1].split('::')[1], () =>
        timeRequest(
          () =>
            http.get(env.ipvCoreStub + '/credential-issuer?cri=address-cri-' + env.envName, {
              redirects: 0,
              headers: { Authorization: `Basic ${encodedCredentials}` }
            }),
          { isStatusCode302 }
        )
      );
      // 02_AddCRICall
      res = group(groups[2].split('::')[1], () =>
        timeRequest(() => http.get(res.headers.Location), {
          isStatusCode200,
          ...pageContentCheck('Find your address')
        })
      );
    }, {});
  });

  sleepBetween(1, 3);

  // B02_Address_02_SearchPostCode
  res = group(groups[3], () =>
    timeRequest(
      () =>
        res.submitForm({
          fields: { addressSearch: user1Address.postcode },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Choose your address') }
    )
  );

  const fullAddress = res.html().find('select[name=addressResults]>option').last().val() ?? fail('Address not found');

  // B02_Address_03_SelectAddress
  res = group(groups[4], () =>
    timeRequest(
      () =>
        res.submitForm({
          fields: { addressResults: fullAddress },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Check your address') }
    )
  );

  sleepBetween(1, 3);

  // B02_Address_04_VerifyAddress
  res = group(groups[5], () =>
    timeRequest(
      () =>
        res.submitForm({
          fields: { addressYearFrom: '2021' },
          submitSelector: '#continue'
        }),
      { isStatusCode200, ...pageContentCheck('Confirm your details') }
    )
  );

  sleepBetween(1, 3);

  // B02_Address_05_ConfirmDetails
  group(groups[6], () => {
    timeRequest(() => {
      // 01_AddCRICall
      res = group(groups[7].split('::')[1], () =>
        timeRequest(() => res.submitForm({ params: { redirects: 1 } }), {
          isStatusCode302
        })
      );
      // 02_CoreStubCall
      res = group(groups[8].split('::')[1], () =>
        timeRequest(
          () =>
            http.get(res.headers.Location, {
              headers: { Authorization: `Basic ${encodedCredentials}` }
            }),
          { isStatusCode200, ...pageContentCheck('Verifiable Credentials') }
        )
      );
    }, {});
  });
  iterationsCompleted.add(1);
}
