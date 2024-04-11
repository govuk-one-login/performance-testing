export interface BankingPayload {
  shared_claims: {
    name: [
      {
        nameParts: [
          {
            value: string;
            type: string;
          },
          {
            value: string;
            type: string;
          }
        ];
      }
    ];
    birthDate: [
      {
        value: string;
      }
    ];
  };
}

export const bankingPayload = JSON.stringify({
  shared_claims: {
    name: [
      {
        nameParts: [
          {
            value: 'Yasmine',
            type: 'GivenName'
          },
          {
            value: 'Young',
            type: 'FamilyName'
          }
        ]
      }
    ],
    birthDate: [
      {
        value: '1960-02-02'
      }
    ]
  }
} satisfies BankingPayload);
