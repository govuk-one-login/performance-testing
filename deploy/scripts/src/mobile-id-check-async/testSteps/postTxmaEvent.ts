import http from 'k6/http'
import { timeGroup } from '../../common/utils/request/timing'
import { config } from '../utils/config'
import { isStatusCode200 } from '../../common/utils/checks/assertions'

export function postTxmaEvent(groupName: string, sessionId: string): void {
  const asyncTxmaEventBody = {
    sessionId,
    eventName: 'DCMAW_ASYNC_HYBRID_BILLING_STARTED'
  }

  timeGroup(groupName, () => http.post(getAsyncTxmaEventUrl(), JSON.stringify(asyncTxmaEventBody)), {
    isStatusCode200
  })
}

function getAsyncTxmaEventUrl() {
  return `${config.sessionsApiUrl}/async/txmaEvent`
}
