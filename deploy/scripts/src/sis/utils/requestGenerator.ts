import { IdentityPayload } from './types'

export function generateIdentityPayload(sub: string): IdentityPayload {
  return {
    aud: 'https://reuse-identity.build.account.gov.uk',
    sub: sub,
    nbf: Math.floor(Date.now() / 1000),
    iss: 'https://identity.build.account.gov.uk',
    vot: 'P2',
    iat: Math.floor(Date.now() / 1000) - 10000,
    credentials: [
      'xUPW2AvpVTBzeFrJSwrJz47N4RA3Eveyr-uWgCYfxSoNmpSPvuQQgenfS7lxBzs4esP8NSch999SrS6IFTkl-g', //pragma: allowlist secret
      'ZcXdVTWbkurRCl854IkYWCZHqAAn2y5WVhoqXs1p-n8pbEyS3xWFCog-_cVtBVrYQdkxtIQJN4jr6265bbTohA', //pragma: allowlist secret
      'g610xpaS5QmLBWihiC9yc9iNcLIlm7U3BGvcqZGwj4PiLA1r5trOdSBZnJbk845INCAUXhMgn4TiIKmRk3g1cA' //pragma: allowlist secret
    ],
    claims: {
      'https://vocab.account.gov.uk/v1/coreIdentity': {
        name: [
          {
            nameParts: [
              {
                type: 'GivenName',
                value: 'MICHAEL'
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
        ]
      },
      'https://vocab.account.gov.uk/v1/address': [
        {
          addressCountry: 'GB',
          addressLocality: 'BATH',
          buildingName: '',
          buildingNumber: '8',
          postalCode: 'BA2 5AA',
          streetName: 'HADLEY ROAD',
          validFrom: '2000-01-01'
        }
      ],
      'https://vocab.account.gov.uk/v1/passport': [
        {
          documentNumber: '321654987',
          expiryDate: '2030-01-01',
          icaoIssuerCode: 'GBR'
        }
      ]
    }
  }
}
