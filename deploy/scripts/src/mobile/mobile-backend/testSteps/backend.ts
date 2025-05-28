import { timeGroup } from '../../../common/utils/request/timing'
import http from 'k6/http'
import { isStatusCode200 } from '../../../common/utils/checks/assertions'
import { config } from '../utils/config'

export function getAppInfo(groupName: string): void {
  timeGroup(
    groupName,
    () => {
      return http.get(`${config.mobileBackendBaseUrl}/appInfo`)
    },
    {
      isStatusCode200
    }
  )
}

export function postClientAttestation(groupName: string, publicKeyJwk: JsonWebKey, appCheckToken: string): string {
  const requestBody = {
    jwk: {
      kty: publicKeyJwk.kty,
      use: 'sig',
      crv: publicKeyJwk.crv,
      x: publicKeyJwk.x,
      y: publicKeyJwk.y
    }
  }

  const res = timeGroup(
    groupName,
    () => {
      return http.post(`${config.mobileBackendBaseUrl}/client-attestation`, JSON.stringify(requestBody), {
        headers: {
          'Content-Type': 'application/json',
          'X-Firebase-AppCheck': appCheckToken
        }
      })
    },
    {
      isStatusCode200
    }
  )
  return res.json('client_attestation') as string
}

export function simulateCallToMobileBackendJwks(groupName: string): void {
  timeGroup(
    groupName,
    () => {
      return http.get(`${config.mobileBackendBaseUrl}/.well-known/jwks.json`)
    },
    {
      isStatusCode200
    }
  )
}
