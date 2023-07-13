import { sleep, group, check, fail } from 'k6'
import { type Options } from 'k6/options'
import http, { type Response } from 'k6/http'
import { Trend } from 'k6/metrics'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'

const profiles: ProfileList = {
  smoke: {
    idReuse: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 1,
      stages: [
        { target: 1, duration: '60s' } // Ramps up to target load
      ],
      exec: 'idReuse'
    }

  },
  load: {
    idReuse: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 1,
      maxVUs: 45,
      stages: [
        { target: 3, duration: '15m' }, // Ramps up to target load
        { target: 3, duration: '15m' }, // Steady State of 15 minutes at the ramp up load i.e. 3 iterations/second
        { target: 0, duration: '5m' } // Ramp down duration of 5 minutes.
      ],
      exec: 'idReuse'
    }

  }
}

const loadProfile = selectProfile(profiles)

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'], // 95th percentile response time <=1000ms, 99th percentile response time <=2500ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
}

export function setup (): void {
  describeProfile(loadProfile)
}

const transactionDuration = new Trend('duration')

const env = {
  envURL: __ENV.ACCOUNT_BRAVO_ID_REUSE_URL,
  envMock: __ENV.ACCOUNT_BRAVO_ID_REUSE_MOCK,
  envApiKey: __ENV.ACCOUNT_BRAVO_ID_REUSE_API_KEY,
  envApiKeySummarise: __ENV.ACCOUNT_BRAVO_ID_REUSE_API_KEY_SUMMARISE
}
export function idReuse (): void {
  let res: Response
  let token: string
  group('R01_idReuse_01_GenerateToken POST', function () {
    const startTime = Date.now()
    res = http.post(env.envMock + '/generate',
      JSON.stringify({
        sub: 'ValidTest'
      }),
      {
        tags: { name: 'R01_idReuse_01_GenerateToken' }
      })
    const endTime = Date.now()
    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('token')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    token = getToken(res)
  })

  sleep(Math.random() * 3)

  group('R02_idReuse_02_CreateVC POST', function () {
    const startTime = Date.now()
    const options = {
      headers: {
        Authorization: token,
        'x-api-key': env.envApiKey
      },
      tags: { name: 'R02_idReuse_02_CreateVC' }
    }
    const body = JSON.stringify([
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.LeLQg33PXWySMBwXi0KnJsKwO3Cb7a2pd501orGEyEo', // pragma: allowlist secret
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvbiBEb2UiLCJpYXQiOjE1MTYyMzkwMjJ9.6PIinUiv_RExeCq3XlTQqIAPqLv_jkpeFtqDc1PcWwQ' // pragma: allowlist secret
    ])
    res = http.post(env.envURL + '/vcs/ValidTest', body, options)
    const endTime = Date.now()
    check(res, {
      'is status 202': (r) => r.status === 202,
      'verify page content': (r) => (r.body as string).includes('messageId')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  sleep(Math.random() * 3)

  group('R01_idReuse_03_Retrieve GET', function () {
    const startTime = Date.now()
    const options = {
      headers: {
        Authorization: token,
        'x-api-key': env.envApiKey
      },
      tags: { name: 'R01_idReuse_03_Retrieve' }
    }
    res = http.get(env.envURL + '/vcs/ValidTest', options)
    const endTime = Date.now()
    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('vcs')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })

  group('R01_idReuse_04_GenerateTokenSummary POST', function () {
    const startTime = Date.now()
    res = http.post(env.envMock + '/generate',
      JSON.stringify({
        sub: 'ValidTest',
        aud: 'accountManagementAudience',
        ttl: 120
      }),
      {
        tags: { name: 'R01_idReuse_04_GenerateTokenSummary' }
      })
    const endTime = Date.now()
    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('token')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
    token = getToken(res)
  })

  group('R01_idReuse_05_Summarise GET', function () {
    const startTime = Date.now()
    const options = {
      headers: {
        Authorization: token,
        'x-api-key': env.envApiKeySummarise
      },
      tags: { name: 'R01_idReuse_05_Summarise' }
    }
    res = http.get(env.envURL + '/summarise-vcs/ValidTest', options)
    const endTime = Date.now()
    check(res, {
      'is status 200': (r) => r.status === 200,
      'verify page content': (r) => (r.body as string).includes('vcs')
    })
      ? transactionDuration.add(endTime - startTime)
      : fail('Response Validation Failed')
  })
}

function getToken (r: Response): string {
  const token = r.json('token')
  if (token !== null && typeof token === 'string') return token
  fail('token not found')
}
