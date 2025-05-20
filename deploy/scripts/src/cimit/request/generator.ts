import { PassportPayload } from '../request/types'
import { uuidv4 } from '../../common/utils/jslib'

export function generatePassportPayloadCI(sub: string): PassportPayload {
  return {
    sub: sub,
    nbf: Math.floor(Date.now() / 1000),
    iss: 'https://review-p.dev.account.gov.uk',
    vc: {
      evidence: [
        {
          validityScore: 2,
          strengthScore: 4,
          txn: uuidv4(),
          type: 'IdentityCheck',
          ci: ['D01']
        }
      ],
      credentialSubject: {
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
      },
      type: ['VerifiableCredential', 'IdentityCheckCredential'],
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld'
      ]
    }
  }
}

export function generatePassportPayloadMitigation(sub: string): PassportPayload {
  return {
    sub: sub,
    nbf: Math.floor(Date.now() / 1000),
    iss: 'https://review-p.dev.account.gov.uk',
    vc: {
      evidence: [
        {
          validityScore: 2,
          strengthScore: 4,
          txn: uuidv4(),
          type: 'IdentityCheck'
        }
      ],
      credentialSubject: {
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
      },
      type: ['VerifiableCredential', 'IdentityCheckCredential'],
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld'
      ]
    }
  }
}
