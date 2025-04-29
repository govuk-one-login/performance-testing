import { timeGroup } from '../../../common/utils/request/timing'
import http from 'k6/http'
import { isStatusCode200 } from '../../../common/utils/checks/assertions'
import { config } from '../utils/config'
import { groupMap } from '../../v2-mobile-backend-get-client-attestation'

export function getAppInfo(): void {
  timeGroup(
    groupMap.getClientAttestation[0],
    () => {
      return http.get(`${config.mobileBackendBaseUrl}/appInfo`)
    },
    {
      isStatusCode200
    }
  )
}

export function postClientAttestation(publicKeyJwk: JsonWebKey, appCheckToken: string): string {
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
    groupMap.getClientAttestation[2],
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

export function simulateCallToMobileBackendJwks(): void {
  timeGroup(
    groupMap.getClientAttestation[3],
    () => {
      return http.get(`${config.mobileBackendBaseUrl}/.well-known/jwks.json`)
    },
    {
      isStatusCode200
    }
  )
}
