export const passportPayload = JSON.stringify({
  passport: {
    passport: [
      {
        expiryDate: '2030-01-01',
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
        value: '1964-11-07'
      }
    ]
  }
}
)

export const addressPayloadP = JSON.stringify({
  address: {
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
  }
}
)

export const fraudPayloadP = JSON.stringify({
  fraud: {
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
        value: '1964-11-07'
      }
    ]
  }
}
)

export const kbvPayloadP = JSON.stringify({
  kbv: {
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
        value: '1964-11-07'
      }
    ]
  }
}
)
