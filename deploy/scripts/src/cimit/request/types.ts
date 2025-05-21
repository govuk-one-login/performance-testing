type IdentityCheckType = 'IDENTITY_CHECK' | 'IdentityCheck'
type NamePartType = 'GivenName' | 'FamilyName'
type VerifiableCredentialType =
  | 'IdentityCheckCredential'
  | 'VerifiableCredential'
  | 'VerifiableIdentityCredential'
  | 'IdentityAssertionCredential'
  | 'AddressCredential'
  | 'RiskAssessmentCredential'
  | 'SecurityCheckCredential'

type IdentityCheckPolicyType = 'none' | 'published' | 'money_laundering_regulations' | 'physical_or_biometric_official'

type CheckMethodType =
  | 'vpip'
  | 'vpiruv'
  | 'vri'
  | 'vdig'
  | 'vcrypt'
  | 'data'
  | 'auth'
  | 'token'
  | 'kbv'
  | 'pvp'
  | 'pvr'
  | 'bvp'
  | 'bvr'

interface PassportDetailsClass {
  documentNumber: string
  expiryDate: string
  icaoIssuerCode: string
}

interface DrivingLicenseDetailsClass {
  issuedBy?: string
  issueDate?: string
  personalNumber?: string
  expiryDate: string
  issueNumber?: string
}

interface NamePartClass {
  type: NamePartType
  value: string
}

interface NameClass {
  nameParts: NamePartClass[]
}
interface BirthDateClass {
  value: string
}

interface CheckDetailsClass {
  identityCheckPolicy?: IdentityCheckPolicyType
  activityFrom?: string
  checkMethod?: CheckMethodType
}

export interface PassportPayload {
  sub: string
  nbf: number
  iat?: number
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
      passport: PassportDetailsClass[]
      name: NameClass[]
      birthDate: BirthDateClass[]
    }
    '@context': string[]
  }
}

export interface DrivingLicensePayload {
  sub: string
  nbf: number
  iat?: number
  iss: string
  vc: {
    type: VerifiableCredentialType[]
    evidence: [
      {
        type: IdentityCheckType
        validityScore: number
        strengthScore: number
        activityHistoryScore?: number
        checkDetails?: CheckDetailsClass[]
        txn: string
      }
    ]
    credentialSubject: {
      drivingPermit: DrivingLicenseDetailsClass[]
      name: NameClass[]
      birthDate: BirthDateClass[]
    }
    '@context': string[]
  }
}
