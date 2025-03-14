import { uuidv4 } from '../../common/utils/jslib/index'
import { AuthLogInSuccess, AuthCreateAccount, AuthAuthorisationReqParsed, DcmawAbortWeb } from './txmaReqFormat'

export function generateAuthCreateAccount(
  testID: string,
  userID: string,
  emailID: string,
  pairWiseID: string,
  journeyID: string
): AuthCreateAccount {
  const eventID = `${testID}_${uuidv4()}`
  return {
    event_id: eventID,
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

export function generateAuthLogInSuccess(
  eventID: string,
  userID: string,
  emailID: string,
  journeyID: string
): AuthLogInSuccess {
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

export function generateAuthReqParsed(journeyID: string, testID: string): AuthAuthorisationReqParsed {
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
