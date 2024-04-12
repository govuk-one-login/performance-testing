import http from 'k6/http'
import { type Options } from 'k6/options'
import { check, sleep } from 'k6'

export const options: Options = {
  duration: '1m',
  vus: 5,
  thresholds: {
    http_req_duration: ['p(95)<500']
  }
}

export default function (): void {
  const response = http.get('https://home.build.account.gov.uk/')
  check(response, {
    'is status 200': (r) => r.status === 200
  })
  sleep(2)
}
