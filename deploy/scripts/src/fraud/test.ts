import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { getAccessToken } from '../common/utils/authorization/authorization'
import { timeGroup } from '../common/utils/request/timing'
import http, { RefinedParams, ResponseType } from 'k6/http'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { getEnv } from '../common/utils/config/environment-variables'
import { type Response } from 'k6/http'
import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { check, fail } from 'k6'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('fraud', LoadProfile.smoke)
  },
  load: {
    ...createScenario('fraud', LoadProfile.short, 3, 3)
  },
  stress: {
    ...createScenario('fraud', LoadProfile.full, 2500, 3)
  }
}

const loadProfile = selectProfile(profiles)

const env = {
  cognitoURL: getEnv('FRAUD_COGNITO_URL'),
  clientId: getEnv('FRAUD_CLIENT_ID'),
  clientSecret: getEnv('FRAUD_CLIENT_SECRET'),
  ssfInboundUrl: getEnv('FRAUD_SSF_INBOUND_URL'),
  fraudPayload: getEnv('FRAUD_PAYLOAD')
}

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: {
    http_req_duration: ['p(95)<=1000', 'p(99)<=2500'], // 95th percentile response time <=1000ms, 99th percentile response time <=2500ms
    http_req_failed: ['rate<0.05'] // Error rate <5%
  }
}

export function setup(): RefinedParams<ResponseType> {
  describeProfile(loadProfile)

  const res: Response = http.post(
    env.cognitoURL + '/oauth2/token',
    {
      grant_type: 'client_credentials',
      scope: `messages/write`,
      client_id: env.clientId,
      client_secret: env.clientSecret
    },
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  )
  console.log('Cognito status code:', res.status, res.status_text)
  console.log('Cognito response:', res.body)
  const ok = check(res, { isStatusCode200, ...pageContentCheck('token') })
  if (!ok) {
    fail('Failed to get token from Cognito')
  }
  const accessToken = getAccessToken(res)
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }
}

export function fraud(data: RefinedParams<ResponseType>): void {
  iterationsStarted.add(1)
  timeGroup('B01_fraud_01_SendSignedEventToSSF', () => http.post(env.ssfInboundUrl, env.fraudPayload, data), {
    isStatusCode202: r => r.status === 202,
    ...pageContentCheck('Id')
  })
  iterationsCompleted.add(1)
}
