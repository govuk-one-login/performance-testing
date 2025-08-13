type NamePartType = 'GivenName' | 'FamilyName'

interface PassportDetailsClass {
  documentNumber: string
  expiryDate: string
  icaoIssuerCode: string
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

interface PostalAddressClass {
  addressCountry?: string
  addressLocality?: string
  buildingName?: string
  buildingNumber?: string
  postalCode?: string
  streetName?: string
  validFrom?: string
}

export interface IdentityPayload {
  aud?: string
  sub: string
  nbf: number
  iss: string
  vot?: string
  iat?: number
  credentials: string[]
  claims: {
    'https://vocab.account.gov.uk/v1/coreIdentity': {
      name: NameClass[]
      birthDate: BirthDateClass[]
    }
    'https://vocab.account.gov.uk/v1/address': PostalAddressClass[]
    'https://vocab.account.gov.uk/v1/passport': PassportDetailsClass[]
  }
}
