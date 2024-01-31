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
