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

export function postTxmaEvent(groupName: string, eventName: string, accessToken: string, credentialId?: string) {
  const nowInMilliseconds = Date.now()
  const requestBody = {
    component_id: 'WALLET',
    timestamp: Math.floor(nowInMilliseconds / 1000),
    event_timestamp_ms: nowInMilliseconds,
    event_name: eventName,
    restricted: {
      credential_id: credentialId
    },
    extensions: {
      credential_type: ['mock_credential_type_1', 'mock_credential_type_2'],
      installation_id: 'mock_installation_id'
    }
  }

  timeGroup(
    groupName,
    () => {
      return http.post(`${config.mobileBackendBaseUrl}/txma-event`, JSON.stringify(requestBody), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: ` Bearer ${accessToken}`
        }
      })
    },
    {
      isStatusCode200
    }
  )
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
