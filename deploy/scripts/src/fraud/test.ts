import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { getAccessToken } from '../cri-kiwi/utils/authorization'
import { timeGroup } from '../common/utils/request/timing'
import http from 'k6/http'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { getEnv } from '../common/utils/config/environment-variables'
import { type Response } from 'k6/http'
import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('fraud', LoadProfile.smoke)
  },
  load: {
    ...createScenario('fraud', LoadProfile.full, 500, 3)
  },
  stress: {
    ...createScenario('fraud', LoadProfile.full, 5000, 3)
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

export function setup(): void {
  describeProfile(loadProfile)
}

const env = {
  cognitoURL: getEnv('COGNITO_URL'),
  clientId: getEnv('CLIENT_ID'),
  clientSecret: getEnv('CLIENT_SECRET'),
  ssfInboundUrl: getEnv('SSF_INBOUND_URL'),
  fraudPayload: getEnv('FRAUD_PAYLOAD')
}

const groupMap = {
  fraud: ['B01_fraud_01_GenerateAccessToken', 'B01_fraud_02_SendSignedEventToSSF']
} as const

export function fraud(): void {
  const groups = groupMap.fraud
  const options = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }
  // B01_fraud_01_GenerateAccessToken
  iterationsStarted.add(1)
  const res: Response = timeGroup(
    groups[0],
    () =>
      http.post(
        env.cognitoURL + '/oauth2/token',
        {
          grant_type: 'client_credentials',
          scope: `messages/write`,
          client_id: env.clientId,
          client_secret: env.clientSecret
        },
        options
      ),
    { isStatusCode200, ...pageContentCheck('token') }
  )

  const accessToken = getAccessToken(res)
  const data = {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }

  // B01_fraud_02_SendSignedEventToSSF
  timeGroup(groups[1], () => http.post(env.ssfInboundUrl, env.fraudPayload, data), {
    isStatusCode202: r => r.status === 202,
    ...pageContentCheck('Id')
  })
  iterationsCompleted.add(1)
}
