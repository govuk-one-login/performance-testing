import { uuidv4 } from '../../common/utils/jslib/index'

export function generateRequest (currTime: string): TxmaRequest {
  const sampleTxmaRequest: TxmaRequest = {
    event_id: 'perf' + uuidv4(),
    event_name: 'AUTH_LOG_IN_SUCCESS',
    client_id: 'perfTestClientId',
    component_id: 'perfTestComponentId',
    timestamp: 0,
    event_timestamp_ms: '',
    user: {
      user_id: '',
      govuk_signin_journey_id: '',
      ip_address: '',
      session_id: uuidv4(),
      email: 'perf' + uuidv4 + '@test.com',
      persistent_session_id: '',
      phone: '07777777777'
    }
  }

  return sampleTxmaRequest
}
