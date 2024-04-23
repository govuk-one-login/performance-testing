import { uuidv4 } from '../../common/utils/jslib/index'
import { AuthLogInSuccess } from './txmaReqFormat'

export function generateAuthLogInSuccess(userID: string, emailID: string): AuthLogInSuccess {
  const eventID = `perfAuthLogin${uuidv4()}`
  const eventTime = Math.floor(Date.now() / 1000)
  return {
    event_id: eventID,
    event_name: 'AUTH_LOG_IN_SUCCESS',
    client_id: 'e2eTestClientId',
    component_id: 'SharedSignalIntegrationTest',
    timestamp: eventTime,
    event_timestamp_ms: eventTime,
    user: {
      user_id: userID,
      govuk_signin_journey_id: uuidv4(),
      ip_address: '1.2.3.4',
      session_id: uuidv4(),
      email: emailID,
      persistent_session_id: uuidv4(),
      phone: '07777777777'
    }
  }
}
