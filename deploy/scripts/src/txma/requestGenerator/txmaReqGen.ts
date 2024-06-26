import { uuidv4 } from '../../common/utils/jslib/index'
import { AuthLogInSuccess, AuthCreateAccount, AuthAuthorisationReqParsed, DcmawAbortWeb } from './txmaReqFormat'

export function generateAuthLogInSuccess(userID: string, emailID: string, journeyID: string): AuthLogInSuccess {
  const eventID = `perfAuthLogin${uuidv4()}`
  const eventTime = Math.floor(Date.now() / 1000)
  return {
    event_id: eventID,
    event_name: 'AUTH_LOG_IN_SUCCESS',
    client_id: 'e2eTestClientId',
    component_id: 'SharedSignalPerfTest',
    timestamp: eventTime,
    event_timestamp_ms: eventTime,
    user: {
      user_id: userID,
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      session_id: uuidv4(),
      email: emailID,
      persistent_session_id: uuidv4(),
      phone: '07777777777'
    }
  }
}

export function generateAuthCreateAccount(userID: string, emailID: string, journeyID: string): AuthCreateAccount {
  const eventID = `perfAuthCreateAcc${uuidv4()}`
  return {
    event_id: eventID,
    event_name: 'AUTH_CREATE_ACCOUNT',
    client_id: 'e2eTestClientId',
    component_id: 'SharedSignalPerfTest',
    timestamp: Math.floor(Date.now() / 1000),
    event_timestamp_ms: Math.floor(Date.now()),
    extensions: {
      internalSubjectId: uuidv4(),
      rpPairwiseId: 'e2eTestPairwiseId'
    },
    user: {
      user_id: userID,
      govuk_signin_journey_id: journeyID,
      ip_address: '1.2.3.4',
      email: emailID,
      session_id: uuidv4(),
      persistent_session_id: uuidv4()
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
