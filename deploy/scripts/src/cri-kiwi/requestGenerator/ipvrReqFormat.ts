export interface AuthIpvAuthorisationRequested {
  event_id: string
  client_id: string
  clientLandingPageUrl: string
  event_name: string
  rp_name: string
  timestamp: number
  timestamp_formatted: string
  user: {
    user_id: string
    email: string
    govuk_signin_journey_id: string
  }
}

export interface F2fYotiStart {
  event_id: string
  client_id: string
  clientLandingPageUrl: string
  event_name: string
  rp_name: string
  timestamp: number
  timestamp_formatted: string
  user: {
    user_id: string
    govuk_signin_journey_id: string
  }
  extensions: {
    post_office_details: [
      {
        name: string
        address: string
        location: [
          {
            latitude: number
            longitude: number
          }
        ]
        postcode: string
      }
    ]
  }
  restricted: {
    document_details: [
      {
        documentType: string
      }
    ]
  }
}

export interface F2fDocumentUploaded {
  event_name: string
  event_id: string
  user: {
    user_id: string
  }
  extensions: {
    post_office_visit_details: [
      {
        post_office_date_of_visit: string
        post_office_time_of_visit: string
      }
    ]
  }
  timestamp: number
}

export interface IpvF2fVcConsumed {
  event_id: string
  client_id: string
  clientLandingPageUrl: string
  event_name: string
  rp_name: string
  timestamp: number
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
    docExpiryDate: string
  }
}
