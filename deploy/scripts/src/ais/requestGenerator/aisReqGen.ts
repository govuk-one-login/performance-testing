import { type TICF_ACCOUNT_INTERVENTION } from '../requestGenerator/aisReqFormat'
import { uuidv4 } from '../../common/utils/jslib/index'

export function generatePersistIVRequest (userID: string, interventionCode: string): TICF_ACCOUNT_INTERVENTION {
  return {
    timestamp: Math.floor(Date.now() / 1000),
    event_timestamp_ms: Date.now(),
    event_name: 'TICF_ACCOUNT_INTERVENTION',
    event_id: 'AUTH_IPV_AUTHORISATION_REQUESTED',
    component_id: 'TICF_CRI',
    user: {
      user_id: userID
    },
    extensions: {
      intervention: {
        intervention_code: interventionCode,
        intervention_reason: 'Perf Testing',
        originating_component_id: 'CMS',
        originator_reference_id: uuidv4(),
        requester_id: uuidv4()
      }
    }
  }
}
