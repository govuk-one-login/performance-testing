import http from "k6/http"
import { timeGroup } from "../../common/utils/request/timing"
import { groupMap } from "../test"
import { config } from "../utils/config"
import { isStatusCode200 } from "../../common/utils/checks/assertions"

export function postAbortSession(sessionId: string): void {

  const asyncAbortSessionBody = {
    sessionId,
  };

  timeGroup(groupMap.idCheckAsync[9], () => http.post(getAsyncAbortSessionUrl(), JSON.stringify(asyncAbortSessionBody)), {
    isStatusCode200
  })
}

function getAsyncAbortSessionUrl() {
  return `${config.sessionsApiUrl}/async/abortSession`
}