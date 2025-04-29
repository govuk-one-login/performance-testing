import http from "k6/http"
import { timeGroup } from "../../common/utils/request/timing"
import { groupMap } from "../test"
import { config } from "../utils/config"
import { isStatusCode200 } from "../../common/utils/checks/assertions"

export function getWellknownJwks(): void {

  timeGroup(groupMap.idCheckAsync[5], () => http.get(getWellKnownJwksUrl()), {
    isStatusCode200
  })
}

function getWellKnownJwksUrl() {
  return `${config.sessionsApiUrl}/.well-known/jwks.json`
}