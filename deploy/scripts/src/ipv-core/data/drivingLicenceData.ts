export const addressPayloadDL = JSON.stringify({
  address: [
    {
      buildingName: '80T',
      streetName: 'YEOMAN WAY',
      postalCode: 'BA14 0QP',
      addressLocality: 'TROWBRIDGE',
      validFrom: '1952-01-01'
    }
  ]
});

export const fraudPayloadDL = JSON.stringify({
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
});

export const kbvPayloaDL = JSON.stringify({
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
});

export const drivingLicencePayload = JSON.stringify({
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
});
