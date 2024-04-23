export interface AuthLogInSuccess {
  event_id: string
  event_name: string
  client_id: string
  component_id: string
  timestamp: number
  event_timestamp_ms: number
  user: {
    user_id: string
    govuk_signin_journey_id: string
    ip_address: string
    session_id: string
    email: string
    persistent_session_id: string
    phone: string
  }
}

