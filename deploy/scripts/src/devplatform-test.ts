import http, { Response } from 'k6/http';
import { Options, Scenario } from 'k6/options';
import { check, group, sleep } from 'k6';

type ScenarioList = { [name: string]: Scenario };
type Profiles = { [name: string]: ScenarioList };

const profiles: Profiles = {
  smoke: {
    demo_sam_app: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1m',
      preAllocatedVUs: 1,
      maxVUs: 50,
      stages: [
        { target: 60, duration: '60s' },    //Ramps up to target load
        { target: 60, duration: '60s' },    //Holds at target load
      ],
      exec: 'demo_sam_app'
    },
    demo_node_waf: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1m',
      preAllocatedVUs: 1,
      maxVUs: 50,
      stages: [
        { target: 60, duration: '60s' },    //Ramps up to target load
        { target: 60, duration: '60s' },    //Holds at target load
      ],
      exec: 'demo_node_waf'
    },
  }
}

// Scenarios specified in --env SCENARIO flag (e.g. --env SCENARIO=sign_in,sign_up)
// Are added to the executed scenarios, otherwise all scenarios are run
let allScenarios = profiles['smoke'];
let enabledScenarios: { [name: string]: Scenario } = {};
if (__ENV.SCENARIO == null) {
  enabledScenarios = allScenarios;
}
else {
  __ENV.SCENARIO.split(',').forEach(scenario => enabledScenarios[scenario] = allScenarios[scenario]);
}

export const options: Options = {
  scenarios: enabledScenarios,
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95th percntile response time <500ms
    http_req_failed: ['rate<0.05'],   // Error rate <5%
  },
};

export function demo_sam_app() {
  let res: Response;

  group('GET - {BE URL}', function () {
    res = http.get(__ENV.BE_URL);

    check(res, {
      "is status 200": r => r.status === 200,
      'verify page content': r => (r.body as String).includes('Hello World'),
    });
  });

  sleep(1);
}

export function demo_node_waf() {
  let res: Response;

  group('GET - {FE URL}', function () {
    res = http.get(__ENV.FE_URL);

    check(res, {
      "is status 200": r => r.status === 200,
      'verify page content': r => (r.body as String).includes('hello world'),
    });
  });

  sleep(1);
}
