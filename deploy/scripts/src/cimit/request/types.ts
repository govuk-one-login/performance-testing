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
    type?: VerifiableCredentialType[]
    evidence: [
      {
        type?: string
        contraIndicator?: [
          {
            code?: string
            issuanceDate?: string
            document?: string
            txn?: string[]
            mitigation?: [
              {
                code?: string
                mitigatingCredential?: [
                  {
                    issue?: string
                    txn?: string
                    validFrom?: string
                  }
                ]
              }
            ]
            incompleteMitigation?: [
              {
                code?: string
                mitigatingCredential?: [
                  {
                    issue?: string
                    txn?: string
                    validFrom?: string
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
