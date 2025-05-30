import { uuidv4 } from '../utils/jslib/index'
import {
  AuthLogInSuccess,
  AuthCreateAccount,
  AuthAuthorisationReqParsed,
  DcmawAbortWeb,
  AuthCodeVerified,
  AuthUpdateProfilePhoneNumber,
  IPVJourneyStart,
  IPVSubJourneyStart,
  IPVDLCRIVCIssued,
  IPVAddressCRIVCIssued,
  IPVKBVCRIStart,
  IPVKBVCRIEnd,
  AuthAuthorisationReqParsedEnrichment,
  AuthLogInSuccessEnrichment,
  AuthAuthorisationInitiated
} from './txmaReqFormat'

export function generateAuthCreateAccount(
  testID: string,
  userID: string,
  emailID: string,
  pairWiseID: string,
  journeyID: string
): AuthCreateAccount {
  return {
    event_id: `perfTestID$_${uuidv4()}`,
    event_name: 'AUTH_CREATE_ACCOUNT',
    client_id: 'performanceTestClientId',
    component_id: 'SharedSignalPerfTest',
    timestamp: Math.floor(Date.now() / 1000),
    event_timestamp_ms: Math.floor(Date.now()),
    user: {
      user_id: userID, // `${testID}_performanceTestClientId_${userID}_performanceTestCommonSubjectId`
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      email: emailID,
      session_id: uuidv4(),
      persistent_session_id: uuidv4(),
      phone: '07777777777'
    },
    extensions: {
      phone_number_country_code: 44,
      rpPairwiseId: pairWiseID // `${testID}_performanceTestClientId_${userID}_performanceTestRpPairwiseId`
    },
    restricted: {
      device_information: {
        request_timestamp_ms: Math.floor(Date.now()),
        ip_address: '1.2.3.4',
        connection_port: 12345,
        country_code: 'GB',
        user_agent: 'k6/0.52.0 (https://k6.io/)',
        accepted_language: 24234233,
        ja3_fingerprint: uuidv4()
      }
    }
  }
}

export function generateAuthLogInSuccess(userID: string, emailID: string, journeyID: string): AuthLogInSuccess {
  return {
    event_id: `perfTestID$_${uuidv4()}`,
    event_name: 'AUTH_LOG_IN_SUCCESS',
    client_id: 'performanceTestClientId',
    component_id: 'SharedSignalPerfTest',
    timestamp: Math.floor(Date.now() / 1000),
    event_timestamp_ms: Math.floor(Date.now()),
    user: {
      user_id: userID, // `${testID}_performanceTestClientId_${userID}_performanceTestCommonSubjectId`,
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      session_id: uuidv4(),
      email: emailID,
      persistent_session_id: uuidv4(),
      phone: '07777777777'
    },
    extensions: {
      phone_number_country_code: 44
    },
    restricted: {
      device_information: {
        request_timestamp_ms: Math.floor(Date.now()),
        ip_address: '1.2.3.4',
        connection_port: 12345,
        country_code: 'GB',
        user_agent: 'k6/0.52.0 (https://k6.io/)',
        accepted_language: 24234233,
        ja3_fingerprint: uuidv4()
      }
    }
  }
}

export function generateAuthReqParsed(journeyID: string): AuthAuthorisationReqParsed {
  const eventID = `perfAuthReqParsed${uuidv4()}`
  const eventTime = new Date().toISOString()
  return {
    client_id: 'e2eTestClientId',
    component_id: 'https://oidc.account.gov.uk/',
    event_id: eventID,
    event_name: 'AUTH_AUTHORISATION_REQUEST_PARSED',
    event_timestamp_ms: Math.floor(Date.now()),
    event_timestamp_ms_formatted: eventTime,
    extensions: {
      identityRequested: true,
      reauthRequested: false,
      rpSid: 'test123'
    },
    timestamp: Math.floor(Date.now() / 1000),
    timestamp_formatted: eventTime,
    user: {
      govuk_signin_journey_id: journeyID,
      ip_address: '01.01.01.001',
      persistent_session_id: uuidv4(),
      session_id: uuidv4()
    }
  }
}

export function generateDcmawAbortWeb(userID: string, journeyID: string, emailID: string): DcmawAbortWeb {
  const eventID = `perfDcmawAbort${uuidv4()}`
  return {
    event_id: eventID,
    event_name: 'DCMAW_ABORT_WEB',
    client_id: 'e2eTestClientId',
    component_id: 'UNKNOWN',
    timestamp: Math.floor(Date.now() / 1000),
    event_timestamp_ms: Math.floor(Date.now()),
    user: {
      user_id: userID,
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      email: emailID,
      session_id: uuidv4(),
      persistent_session_id: uuidv4(),
      transaction_id: uuidv4()
    }
  }
}

