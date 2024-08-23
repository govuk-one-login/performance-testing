import { type SpotRequest } from '../../spot/requestGenerator/spotReqFormat'
import { uuidv4 } from '../../common/utils/jslib/index'

export function generateSPOTRequest(
  currTime: string,
  fraudSignedJWT: string,
  passportSignedJWT: string,
  kbvSignedJWT: string
): SpotRequest {
  const audClientID = uuidv4()
  const sampleSpotRequest: SpotRequest = {
    in_claims: {
      'https://vocab.account.gov.uk/v1/credentialJWT': [fraudSignedJWT, passportSignedJWT, kbvSignedJWT],
      vot: 'P2',
      vtm: 'https://local.vtm'
    },
    in_local_account_id: 'a-simple-local-account-id',
    in_rp_sector_id: 'a.simple.sector.id',
    in_salt: 'YS1zaW1wbGUtc2FsdA==',
    out_audience: audClientID,
    log_ids: {
      client_id: audClientID,
      persistent_session_id: uuidv4(),
      request_id: uuidv4() + '_' + currTime,
      session_id: uuidv4(),
      client_session_id: uuidv4()
    },
    out_sub: 'urn:fdc:gov.uk:2022:JG0RJI1pYbnanbvPs-j4j5-a-PFcmhry9Qu9NCEp5d4'
  }

  return sampleSpotRequest
}
