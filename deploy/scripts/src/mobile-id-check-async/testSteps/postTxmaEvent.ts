import http from 'k6/http'
import { timeGroup } from '../../common/utils/request/timing'
import { groupMap } from '../test'
import { config } from '../utils/config'
import { isStatusCode200 } from '../../common/utils/checks/assertions'

export function postTxmaEvent(sessionId: string): void {
  const asyncTxmaEventBody = {
    sessionId,
    eventName: 'DCMAW_ASYNC_HYBRID_BILLING_STARTED'
  }

  timeGroup(groupMap.idCheckAsync[6], () => http.post(getAsyncTxmaEventUrl(), JSON.stringify(asyncTxmaEventBody)), {
    isStatusCode200
  })
}

function getAsyncTxmaEventUrl() {
  return `${config.sessionsApiUrl}/async/txmaEvent`
}
