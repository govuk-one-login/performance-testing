type VerifiableCredentialType =
  | 'IdentityCheckCredential'
  | 'VerifiableCredential'
  | 'VerifiableIdentityCredential'
  | 'IdentityAssertionCredential'
  | 'AddressCredential'
  | 'RiskAssessmentCredential'
  | 'SecurityCheckCredential'

interface MitigatingCredentialClass {
  id?: string
  issuer?: string
  txn?: string
  validFrom?: string
}

interface MitigationClass {
  code?: string
  mitigatingCredential?: MitigatingCredentialClass[]
}

interface ContraIndicatorClass {
  code?: string
  issuanceDate?: string
  document?: string
  txn?: string[]
  issuers?: string[]
  incompleteMitigation?: MitigationClass[]
  mitigation?: MitigationClass[]
}

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
        contraIndicator?: ContraIndicatorClass[]
      }
    ]
  }
}
