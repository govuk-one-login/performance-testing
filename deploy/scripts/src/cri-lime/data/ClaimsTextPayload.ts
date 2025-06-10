export const claimsTextPayload = JSON.stringify({
  '@context': [
    'https://www.w3.org/2018/credentials/v1',
    'https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld'
  ],
  name: [
    {
      nameParts: [
        {
          type: 'GivenName',
          value: 'KENNETH'
        },
        {
          type: 'FamilyName',
          value: 'DECERQUEIRA'
        }
      ]
    }
  ],
  birthDate: [
    {
      value: '1965-07-08'
    }
  ],
  drivingPermit: [
    {
      personalNumber: 'DECER607085K99AE',
      expiryDate: '2035-05-01',
      issueDate: '2025-05-02',
      issueNumber: '17',
      issuedBy: 'DVLA',
      fullAddress: '8 HADLEY ROAD BATH BA2 5AA'
    }
  ]
})
