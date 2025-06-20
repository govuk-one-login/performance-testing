import http from 'k6/http'
import { timeGroup } from '../../common/utils/request/timing'
import { config } from '../utils/config'
import { isStatusCode200 } from '../../common/utils/checks/assertions'

export function getWellknownJwks(groupName: string): void {
  timeGroup(groupName, () => http.get(getWellKnownJwksUrl()), {
    isStatusCode200
  })
}

function getWellKnownJwksUrl() {
  return `${config.sessionsApiUrl}/.well-known/jwks.json`
}
