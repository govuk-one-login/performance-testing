import http from 'k6/http'
import { timeGroup } from '../../common/utils/request/timing'
import { config } from '../utils/config'
import { isStatusCode201 } from '../../common/utils/checks/assertions'
import { apiSignaturev4Signer } from '../utils/apiSignatureV4Signer'

export function postSetupBiometricSessionByScenario(
  groupName: string,
  testData: { biometricSessionId: string; opaqueId: string }
): void {
  const { biometricSessionId, opaqueId } = testData
  const requestBody = getRequestBody(opaqueId)
  const signedRequest = apiSignaturev4Signer.sign({
    method: 'POST',
    protocol: 'https',
    hostname: getHostName(),
    path: getPathParameter(biometricSessionId),
    body: requestBody,
    headers: {}
  })

  timeGroup(groupName, () => http.post(signedRequest.url, requestBody, { headers: signedRequest.headers }), {
    isStatusCode201
  })
}

function getRequestBody(opaqueId: string) {
  return JSON.stringify({
    scenario: 'PASSPORT_SUCCESS',
    overrides: {
      opaqueId,
      creationDate: new Date().toISOString()
    }
  })
}

function getHostName(): string {
  return new URL(config.readidMockApiUrl).hostname
}

function getPathParameter(biometricSessionId: string): string {
  return `/v2/setupBiometricSessionByScenario/${biometricSessionId}`
}
