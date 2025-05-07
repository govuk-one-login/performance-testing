import { CimitPayLoad } from '../request/types'
import { uuidv4 } from '../../common/utils/jslib'

export function generateCimitPayload(sub: string): CimitPayLoad {
  return {
    sub: uuidv4(),
    iss: 'did:web:identity.build.account.gov.uk:cimit', //not very sure about it
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
              issuanceDate: '2023-08-31T12:26:53.000Z',
              document: 'passport/GBR/12345678',
              txn: ['txn'],
              mitigation: [
                {
                  mitigatingCredential: [
                    {
                      issuer: 'core',
                      txn: 'txn',
                      validFrom: '2023-08-31T12:26:54.000Z'
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
