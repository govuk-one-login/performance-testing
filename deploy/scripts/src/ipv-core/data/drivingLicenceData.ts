export const passportPayloadDL = JSON.stringify({
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

export const addressPayloadDL = JSON.stringify({
  address: {
    address: [
      {
        buildingName: '80T',
        streetName: 'YEOMAN WAY',
        postalCode: 'BA14 0QP',
        addressLocality: 'TROWBRIDGE',
        validFrom: '1952-01-01'
      }
    ]
  }
}
)

export const fraudPayloadDL = JSON.stringify({
  fraud: {
    address: [
      {
        buildingName: '80T',
        streetName: 'YEOMAN WAY',
        postalCode: 'BA14 0QP',
        addressLocality: 'TROWBRIDGE',
        validFrom: '1952-01-01'
      }
    ],
    name: [
      {
        nameParts: [
          {
            type: 'GivenName',
            value: 'Alice'
          },
          {
            type: 'GivenName',
            value: 'Jane'
          },
          {
            type: 'FamilyName',
            value: 'Par-ker'
          }
        ]
      }
    ],
    birthDate: [
      {
        value: '1970-01-01'
      }
    ]
  }
}
)

export const kbvPayloaDL = JSON.stringify({
  kbv: {
    address: [
      {
        buildingName: '80T',
        streetName: 'YEOMAN WAY',
        postalCode: 'BA14 0QP',
        addressLocality: 'TROWBRIDGE',
        validFrom: '1952-01-01'
      }
    ],
    name: [
      {
        nameParts: [
          {
            type: 'GivenName',
            value: 'Aliçe'
          },
          {
            type: 'GivenName',
            value: 'Jane'
          },
          {
            type: 'FamilyName',
            value: 'Parkér'
          }
        ]
      }
    ],
    birthDate: [
      {
        value: '1970-01-01'
      }
    ]
  }
}
)

export const drivingLicencePayload = JSON.stringify({
  drivingLicence: {
    name: [
      {
        nameParts: [
          {
            type: 'GivenName',
            value: 'Alice'
          },
          {
            type: 'GivenName',
            value: 'Jane'
          },
          {
            type: 'FamilyName',
            value: 'Parker'
          }
        ]
      }
    ],
    drivingPermit: [
      {
        expiryDate: '2032-02-02',
        issuedBy: 'DVLA',
        personalNumber: 'PARKE710112PBFGA',
        issueDate: '2005-02-02'
      }
    ],
    birthDate: [
      {
        value: '1970-01-01'
      }
    ]
  }
}

)
