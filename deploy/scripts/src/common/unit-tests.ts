import { type JSONValue, check, group, sleep } from 'k6';
import TOTP from './utils/authentication/totp';
import {
  type Profile,
  type ProfileList,
  selectProfile,
  createScenario,
  LoadProfile,
  type ScenarioList
} from './utils/config/load-profiles';
import { AWSConfig, SQSClient } from './utils/jslib/aws-sqs';
import {
  findBetween,
  normalDistributionStages,
  randomIntBetween,
  randomItem,
  randomString,
  uuidv4
} from './utils/jslib';
import { URL, URLSearchParams } from './utils/jslib/url';
import { timeFunction, timeRequest } from './utils/request/timing';
import { sleepBetween } from './utils/sleep/sleepBetween';
import { isStatusCode200, isStatusCode201, isStatusCode302, pageContentCheck } from './utils/checks/assertions';
import { type RefinedResponse, type ResponseType, type Response } from 'k6/http';
import { type Selection } from 'k6/html';
import { iterationsCompleted, iterationsStarted } from './utils/custom_metric/counter';
import { type GroupMap, type Thresholds, getThresholds } from './utils/config/thresholds';
import { getEnv } from './utils/config/environment-variables';
import { type RampingArrivalRateScenario } from 'k6/options';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1.00'],
    iterations_started: ['count===1'],
    iterations_completed: ['count===1']
  }
};

