export interface FraudRequest {
  iss: string
  jti: string
  iat: number
  aud: string
  events: {
    'https://vocab.account.gov.uk/secevent/v1/notification/accountBlock': {
      subject: {
        format: string
        uri: string
      }
      reason_admin: { en: string }
      event_timeframe: {
        start_time: number
      }
    }
  }
}
