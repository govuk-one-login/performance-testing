import {
  IdentityCheckCredentialJWTClass,
  IdentityCheckClass,
  IdentityCheckSubjectClass,
  BirthDateClass,
  NameClass,
  PostalAddressClass
} from '@govuk-one-login/data-vocab/credentials'
import { uuidv4 } from '../../common/utils/jslib'
import { SpotRequest, SpotRequestInfo } from './types'

export enum Issuer {
  Fraud,
  Passport,
  KBV
}

export function generatePayload(sub: string, issuer: Issuer): IdentityCheckCredentialJWTClass {
  let iss: string
  let evidence: IdentityCheckClass[]
  let credentialSubject: IdentityCheckSubjectClass

  const address: PostalAddressClass[] = [
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
  const name: NameClass[] = [
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
  ]
  const birthDate: BirthDateClass[] = [
    {
      value: '1965-07-08'
    }
  ]

  switch (issuer) {
    case Issuer.Fraud:
      iss = 'https://review-f.dev.account.gov.uk'
      evidence = [
        {
          identityFraudScore: 2,
          txn: uuidv4(),
          type: 'IdentityCheck'
        }
      ]
      credentialSubject = {
        address,
        name,
        birthDate
      }
      break
    case Issuer.Passport:
      iss = 'https://review-p.dev.account.gov.uk'
      evidence = [
        {
          validityScore: 2,
          strengthScore: 4,
          txn: uuidv4(),
          type: 'IdentityCheck'
        }
      ]
      credentialSubject = {
        passport: [
          {
            expiryDate: '2030-01-01',
            icaoIssuerCode: 'GBR',
            documentNumber: '321654987'
          }
        ],
        name,
        birthDate
      }
      break
    case Issuer.KBV:
      iss = 'https://review-k.dev.account.gov.uk'
      evidence = [
        {
          verificationScore: 2,
          txn: uuidv4(),
          type: 'IdentityCheck'
        }
      ]
      credentialSubject = {
        address,
        name,
        birthDate
      }
      break
    default:
      throw new Error('Issuer not implemented')
  }

  return {
    sub: sub,
    nbf: Math.floor(Date.now() / 1000),
    iss,
    vc: {
      evidence,
      credentialSubject,
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
