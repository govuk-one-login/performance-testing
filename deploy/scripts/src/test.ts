import http from 'k6/http'
import { type Options } from 'k6/options'
import { sleep } from 'k6'

export const options: Options = {
  duration: '1m',
  vus: 50,
  thresholds: {
    http_req_duration: ['p(95)<500']
  }
}

export default function (): void {
  http.get('https://test.k6.io')
  sleep(1)
}
