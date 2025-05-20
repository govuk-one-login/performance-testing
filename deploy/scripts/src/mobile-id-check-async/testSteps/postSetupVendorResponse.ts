import http from 'k6/http'
import { timeGroup } from '../../common/utils/request/timing'
import { groupMap } from '../test'
import { config } from '../utils/config'
import { isStatusCode201 } from '../../common/utils/checks/assertions'
import { apiSignaturev4Signer } from '../utils/apiSignatureV4Signer'

export function postSetupVendorResponse(testData: { biometricSessionId: string; opaqueId: string }): void {
  const biometricSession = JSON.parse(config.biometricSessionTestData)

  const setupVendorResponseBody = {
    ...biometricSession,
    opaqueId: testData.opaqueId,
    creationDate: new Date().toISOString()
  }

  const signedRequest = apiSignaturev4Signer.sign({
    method: 'POST',
    protocol: 'https',
    hostname: new URL(config.readidMockApiUrl).hostname,
    path: getSetupVendorResponsePath(testData.biometricSessionId),
    body: JSON.stringify(setupVendorResponseBody),
    headers: {}
  })

  timeGroup(
    groupMap.idCheckAsync[7],
    () => http.post(signedRequest.url, JSON.stringify(setupVendorResponseBody), { headers: signedRequest.headers }),
    {
      isStatusCode201
    }
  )
}

function getSetupVendorResponsePath(biometricSessionId: string): string {
  return `/v2/setupVendorResponse/${biometricSessionId}`
}
