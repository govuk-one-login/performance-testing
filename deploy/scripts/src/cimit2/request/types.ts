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

export interface CimitPayLoad {
  sub: string
  iss: string
  nbf: number
  iat: number
  exp: number
  vc: {
    type: VerifiableCredentialType[]
    evidence: [
      {
        type: IdentityCheckType
        txn: []
        contraIndicator: [
          {
            code: string
            issuanceDate: string
            document: string
            txn: [string]
            mitigation: [
              {
                mitigatingCredential: [
                  {
                    issuer: string
                    txn: string
                    validFrom: string
                  }
                ]
                code: string
              }
            ]
            incompleteMitigation: []
          }
        ]
      }
    ]
  }
}
