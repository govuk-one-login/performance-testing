interface LogIds {
  session_id: string
  client_id: string
  persistent_session_id: string
  client_session_id: string
  request_id: string
}

export interface SpotRequest {
  in_claims: {
    'https://vocab.account.gov.uk/v1/credentialJWT': string[]
    vot: string
    vtm: string
  }
  in_local_account_id: string
  in_salt: string
  out_audience: string
  out_sub: string
  in_rp_sector_id: string
  log_ids: LogIds
}

export interface SpotRequestInfo {
  host: string
  sector: string
  salt: string
}
