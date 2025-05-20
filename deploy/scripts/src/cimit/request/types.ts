export type IdentityCheckType = 'IDENTITY_CHECK' | 'IdentityCheck'
export type NamePartType = 'GivenName' | 'FamilyName'
type VerifiableCredentialType =
  | 'IdentityCheckCredential'
  | 'VerifiableCredential'
  | 'VerifiableIdentityCredential'
  | 'IdentityAssertionCredential'
  | 'AddressCredential'
  | 'RiskAssessmentCredential'
  | 'SecurityCheckCredential'

export interface PassportPayload {
  sub: string
  nbf: number
  iss: string
  vc: {
    type: VerifiableCredentialType[]
    evidence: [
      {
        type: IdentityCheckType
        validityScore: number
        strengthScore: number
        txn: string
        ci?: string[]
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
    '@context': string[]
  }
}
