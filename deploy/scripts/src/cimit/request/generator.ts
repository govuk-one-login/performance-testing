import { CimitPayLoad } from '../request/types'
import { uuidv4 } from '../../common/utils/jslib'

export function generatePutContraIndicatorPayload(sub: string): CimitPayLoad {
  return {
    sub: sub,
    iss: 'did:web:identity.build.account.gov.uk:cimit',
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000),
    vc: {
      type: ['VerifiableCredential', 'SecurityCheckCredential'],
      evidence: [
        {
          type: 'SecurityCheck',
          txn: uuidv4(),
          contraIndicator: [
            {
              code: 'V03',
              issuanceDate: new Date().toISOString(), //2025-05-13T13:44:06.974Z
              document: 'passport/GBR/12345678',
              txn: ['txn'],
              mitigation: [],
              incompleteMitigation: []
            }
          ]
        }
      ]
    }
  }
}

export function generatePostMitigationsPayload(sub: string): CimitPayLoad {
  return {
    sub: sub,
    iss: 'did:web:identity.build.account.gov.uk:cimit',
    nbf: Math.floor(Date.now() / 1000),
    iat: Math.floor(Date.now() / 1000) - 1000,
    exp: Math.floor(Date.now() / 1000) + 1000,
    vc: {
      type: ['VerifiableCredential', 'SecurityCheckCredential'],
      evidence: [
        {
          type: 'SecurityCheck',
          txn: uuidv4(),
          contraIndicator: [
            {
              code: 'V03',
              issuanceDate: new Date().toISOString(), //2025-05-13T13:44:06.974Z
              document: 'passport/GBR/12345678',
              txn: ['txn'],
              mitigation: [
                {
                  mitigatingCredential: [
                    {
                      issuer: 'https://review-p.dev.account.gov.uk',
                      txn: 'txt',
                      validFrom: new Date().toISOString()
                    }
                  ],
                  code: 'M01'
                }
              ],
              incompleteMitigation: []
            }
          ]
        }
      ]
    }
  }
}
