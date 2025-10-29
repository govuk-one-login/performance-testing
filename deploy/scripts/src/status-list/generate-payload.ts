import { uuidv4 } from '../common/utils/jslib/index'

interface statusListIssuePayload {
  iss: string
  iat: number
  jti: string
  statusExpiry: number
}

export function generateIssuePayload(): statusListIssuePayload {
  return {
    iss: 'exampleclientIDabcd123',
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

export function generateRevokePayload(crUrl: string, idx: number): statusListRevokePayload {
  return {
    iss: 'exampleclientIDabcd123',
    iat: Math.floor(Date.now() / 1000),
    jti: uuidv4(),
    uri: `https://crs.account.gov.uk/t/${crUrl}`,
    idx: idx
  }
}
