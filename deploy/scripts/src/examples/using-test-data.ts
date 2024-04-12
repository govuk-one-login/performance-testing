import { type Options } from 'k6/options';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

export const options: Options = {
  scenarios: {
    csv: {
      executor: 'shared-iterations',
      vus: 3,
      iterations: 8,
      exec: 'csv'
    },
    json: {
      executor: 'shared-iterations',
      vus: 3,
      iterations: 8,
      exec: 'json'
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<500']
  }
};

interface User {
  username: string;
  pass: string;
}
// Parse JSON data
// From https://k6.io/docs/examples/data-parameterization/#from-a-json-file
const jsonData: User[] = new SharedArray('json', function () {
  return JSON.parse(open('./data/example.json')).users;
});
// Parse CSV data
// Also https://k6.io/docs/examples/data-parameterization/#from-a-csv-file
const csvData: User[] = new SharedArray('csv', function () {
  return open('./data/example.csv')
    .split('\n')
    .slice(1)
    .map((s) => {
      const data = s.split(',');
      return { username: data[0], pass: data[1] };
    });
});

export function setup(): void {
  console.log('VU | Scenario | Username | Password');
}

export function csv(): void {
  const user = csvData[exec.scenario.iterationInTest % jsonData.length];
  console.log(exec.vu.idInTest, ' | csv      |', user.username, '   |', user.pass);
}

export function json(): void {
  const user = jsonData[exec.scenario.iterationInTest % jsonData.length];
  console.log(exec.vu.idInTest, ' | json     |', user.username, '   |', user.pass);
}