export default (): void => {
  iterationsStarted.add(1);
  group('authentication/totp', () => {
    // Examples from https://www.rfc-editor.org/rfc/rfc6238
    const sha1seed = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // Ascii string "12345678901234567890" in base32
    const sha256seed = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA===='; // 32 byte seed
    const sha512seed =
      'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA='; // 64 byte seed
    const sha1otp = new TOTP(sha1seed, 8, 'sha1');
    const sha256otp = new TOTP(sha256seed, 8, 'sha256');
    const sha512otp = new TOTP(sha512seed, 8, 'sha512');

    check(null, {
      '| SHA1   | T+59          |': () => sha1otp.generateTOTP(59 * 1000) === '94287082',
      '| SHA256 | T+1111111109  |': () => sha256otp.generateTOTP(1111111109 * 1000) === '68084774',
      '| SHA512 | T+1111111111  |': () => sha512otp.generateTOTP(1111111111 * 1000) === '99943326',
      '| SHA1   | T+1234567890  |': () => sha1otp.generateTOTP(1234567890 * 1000) === '89005924',
      '| SHA256 | T+2000000000  |': () => sha256otp.generateTOTP(2000000000 * 1000) === '90698825',
      '| SHA512 | T+20000000000 |': () => sha512otp.generateTOTP(20000000000 * 1000) === '47863826'
    });
  });

  group('checks/assertion', () => {
    const response: Response = blankResponse();

    group('status code checks', () => {
      response.status = 200;
      check(response, { isStatusCode200 });
      response.status = 201;
      check(response, { isStatusCode201 });
      response.status = 302;
      check(response, { isStatusCode302 });
    });

    group('pageContentCheck()', () => {
      const title = 'Page Title';
      response.body = `<html><body><h1>${title}</h1></body></html>`;
      check(response, { ...pageContentCheck(title) });
    });
  });

  group('config/env-vars', () => {
    group('getEnv()', () => {
      let errorFound = false;
      try {
        getEnv('NON_EXISTENT');
      } catch (error) {
        errorFound = true;
      }

      const name = 'EXISTING VARIABLE';
      const value = 'sampleValue1';
      __ENV[name] = value;

      check(null, {
        'Error when not variable not found': () => errorFound,
        'Undefined when not found and not required': () => getEnv('NON_EXISTENT', false) === undefined,
        'Value retrieved correctly': () => getEnv(name) === value
      });
    });
  });

  group('config/load-profiles', () => {
    group('selectProfile()', () => {
      const profiles: ProfileList = {
        smoke: {
          'scenario-1a': {
            executor: 'constant-vus',
            duration: '1s'
          },
          'scenario-1b': {
            executor: 'shared-iterations'
          }
        },
        stress: {
          'scenario-2a': {
            executor: 'ramping-vus',
            stages: []
          },
          'scenario-2b': {
            executor: 'externally-controlled',
            duration: '2s'
          },
          'scenario-2c': {
            executor: 'per-vu-iterations'
          }
        }
      };

      const noFlags = selectProfile(profiles);
      const profileOnly = selectProfile(profiles, { profile: 'stress' });
      const singleScenario = selectProfile(profiles, {
        profile: 'smoke',
        scenario: 'scenario-1b'
      });
      const multiScenario = selectProfile(profiles, {
        profile: 'stress',
        scenario: 'scenario-2a,scenario-2b'
      });
      const scenarioAll = selectProfile(profiles, {
        profile: 'smoke',
        scenario: 'all'
      });
      const scenarioBlank = selectProfile(profiles, {
        profile: 'stress',
        scenario: ''
      });

      function checkProfile(profile: Profile, name: string, scenarioCount: number): boolean {
        return profile.name === name && Object.keys(profile.scenarios).length === scenarioCount;
      }

      check(null, {
        'No Flags             ': () => checkProfile(noFlags, 'smoke', 2), // Default profile is smoke
        'Profile Only         ': () => checkProfile(profileOnly, 'stress', 3), // All scenarios for given profile enabled
        'Single Scenario      ': () => checkProfile(singleScenario, 'smoke', 1), // Only specified scenario enabled
        'Multi Scenario       ': () => checkProfile(multiScenario, 'stress', 2), // Only specified scenarios enabled
        'Scenario "all" String': () => checkProfile(scenarioAll, 'smoke', 2), // All scenarios enabled
        'Scenario Empty String': () => checkProfile(scenarioBlank, 'stress', 3) // All scenarios enabled
      });
    });

    group('createScenario()', () => {
      const scenarios: ScenarioList = {
        ...createScenario('scenario1', LoadProfile.smoke),
        ...createScenario('scenario2', LoadProfile.smoke, 1),
        ...createScenario('scenario3', LoadProfile.short, 20),
        ...createScenario('scenario4', LoadProfile.full, 50, 10),
        ...createScenario('scenario5', LoadProfile.deployment, 2, 40)
      };

      function checkScenario(exec: string, target: number, maxVUs: number): boolean {
        const scenario = scenarios[exec] as RampingArrivalRateScenario;
        return (
          scenario.exec === exec && // Exec function is named correctly
          scenario.maxVUs === maxVUs && // Max VUs = Max throughput * max iteration duration
          Math.max(...scenario.stages.map((s) => s.target)) === target
        ); // Max thoughput target is correct
      }

      check(null, {
        'Default target/duration': () => checkScenario('scenario1', 1, 1),
        'Smoke load profile     ': () => checkScenario('scenario2', 1, 1),
        'Short load profile     ': () => checkScenario('scenario3', 20, 600),
        'Full load profile      ': () => checkScenario('scenario4', 50, 500),
        'Deployment load profile': () => checkScenario('scenario5', 2, 80)
      });
    });
  });

  group('config/thresholds', () => {
    const groups: GroupMap = {
      scenario1: ['group1a', 'group1b', 'group1c'],
      scenario2: ['group2a', 'group2b'],
      scenario3: ['group3a']
    };

    const noGroups: Thresholds = getThresholds({});
    const noFlags: Thresholds = getThresholds(groups);
    const singleScenario: Thresholds = getThresholds(groups, 'scenario1');
    const multiScenario: Thresholds = getThresholds(groups, 'scenario1,scenario2');
    const scenarioAll: Thresholds = getThresholds(groups, 'all');
    const scenarioBlank: Thresholds = getThresholds(groups, '');

    function checkThresholds(thresholds: Thresholds, count: number): boolean {
      return (
        thresholds !== undefined &&
        Object.keys(thresholds).length === count + 2 && // Threshold count is equal to no. of groups plus the base two
        Object.keys(thresholds).filter((s) => s.includes('duration{group:::')).length === count
      ); // Group duration thresholds equals no. of groups
    }

    check(null, {
      'No Group             ': () => checkThresholds(noGroups, 0), // No group thresholds included
      'No Flags             ': () => checkThresholds(noFlags, 6), // Default all scenarios enabled
      'Single Scenario      ': () => checkThresholds(singleScenario, 3), // Only specified scenario enabled
      'Multi Scenario       ': () => checkThresholds(multiScenario, 5), // Only specified scenarios enabled
      'Scenario "all" String': () => checkThresholds(scenarioAll, 6), // All scenarios enabled
      'Scenario Empty String': () => checkThresholds(scenarioBlank, 6) // All scenarios enabled
    });
  });

  group('jslib/aws-sqs', () => {
    const config = new AWSConfig({
      region: 'eu-west-2',
      accessKeyId: 'A'.repeat(16),
      secretAccessKey: 'X'.repeat(16)
    });
    const client = new SQSClient(config);

    check(null, {
      'AWSConfig.fromEnvironment() exists': () => typeof AWSConfig.fromEnvironment === 'function',
      'SQSClient.listQueues() exists': () => typeof client.listQueues === 'function',
      'SQSClient.sendMessage() exists': () => typeof client.sendMessage === 'function'
    });
  });

  group('jslib/index', () => {
    group('findBetween()', () => {
      const response = '<div class="message">Message 1</div><div class="message">Message 2</div>';
      const message = findBetween(response, '<div class="message">', '</div>');
      const allMessages = findBetween(response, '<div class="message">', '</div>', true);

      check(null, {
        'Single value': () => typeof message === 'string' && message === 'Message 1',
        'Multiple values': () => typeof allMessages === 'object' && allMessages.length === 2
      });
    });

    group('normalDistributionStages()', () => {
      const settings = {
        maxVUs: randomIntBetween(20, 1000),
        duration: randomIntBetween(60, 600),
        numberOfStages: randomIntBetween(5, 20)
      };
      const stages = normalDistributionStages(settings.maxVUs, settings.duration, settings.numberOfStages);
      const totalDuration = stages.reduce((a, b) => {
        return a + parseInt(b.duration.slice(0, -1));
      }, 0);
      const maxVUs = stages.reduce((a, b) => {
        return a > b.target ? a : b.target;
      }, 0);

      const tenStages = normalDistributionStages(settings.maxVUs, settings.duration);

      check(null, {
        'Max VUs': () => maxVUs === settings.maxVUs,
        'Total duration': () => totalDuration >= settings.duration,
        'Number of stages': () => stages.length === settings.numberOfStages + 2,
        'Default is 10 (+2) stages': () => tenStages.length === 10 + 2
      });
    });

    group('randomIntBetween()', () => {
      const twelve = randomIntBetween(12, 12);
      const random = randomIntBetween(12, 24);

      check(null, {
        'Value in range': () => random >= 12 && random <= 24,
        'Is integer': () => Math.floor(random) === random,
        'Exact value': () => twelve === 12
      });
    });

    group('randomItem()', () => {
      const names = ['John', 'Jane', 'Bert', 'Ed'];
      const randomName = randomItem(names);
      const randomStage = randomItem(normalDistributionStages(100, 120));

      check(null, {
        'Random string': () => typeof randomName === 'string' && names.includes(randomName),
        'Random stage': () => typeof randomStage.duration === 'string' && typeof randomStage.target === 'number'
      });
    });

    group('randomString()', () => {
      const random = randomString(8);
      const dashes = randomString(5, '-');
      const randomCharacterWeighted = randomString(1, 'AAAABBBCCD');

      check(null, {
        'Random string': () => random.length === 8,
        'Repeated character': () => dashes === '-----',
        'Random character': () => ['A', 'B', 'C', 'D'].includes(randomCharacterWeighted)
      });
    });

    group('uuidv4()', () => {
      const uuid = uuidv4();
      const secureUuid = uuidv4(true);
      const regex = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/;

      check(null, {
        'Valid uuid v4': () => regex.test(uuid),
        'Valid uuid v4 (secure)': () => regex.test(secureUuid)
      });
    });
  });

  group('jslib/url', () => {
    const url = new URL('https://account.gov.uk/path/to/page?query=val&q=2#anchor');
    const relative = new URL('../new', url);
    const absolute = new URL('/root', url);

    group('URL', () => {
      check(null, {
        'host property': () => url.hostname === 'account.gov.uk',
        'origin property': () => url.origin === 'https://account.gov.uk',
        'pathname property': () => url.pathname === '/path/to/page',
        'protocol property': () => url.protocol === 'https:',
        'search property': () => url.search === '?query=val&q=2',
        'Relative redirect': () => relative.href === 'https://account.gov.uk/path/new',
        'Absolute redirect': () => absolute.href === 'https://account.gov.uk/root'
      });
    });

    const paramsString = new URLSearchParams(url.search);
    const paramsObject = new URLSearchParams({ param: '4', search: 'term' });
    paramsObject.append('append', 'New Value');
    paramsObject.delete('param');
    group('URLSearchParams', () => {
      check(null, {
        'has()': () => paramsString.has('query', 'val'),
        'get()': () => paramsObject.get('search') === 'term',
        'getAll()': () => paramsString.getAll('q').join() === '2',
        'append() & delete()': () => paramsObject.toString() === 'search=term&append=New+Value'
      });
    });
  });

  group('request/timing', () => {
    group('timeFunction()', () => {
      const [result, duration] = timeFunction(() => {
        const string = 'AB';
        sleep(1);
        return string + 'C';
      });

      check(null, {
        'check result is returned': () => result === 'ABC',
        'check duration is returned': () => typeof duration === 'number' && duration >= 1000
      });
    });

    group('timeRequest()', () => {
      timeRequest(
        () => {
          const string = 'BA';
          return 'C' + string;
        },
        {
          'check result': (s) => s === 'CBA'
        }
      );
    });
  });

  group('sleep/sleepBetween', () => {
    const time1 = Date.now();
    sleepBetween(0.2, 0.3); // Sleep between 200 to 300 milliseconds
    const time2 = Date.now();
    sleepBetween(2, 3); // Sleep between 2 to 3 seconds
    const time3 = Date.now();

    const diff1 = time2 - time1;
    const diff2 = time3 - time2;
    check(null, {
      'sleepBetween() 200-300ms': () => diff1 >= 200 && diff1 <= 350,
      'sleepBetween() 2-3s': () => diff2 >= 2000 && diff2 <= 3050
    });
  });
  iterationsCompleted.add(1);
};

