export interface AUTH_IPV_AUTHORISATION_REQUESTED {
  event_id: string
  client_id: string
  component_id: string
  event_name: string
  extensions: {
    rpPairwiseId: string
  }
  timestamp: string
  timestamp_formatted: string
  user: {
    user_id: string
    email: string
    ip_address: string
    session_id: string
    persistent_session_id: string
    govuk_signin_journey_id: string
  }
  txma: {
    obfuscated: boolean
  }
}

export interface F2F_YOTI_START {
  event_name: string
  user: {
    user_id: string
    session_id: string
    govuk_signin_journey_id: string
  }
  client_id: string
  timestamp: string
  component_id: string
  extensions: {
    evidence: [
      {
        txn: string
      }
    ]
    post_office_details: {
      address: string
      location: {
        latitude: number
        longitude: number
      }
      post_code: string
    }
  }
  restricted: {
    documentType: string
    issuingCountry: string
  }
}

export interface IPV_F2F_CRI_VC_CONSUMED {
  event_id: string
  component_id: string
  event_name: string
  restricted: {
    nameParts: [
      {
        type: string
        value: string
      },
      {
        type: string
        value: string
      }
    ]
  }
  timestamp: string
  timestamp_formatted: string
  user: {
    user_id: string
    govuk_signin_journey_id: string
  }
  txma: {
    obfuscated: boolean
  }
}
