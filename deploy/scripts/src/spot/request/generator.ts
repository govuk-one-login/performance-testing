import { IdentityCheckCredentialJWTClass } from '@govuk-one-login/data-vocab/credentials'
import { uuidv4 } from '../../common/utils/jslib'

export function generateFraudPayload(subID: string): IdentityCheckCredentialJWTClass {
  return {
    sub: subID,
    nbf: Math.floor(Date.now() / 1000),
    iss: 'https://fraudcri.dev.gov.uk',
    vc: {
      evidence: [
        {
          identityFraudScore: 2,
          txn: uuidv4(),
          type: 'IdentityCheck'
        }
      ],
      credentialSubject: {
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
      },
      type: ['VerifiableCredential', 'IdentityCheckCredential'],
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld'
      ]
    }
  }
}

export function generatePassportPayload(subID: string): IdentityCheckCredentialJWTClass {
  return {
    sub: subID,
    nbf: Math.floor(Date.now() / 1000),
    iss: 'https://passportcri.dev.gov.uk',
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

export function generateKBVPayload(subID: string): IdentityCheckCredentialJWTClass {
  return {
    sub: subID,
    nbf: Math.floor(Date.now() / 1000),
    iss: 'https://verificationcri.dev.gov.uk',
    vc: {
      evidence: [
        {
          verificationScore: 2,
          txn: uuidv4(),
          type: 'IdentityCheck'
        }
      ],
      credentialSubject: {
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
      },
      type: ['VerifiableCredential', 'IdentityCheckCredential'],
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld'
      ]
    }
  }
}

export function generateSPOTRequest(sub: string, config: SpotRequestInfo, jwts: string[]): SpotRequest {
  const currTime = new Date().toISOString().slice(2, 16).replace(/[-:]/g, '') // YYMMDDTHHmm
  const audClientID = uuidv4()
  return {
    in_claims: {
      'https://vocab.account.gov.uk/v1/credentialJWT': jwts,
      vot: 'P2',
      vtm: 'https://local.vtm'
    },
    in_local_account_id: config.host,
    in_rp_sector_id: config.sector,
    in_salt: config.salt,
    out_audience: audClientID,
    log_ids: {
      client_id: audClientID,
      persistent_session_id: uuidv4(),
      request_id: uuidv4() + '_' + currTime,
      session_id: uuidv4(),
      client_session_id: uuidv4()
    },
    out_sub: sub
  }
}