export function generateAuthAuthorisationInitiated(journeyID: string): AuthAuthorisationInitiated {
  return {
    client_id: 'performanceTestClientId',
    event_id: `perfTestID$_${uuidv4()}`,
    component_id: 'perfTest',
    event_name: 'AUTH_AUTHORISATION_INITIATED',
    event_timestamp_ms: Math.floor(Date.now()),
    extensions: {
      'client-name': 'PerfTest',
      new_authentication_required: false
    },
    timestamp: Math.floor(Date.now() / 1000),
    user: {
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      persistent_session_id: uuidv4(),
      session_id: uuidv4()
    }
  }
}

export function generateAuthCodeVerified(emailID: string, journeyID: string, userID: string): AuthCodeVerified {
  return {
    client_id: 'performanceTestClientId',
    event_id: `perfTestID$_${uuidv4()}`,
    component_id: 'perfTest',
    event_name: 'AUTH_CODE_VERIFIED',
    event_timestamp_ms: Math.floor(Date.now()),
    extension: {
      MFACodeEntered: '123',
      'account-recovery': false,
      'journey-type': 'SIGN_IN',
      loginFailureCount: 0,
      'mfa-type': 'SMS',
      'notification-type': 'SMS'
    },
    timestamp: Math.floor(Date.now() / 1000),
    user: {
      email: emailID,
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      persistent_session_id: uuidv4(),
      session_id: uuidv4(),
      user_id: userID
    }
  }
}

export function generateAuthUpdatePhone(
  emailID: string,
  journeyID: string,
  userID: string
): AuthUpdateProfilePhoneNumber {
  return {
    client_id: 'performanceTestClientId',
    event_id: `perfTestID$_${uuidv4()}`,
    component_id: 'perfTest',
    event_name: 'AUTH_UPDATE_PROFILE_PHONE_NUMBER',
    event_timestamp_ms: Math.floor(Date.now()),
    extensions: {
      'account-recovery': false,
      'mfa-type': 'SMS',
      phone_number_country_code: 44
    },
    timestamp: Math.floor(Date.now() / 1000),
    user: {
      email: emailID,
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      persistent_session_id: uuidv4(),
      phone: '07123456789',
      session_id: uuidv4(),
      user_id: userID
    }
  }
}

export function generateIPVJourneyStart(journeyID: string, userID: string): IPVJourneyStart {
  return {
    client_id: 'performanceTestClientId',
    event_id: `perfTestID$_${uuidv4()}`,
    component_id: 'perfTest',
    event_name: 'IPV_JOURNEY_START',
    event_timestamp_ms: Math.floor(Date.now()),
    extensions: {
      reprove_identity: false,
      vtr: ['CI']
    },
    restricted: {
      device_information: {
        encoded: 'RW5jb2RlZCBkYXRhIHdpbGwgYmUgaGVyZQ==' //pragma: allowlist secret
      }
    },
    timestamp: Math.floor(Date.now() / 1000),
    user: {
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      session_id: uuidv4(),
      user_id: userID
    }
  }
}

export function generateIPVSubJourneyStart(journeyID: string, userID: string): IPVSubJourneyStart {
  return {
    client_id: 'performanceTestClientId',
    event_id: `perfTestID$_${uuidv4()}`,
    component_id: 'perfTest',
    event_name: 'IPV_SUBJOURNEY_START',
    event_timestamp_ms: Math.floor(Date.now()),
    extensions: {
      journey_type: 'REUSE_EXISTING_IDENTITY'
    },
    restricted: {
      device_information: {
        encoded: 'RW5jb2RlZCBkYXRhIHdpbGwgYmUgaGVyZQ==,' //pragma: allowlist secret
      }
    },
    timestamp: Math.floor(Date.now() / 1000),
    user: {
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      session_id: uuidv4(),
      user_id: userID
    }
  }
}

export function generateIPVDLCRIVCIssued(userID: string, journeyID: string): IPVDLCRIVCIssued {
  return {
    client_id: 'performanceTestClientId',
    event_id: `perfTestID$_${uuidv4()}`,
    component_id: 'perfTest',
    event_name: 'IPV_DL_CRI_VC_ISSUED',
    event_timestamp_ms: Math.floor(Date.now()),
    extensions: {
      evidence: [
        {
          activityHistoryScore: 4,
          checkDetails: [
            {
              activityFrom: '2020-01-01',
              checkMethod: 'vpip',
              identityCheckPolicy: 'policy'
            }
          ],
          strengthScore: 4,
          txn: 'UNKOWN',
          type: 'UNKNOWN',
          validityScore: 4
        }
      ],
      iss: 'perfTest'
    },
    restricted: {
      address: [
        {
          postalCode: 'AB12 3CD'
        }
      ],
      birthDate: [
        {
          value: '1990-01-01'
        }
      ],
      drivingPermit: [
        {
          expiryDate: '2030-01-01',
          issueDate: '2020-01-01',
          issueNumber: '1234',
          issuedBy: 'DVLA',
          personalNumber: '12345'
        }
      ],
      name: [
        {
          nameParts: [
            {
              type: 'GivenName',
              value: 'John'
            },
            {
              type: 'FamilyName',
              value: 'Smith'
            }
          ]
        }
      ]
    },
    timestamp: Math.floor(Date.now() / 1000),
    user: {
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      persistent_session_id: uuidv4(),
      session_id: uuidv4(),
      user_id: userID
    }
  }
}

