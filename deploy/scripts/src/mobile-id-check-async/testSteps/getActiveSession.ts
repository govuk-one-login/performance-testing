import http from 'k6/http'
import { timeGroup } from '../../common/utils/request/timing'
import { groupMap } from '../test'
import { config } from '../utils/config'
import { isStatusCode200 } from '../../common/utils/checks/assertions'
import { sleepBetween } from '../../common/utils/sleep/sleepBetween'

export function getActiveSession(sub: string): string {
  const stsMockRequestBody = new URLSearchParams({
    subject_token: sub,
    scope: 'idCheck.activeSession.read',
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token'
  })

  const stsMockResponse = timeGroup(
    groupMap.idCheckAsync[2],
    () => http.post(getStsTokenUrl(), stsMockRequestBody.toString()),
    {
      isStatusCode200
    }
  )

  const accessToken = stsMockResponse.json('access_token') as string

  sleepBetween(0.5, 1)

  const asyncActiveSessionResponse = timeGroup(
    groupMap.idCheckAsync[3],
    () =>
      http.get(getAsyncActiveSessionUrl(), {
        headers: { Authorization: getAsyncActiveSessionAuthorizationHeader(accessToken) }
      }),
    {
      isStatusCode200
    }
  )

  return asyncActiveSessionResponse.json('sessionId') as string
}

function getStsTokenUrl() {
  return `${config.stsMockApiUrl}/token`
}

function getAsyncActiveSessionUrl() {
  return `${config.sessionsApiUrl}/async/activeSession`
}

function getAsyncActiveSessionAuthorizationHeader(accessToken: string) {
  return `Bearer ${accessToken}`
}
