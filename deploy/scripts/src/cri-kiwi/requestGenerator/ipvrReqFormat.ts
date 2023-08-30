export interface AUTH_IPV_AUTHORISATION_REQUESTED {
  event_id: string
  client_id: string
  clientLandingPageUrl: string
  event_name: string
  rp_name: string
  timestamp: string
  timestamp_formatted: string
  user: {
    user_id: string
    email: string
    govuk_signin_journey_id: string
  }
}

export interface F2F_YOTI_START {
  event_id: string
  client_id: string
  clientLandingPageUrl: string
  event_name: string
  rp_name: string
  timestamp: string
  timestamp_formatted: string
  user: {
    user_id: string
    govuk_signin_journey_id: string
  }
}

export interface IPV_F2F_CRI_VC_CONSUMED {
  event_id: string
  client_id: string
  clientLandingPageUrl: string
  event_name: string
  rp_name: string
  timestamp: string
  timestamp_formatted: string
  user: {
    user_id: string
    govuk_signin_journey_id: string
  }
  restricted: {
    nameParts: [
      {
        type: string
        value: string
      },
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
}
