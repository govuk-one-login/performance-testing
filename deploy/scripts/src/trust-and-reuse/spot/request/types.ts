interface LogIds {
  session_id: string
  client_id: string
  persistent_session_id: string
  client_session_id: string
  request_id: string
}

export interface SpotRequest {
  in_claims: {
    'https://vocab.account.gov.uk/v1/credentialJWT': string[]
    vot: string
    vtm: string
  }
  in_local_account_id: string
  in_salt: string
  out_audience: string
  out_sub: string
  in_rp_sector_id: string
  log_ids: LogIds
}

export interface SpotRequestInfo {
  host: string
  sector: string
  salt: string
}

export type IdentityCheckType = 'IDENTITY_CHECK' | 'IdentityCheck'
export type NamePartType = 'GivenName' | 'FamilyName'
export type VerifiableCredentialType =
  | 'IdentityCheckCredential'
  | 'VerifiableCredential'
  | 'VerifiableIdentityCredential'
  | 'IdentityAssertionCredential'
  | 'AddressCredential'
  | 'RiskAssessmentCredential'
  | 'SecurityCheckCredential'

export interface FraudPayload {
  sub: string
  nbf: number
  iss: string
  vc: {
    evidence: [
      {
        identityFraudScore: number
        txn: string
        type: IdentityCheckType
      }
    ]
    credentialSubject: {
      address: [
        {
          addressCountry: string
          buildingName: string
          streetName: string
          postalCode: string
          buildingNumber: string
          addressLocality: string
          validFrom: string
        }
      ]
      name: [
        {
          nameParts: [
            {
              type: NamePartType
              value: string
            },
            {
              type: NamePartType
              value: string
            }
          ]
        }
      ]
      birthDate: [
        {
          value: string
        }
      ]
    }
    type: VerifiableCredentialType[]
    '@context': string[]
  }
}

export interface PassportPayload {
  sub: string
  nbf: number
  iss: string
  vc: {
    evidence: [
      {
        validityScore: number
        strengthScore: number
        txn: string
        type: IdentityCheckType
      }
    ]
    credentialSubject: {
      passport: [
        {
          expiryDate: string
          icaoIssuerCode: string
          documentNumber: string
        }
      ]
      name: [
        {
          nameParts: [
            {
              type: NamePartType
              value: string
            },
            {
              type: NamePartType
              value: string
            }
          ]
        }
      ]
      birthDate: [
        {
          value: string
        }
      ]
    }
    type: VerifiableCredentialType[]
    '@context': string[]
  }
}

export interface KBVPayload {
  sub: string
  nbf: number
  iss: string
  vc: {
    evidence: [
      {
        verificationScore: number
        txn: string
        type: IdentityCheckType
      }
    ]
    credentialSubject: {
      address: [
        {
          addressCountry: string
          buildingName: string
          streetName: string
          postalCode: string
          buildingNumber: string
          addressLocality: string
          validFrom: string
        }
      ]
      name: [
        {
          nameParts: [
            {
              type: NamePartType
              value: string
            },
            {
              type: NamePartType
              value: string
            }
          ]
        }
      ]
      birthDate: [
        {
          value: string
        }
      ]
    }
    type: VerifiableCredentialType[]
    '@context': string[]
  }
}
