import { DrivingLicensePayload, PassportPayload } from '../request/types'
import { uuidv4 } from '../../../common/utils/jslib'

export function generatePassportPayloadCI(sub: string): PassportPayload {
  return {
    sub: sub,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000) - 10000,
    iss: 'https://passport-cri.account.gov.uk',
    vc: {
      evidence: [
        {
          validityScore: 2,
          strengthScore: 4,
          txn: uuidv4(),
          type: 'IdentityCheck',
          ci: ['D02']
        }
      ],
      credentialSubject: {
        passport: [
          {
            expiryDate: '2030-01-01',
            icaoIssuerCode: 'GBR',
            documentNumber: '44442444'
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
                type: 'FamilyName',
                value: 'Parker'
              }
            ]
          }
        ],
        birthDate: [
          {
            value: '1970-01-01'
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

export function generateDrivingLicensePayloadMitigation(sub: string): DrivingLicensePayload {
  return {
    sub: sub,
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    iss: 'https://driving-license-cri.account.gov.uk',
    vc: {
      evidence: [
        {
          type: 'IdentityCheck',
          validityScore: 2,
          strengthScore: 3,
          activityHistoryScore: 1,
          checkDetails: [
            {
              identityCheckPolicy: 'published',
              activityFrom: '1982-05-23',
              checkMethod: 'data'
            }
          ],
          txn: uuidv4()
        }
      ],
      credentialSubject: {
        drivingPermit: [
          {
            issuedBy: 'DVLA',
            issueDate: '2005-02-02',
            personalNumber: 'PARKE710112PBFGA',
            expiryDate: '2032-02-02',
            issueNumber: '23'
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
                type: 'FamilyName',
                value: 'Parker'
              }
            ]
          }
        ],
        birthDate: [
          {
            value: '1970-01-01'
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
