import http from 'k6/http'
import { timeGroup } from '../../common/utils/request/timing'
import { config } from '../utils/config'
import { isStatusCode200 } from '../../common/utils/checks/assertions'

export function postBiometricToken(groupName: string, sessionId: string): string {
  const asyncBiometricTokenBody = {
    sessionId,
    documentType: 'NFC_PASSPORT'
  }

  const response = timeGroup(
    groupName,
    () => http.post(getAsyncBiometricTokenUrl(), JSON.stringify(asyncBiometricTokenBody)),
    {
      isStatusCode200
    }
  )

  return response.json('opaqueId') as string
}

function getAsyncBiometricTokenUrl() {
  return `${config.sessionsApiUrl}/async/biometricToken`
}
