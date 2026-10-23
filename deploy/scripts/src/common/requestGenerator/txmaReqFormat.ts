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

export interface AuthAuthorisationInitiated {
  client_id: string
  event_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  extensions: {
    'client-name': string
    new_authentication_required: boolean
  }
  timestamp: number
  user: {
    govuk_signin_journey_id: string
    ip_address: string
    persistent_session_id: string
    session_id: string
  }
}

export interface AuthCodeVerified {
  client_id: string
  event_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  extension: {
    MFACodeEntered: string
    'account-recovery': boolean
    'journey-type': string
    loginFailureCount: number
    'mfa-type': string
    'notification-type': string
  }
  timestamp: number
  user: {
    email: string
    govuk_signin_journey_id: string
    ip_address: string
    persistent_session_id: string
    session_id: string
    user_id: string
  }
}

export interface AuthUpdateProfilePhoneNumber {
  client_id: string
  event_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  extensions: {
    'account-recovery': boolean
    'mfa-type': string
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
  event_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  extensions: {
    reprove_identity: boolean
    vtr: string[]
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

export interface IPVSubJourneyStart {
  client_id: string
  event_id: string
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
  event_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  extensions: {
    evidence: [
      {
        activityHistoryScore: number
        checkDetails: [
          {
            activityFrom: string
            checkMethod: string
            identityCheckPolicy: string
          }
        ]
        strengthScore: number
        txn: string
        type: string
        validityScore: number
      }
    ]
    iss: string
  }
  restricted: {
    address: [
      {
        postalCode: string
      }
    ]
    birthDate: [
      {
        value: string
      }
    ]
    drivingPermit: [
      {
        expiryDate: string
        issueDate: string
        issueNumber: string
        issuedBy: string
        personalNumber: string
      }
    ]
    name: [
      {
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
    ]
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

export interface IPVAddressCRIVCIssued {
  client_id: string
  event_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  extensions: {
    addressEntered: number
    iss: string
  }
  restricted: {
    address: [
      {
        addressCountry: string
        addressLocality: string
        buildingName: string
        buildingNumber: string
        postalCode: string
        streetName: string
        uprn: number
        validFrom: string
        validUntil: string
      }
    ]
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

export interface IPVKBVCRIStart {
  client_id: string
  event_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  restricted: {
    device_information: {
      encoded: string
    }
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

export interface IPVKBVCRIEnd {
  client_id: string
  event_id: string
  component_id: string
  event_name: string
  event_timestamp_ms: number
  timestamp: number
  user: {
    govuk_signin_journey_id: string
    ip_address: string
    persistent_session_id: string
    session_id: string
    user_id: string
  }
}

export interface AuthLogInSuccessEnrichment {
  client_id: string
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

export interface TicfWorkQueueAssigned {
  client_id: string
  component_id: string
  event_id: string
  event_name: string
  event_timestamp_ms: number
  timestamp: number
  user: {
    user_id: string
  }
  extensions: {
    work_item: {
      context: {
        SET: {
          aud: string
          events: {
            'https://vocab.account.gov.uk/secevent/v1/eventInformation': {
              signal_batch: {
                count_type: string
                id: string
                signal_count: number
                unique_account_count: number
                unique_subject_count: number
              }
              subject_groups: Array<{
                uri: string
                unique_account_count: number
                unique_subject_count: number
                count_type: string
              }>
            }
            'https://vocab.account.gov.uk/secevent/v1/eventMetadata': {
              event_timeframe_ms: Record<string, never>
              signals_event_type: string
            }
            'https://vocab.account.gov.uk/secevent/v1/notification/accountConcern': {
              event_timeframe: {
                end_time: number
              }
              initiating_entity: string
              rationale: {
                code: string
              }
              reason_admin: {
                en: string
              }
            }
          }
          iat: number
          iss: string
          jti: string
        }
        context_type: string
      }
      originator_status: string
      sample: boolean
      work_item_id: string
    }
    work_queue: {
      work_queue_external_id: string
      work_queue_id: string
      work_queue_type: string
    }
  }
}
