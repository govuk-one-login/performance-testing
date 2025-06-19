import http from 'k6/http'
import { timeGroup } from '../../common/utils/request/timing'
import { config } from '../utils/config'
import { isStatusCode200 } from '../../common/utils/checks/assertions'

export function postAbortSession(groupName: string, sessionId: string): void {
  const asyncAbortSessionBody = {
    sessionId
  }

  timeGroup(groupName, () => http.post(getAsyncAbortSessionUrl(), JSON.stringify(asyncAbortSessionBody)), {
    isStatusCode200
  })
}

function getAsyncAbortSessionUrl() {
  return `${config.sessionsApiUrl}/async/abortSession`
}