export function generateIPVAddressCRIVCIssued(journeyID: string, userID: string): IPVAddressCRIVCIssued {
  return {
    client_id: 'performanceTestClientId',
    event_id: `perfTestID$_${uuidv4()}`,
    component_id: 'perfTest',
    event_name: 'IPV_ADDRESS_CRI_VC_ISSUED',
    event_timestamp_ms: Math.floor(Date.now()),
    extensions: {
      addressEntered: 1,
      iss: 'perfTest'
    },
    restricted: {
      address: [
        {
          addressCountry: 'GB',
          addressLocality: 'London',
          buildingName: 'Highfield House',
          buildingNumber: '44',
          postalCode: 'AB12 3CD',
          streetName: 'HIGH STREET',
          uprn: 123456789012,
          validFrom: '1990-01-01',
          validUntil: '2030-01-01'
        }
      ]
    },
    timestamp: Math.floor(Date.now() / 1000),
    user: {
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      persistent_session_id: uuidv4(),
      session_id: uuidv4(),
      user_id: userID
    }
  }
}

export function generateIPVKBVCRIStart(journeyID: string, userID: string): IPVKBVCRIStart {
  return {
    client_id: 'performanceTestClientID',
    event_id: `perfTestID$_${uuidv4()}`,
    component_id: 'perfTest',
    event_name: 'IPV_KBV_CRI_START',
    event_timestamp_ms: Math.floor(Date.now()),
    restricted: {
      device_information: {
        encoded: 'RW5jb2RlZCBkYXRhIHdpbGwgYmUgaGVyZQ==,' //pragma: allowlist secret
      }
    },
    timestamp: Math.floor(Date.now() / 1000),
    user: {
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      persistent_session_id: uuidv4(),
      session_id: uuidv4(),
      user_id: userID
    }
  }
}

export function generateIPVKBVCRIEnd(journeyID: string, userID: string): IPVKBVCRIEnd {
  return {
    client_id: 'performanceTestClientID',
    event_id: `perfTestID$_${uuidv4()}`,
    component_id: 'perfTest',
    event_name: 'IPV_KBV_CRI_END',
    event_timestamp_ms: Math.floor(Date.now()),
    timestamp: Math.floor(Date.now() / 1000),
    user: {
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      persistent_session_id: uuidv4(),
      session_id: uuidv4(),
      user_id: userID
    }
  }
}

export function generateAuthLogInSuccessEnrichment(
  eventID: string,
  userID: string,
  emailID: string,
  journeyID: string
): AuthLogInSuccessEnrichment {
  return {
    event_id: eventID,
    event_name: 'AUTH_LOG_IN_SUCCESS',
    component_id: 'SharedSignalPerfTest',
    timestamp: Math.floor(Date.now() / 1000),
    event_timestamp_ms: Math.floor(Date.now()),
    user: {
      user_id: userID, // `${testID}_performanceTestClientId_${userID}_performanceTestCommonSubjectId`,
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      session_id: uuidv4(),
      email: emailID,
      persistent_session_id: uuidv4(),
      phone: '07777777777'
    },
    extensions: {
      phone_number_country_code: 44
    },
    restricted: {
      device_information: {
        request_timestamp_ms: Math.floor(Date.now()),
        ip_address: '1.2.3.4',
        connection_port: 12345,
        country_code: 'GB',
        user_agent: 'k6/0.52.0 (https://k6.io/)',
        accepted_language: 24234233,
        ja3_fingerprint: uuidv4()
      }
    }
  }
}

export function generateAuthReqParsedEnrichment(
  journeyID: string,
  testID: string
): AuthAuthorisationReqParsedEnrichment {
  const eventTime = new Date().toISOString()
  const eventID = `${testID}_${uuidv4()}`
  return {
    client_id: 'performanceTestClientId',
    component_id: 'https://oidc.account.gov.uk/',
    event_id: eventID,
    event_name: 'AUTH_AUTHORISATION_REQUEST_PARSED',
    event_timestamp_ms: Math.floor(Date.now()),
    event_timestamp_ms_formatted: eventTime,
    timestamp: Math.floor(Date.now() / 1000),
    timestamp_formatted: eventTime,
    user: {
      govuk_signin_journey_id: journeyID,
      ip_address: '01.01.01.001',
      persistent_session_id: 'vJNUUY3s3pa95VcIXmytYF65ogE--1738669313306',
      session_id: uuidv4()
    },
    txma: {
      obfuscated: true
    }
  }
}
