import http from 'k6/http'
import { timeGroup } from '../../common/utils/request/timing'
import { config } from '../utils/config'
import { isStatusCode200 } from '../../common/utils/checks/assertions'

export function postFinishBiometricSession(
  groupName: string,
  testData: { biometricSessionId: string; sessionId: string }
): void {
  const asyncFinishBiometricSessionBody = {
    sessionId: testData.sessionId,
    biometricSessionId: testData.biometricSessionId
  }

  timeGroup(
    groupName,
    () => http.post(getAsyncFinishBiometricSessionUrl(), JSON.stringify(asyncFinishBiometricSessionBody)),
    {
      isStatusCode200
    }
  )
}

function getAsyncFinishBiometricSessionUrl() {
  return `${config.sessionsApiUrl}/async/finishBiometricSession`
}
