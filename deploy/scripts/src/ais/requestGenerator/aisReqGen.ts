import { uuidv4 } from '../../common/utils/jslib/index'

export interface TicfAccountIntervention {
  timestamp: number
  event_timestamp_ms: number
  event_name: string
  event_id: string
  component_id: string
  user: {
    user_id: string
  }
  extensions: {
    intervention: {
      intervention_code: string
      intervention_reason: string
      originating_component_id: string
      originator_reference_id: string
      requester_id: string
    }
  }
}

export function generatePersistIVRequest (userID: string, interventionCode: string): TicfAccountIntervention {
  return {
    timestamp: Math.floor(Date.now() / 1000),
    event_timestamp_ms: Date.now(),
    event_name: 'TICF_ACCOUNT_INTERVENTION',
    event_id: uuidv4(),
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
