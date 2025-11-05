import { uuidv4 } from '../../../common/utils/jslib/index'

interface statusListIssuePayload {
  iss: string
  iat: number
  jti: string
  statusExpiry: number
}

export function generateIssuePayload(clientID: string): statusListIssuePayload {
  return {
    iss: clientID,
    iat: Math.floor(Date.now() / 1000),
    jti: uuidv4(),
    statusExpiry: Math.floor(Date.now() / 1000) + 1000 //statusExpiry must be equal to or later than the credential’s technical expiry date, known as the validUntil property.
  }
}

interface statusListRevokePayload {
  iss: string
  iat: number
  jti: string
  uri: string
  idx: number
}

export function generateRevokePayload(
  clientID: string,
  issuedAt: number,
  uriValue: string,
  idx: number
): statusListRevokePayload {
  return {
    iss: clientID,
    iat: issuedAt,
    jti: uuidv4(),
    uri: uriValue,
    idx: idx
  }
}