function blankResponse(): Response {
  return {
    // Default Response values
    body: null,
    cookies: {},
    error: '',
    error_code: 0,
    headers: {},
    ocsp: {
      produced_at: 0,
      this_update: 0,
      next_update: 0,
      revocation_reason: '',
      revoked_at: 0,
      status: ''
    },
    proto: 'HTTP/1.0',
    remote_ip: '',
    remote_port: 0,
    request: { body: '', cookies: {}, headers: {}, method: '', url: '' },
    status: 0,
    status_text: '',
    timings: {
      blocked: 0,
      connecting: 0,
      tls_handshaking: 0,
      sending: 0,
      waiting: 0,
      receiving: 0,
      duration: 0
    },
    tls_cipher_suite: 'TLS_RSA_WITH_RC4_128_SHA',
    tls_version: '',
    url: '',
    clickLink: function <RT extends ResponseType | undefined>(): RefinedResponse<RT> {
      throw new Error('Function not implemented.');
    },
    html: function (): Selection {
      throw new Error('Function not implemented.');
    },
    json: function (): JSONValue {
      throw new Error('Function not implemented.');
    },
    submitForm: function <RT extends ResponseType | undefined>(): RefinedResponse<RT> {
      throw new Error('Function not implemented.');
    }
  };
}
