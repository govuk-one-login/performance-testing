export const passportPayloadM1C = JSON.stringify({
  passport: [
    {
      expiryDate: '2030-01-01',
      icaoIssuerCode: 'GBR',
      documentNumber: '321654987'
    }
  ],
  name: [
    {
      nameParts: [
        {
          type: 'GivenName',
          value: 'Kenneth'
        },
        {
          type: 'FamilyName',
          value: 'Decerqueira'
        }
      ]
    }
  ],
  birthDate: [
    {
      value: '1965-07-08'
    }
  ]
})

export const chippedPassportPayloadM1C = JSON.stringify({
  type: 'IdentityCheck',
  strengthScore: '4',
  validityScore: '3',
  activityHistoryScore: '1',
  ci: [],
  checkDetails: [
    {
      checkDetails: 'vcrypt',
      identityCheckPolicy: 'published',
      activityFrom: ''
    },
    {
      checkMethod: 'bvr',
      biometricVerificationProcessLevel: '3'
    }
  ]
})

export const addressPayloadM1C = JSON.stringify({
  address: [
    {
      addressCountry: 'GB',
      buildingName: '',
      streetName: 'HADLEY ROAD',
      postalCode: 'BA2 5AA',
      buildingNumber: '8',
      addressLocality: 'BATH',
      validFrom: '2000-01-01'
    }
  ]
})

export const fraudPayloadM1C = JSON.stringify({
  address: [
    {
      addressCountry: 'GB',
      buildingName: '',
      streetName: 'HADLEY ROAD',
      postalCode: 'BA2 5AA',
      buildingNumber: '8',
      addressLocality: 'BATH',
      validFrom: '2000-01-01'
    }
  ],
  name: [
    {
      nameParts: [
        {
          type: 'GivenName',
          value: 'Kenneth'
        },
        {
          type: 'FamilyName',
          value: 'Decerqueira'
        }
      ]
    }
  ],
  birthDate: [
    {
      value: '1965-07-08'
    }
  ]
})

export const failedFraudCheckPayloadM1C = JSON.stringify({
  type: 'IdentityCheck',
  failedCheckDetails: [
    {
      checkMethod: 'data',
      fraudCheck: 'available_authoritative_source'
    }
  ]
})
