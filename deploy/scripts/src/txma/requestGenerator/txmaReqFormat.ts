export interface AuthCreateAccount {
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
  extensions: {
    phone_number_country_code: number
    rpPairwiseId: string
  }
  restricted: {
    device_information: {
      request_timestamp_ms: number
      ip_address: string
      connection_port: number
      country_code: string
      user_agent: string
      accepted_language: number
      ja3_fingerprint: string
    }
  }
}

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
  extensions: {
    phone_number_country_code: number
  }
  restricted: {
    device_information: {
      request_timestamp_ms: number
      ip_address: string
      connection_port: number
      country_code: string
      user_agent: string
      accepted_language: number
      ja3_fingerprint: string
    }
  }
}

export interface AuthLogInSuccessEnrichment {
  event_id: string
  event_name: string
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
  extensions: {
    phone_number_country_code: number
  }
  restricted: {
    device_information: {
      request_timestamp_ms: number
      ip_address: string
      connection_port: number
      country_code: string
      user_agent: string
      accepted_language: number
      ja3_fingerprint: string
    }
  }
}

export interface AuthAuthorisationReqParsed {
  client_id: string
  component_id: string
  event_id: string
  event_name: string
  event_timestamp_ms: number
  event_timestamp_ms_formatted: string
  extensions: {
    identityRequested: boolean
    reauthRequested: boolean
    rpSid: string
  }
  timestamp: number
  timestamp_formatted: string
  user: {
    govuk_signin_journey_id: string
    ip_address: string
    persistent_session_id: string
    session_id: string
  }
}

export interface AuthAuthorisationReqParsedEnrichment {
  client_id: string
  component_id: string
  event_id: string
  event_name: string
  event_timestamp_ms: number
  event_timestamp_ms_formatted: string
  timestamp: number
  timestamp_formatted: string
  user: {
    govuk_signin_journey_id: string
    ip_address: string
    persistent_session_id: string
    session_id: string
  }
  txma: {
    obfuscated: boolean
  }
}

export interface DcmawAbortWeb {
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
    email: string
    session_id: string
    persistent_session_id: string
    transaction_id: string
  }
}
