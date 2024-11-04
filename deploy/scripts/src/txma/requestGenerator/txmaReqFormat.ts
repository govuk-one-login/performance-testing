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

export interface AuthAuthorizationInitiated {
  //unsure if the extensions section is required here.
  client_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  timestamp: number
  user: {
    govuk_signin_journey_id: string
    ip_address: string
    persistent_session_id: string
    session_id: string
  }
}

export interface AuthCodeVerified {
  //Some values from extensions missing.
  client_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  extension: {
    MFACodeEntered: string
    loginFailureCount: number
  }
  timestamp: number
  user: {
    email: string
    govuk_sigin_journey_id: string
    ip_address: string
    persistent_session_id: string
    session_id: string
    user_id: string
  }
}

export interface AuthUpdateProfilePhoneNumber {
  client_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  extensions: {
    phone_number_country_code: number
  }
  timestamp: number
  user: {
    email: string
    govuk_signin_journey_id: string
    ip_address: string
    persistent_session_id: string
    phone: string
    session_id: string
    user_id: string
  }
}

export interface IPVJourneyStart {
  client_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  extensions: {
    reprove_identity: boolean
  }
  restricted: {
    device_infomation: {
      encoded: string
    }
  }
  timestamp: number
  user: {
    govuk_signin_journey_id: string
    ip_address: string
    session_id: string
    user_id: string
  }
}

export interface IPVSubJourneyStart {
  client_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  extensions: {
    journey_type: string
  }
  restricted: {
    device_information: {
      encoded: string
    }
  }
  timestamp: number
  user: {
    govuk_signin_journey_id: string
    ip_address: string
    session_id: string
    user_id: string
  }
}

export interface IPVDLCRIVCIssued {
  client_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  extensions: {
    evidence: {
      activityHistoryScore: number
      checkDetails: {
        activityForm: string
        checkMethod: string
        identityCheckPolicy: string
      }
      ci: string
      failedCheckDetails: {
        checkMethod: string
        identityCheckPolicy: string
      }
      strengthScore: number
      txn: string
      type: string
      validityScore: number
    }
    iss: string
  }
  restricted: {
    address: {
      postalCode: string
    }
    birthDate: {
      value: string
    }
    drivingPermit: {
      expiryDate: string
      issueDate: string
      issueNumber: string
      issuesBy: string
      personalNumber: string
    }
    name: {
      description: string
      nameParts: {
        type: string
        validFrom: string
        validUntil: string
        value: string
      }
      validFrom: string
      validUntil: string
    }
    timestamp: number
    user: {
      govuk_signin_journey_id: string
      ip_address: string
      persistent_session_id: string
      session_id: string
      user_id: string
    }
  }
}

export interface IPVAddressCRIVCIssued {
  client_id: string
  component_id: string
  event_name: string
  event_tiemstamp_ms: number
  extensions: {
    addressEntered: number
    iss: string
  }
  timestamp: number
  user: {
    govuk_signin_journey_id: string
    ip_address: string
    persistent_session_id: string
    session_id: string
    user_id: string
  }
}

export interface CICCRIVCIssued {
  client_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  restricted: {
    birthdate: {
      value: string
    }
    name: {
      description: string
      nameParts: {
        type: string
        validFrom: string
        validUnti: string
        Value: string
      }
      validFrom: string
      validUntil: string
    }
    timestamp: number
    user: {
      govuk_signin_journey_id: string
      ip_address: string
      session_id: string
      user_id: string
    }
  }
}
