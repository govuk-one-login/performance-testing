import {
  type AuthIpvAuthorisationRequested,
  type F2fYotiStart,
  type IpvF2fVcConsumed,
  type F2fDocumentUploaded
} from '../requestGenerator/ipvrReqFormat'
import { uuidv4, randomString, randomIntBetween } from '../../common/utils/jslib/index'

export function generateAuthRequest(userID: string, signinJourneyID: string): AuthIpvAuthorisationRequested {
  const timestamp = new Date().toISOString()
  return {
    event_id: uuidv4(),
    component_id: 'UNKNOWN',
    client_id: uuidv4(),
    clientLandingPageUrl: 'https://www.gov.uk/request-copy-criminal-record',
    event_name: 'AUTH_IPV_AUTHORISATION_REQUESTED',
    rp_name: 'replay',
    timestamp: Date.now(),
    timestamp_formatted: timestamp,
    user: {
      user_id: userID,
      email: 'test.user@digital.cabinet-office.gov.uk',
      govuk_signin_journey_id: signinJourneyID,
      ip_address: '1.2.3.4',
      persistent_session_id: uuidv4(),
      session_id: uuidv4()
    }
  }
}

export function generateF2FRequest(userID: string, signinJourneyID: string): F2fYotiStart {
  const timestamp = new Date().toISOString()
  return {
    event_id: uuidv4(),
    component_id: 'UNKNOWN',
    client_id: uuidv4(),
    clientLandingPageUrl: 'https://www.gov.uk/request-copy-criminal-record',
    event_name: 'F2F_YOTI_START',
    rp_name: 'replay',
    timestamp: Date.now(),
    timestamp_formatted: timestamp,
    user: {
      user_id: userID,
      govuk_signin_journey_id: signinJourneyID,
      ip_address: '1.2.3.4',
      session_id: uuidv4()
    },
    extensions: {
      post_office_details: [
        {
          name: randomString(6),
          address: randomString(6),
          location: [
            {
              latitude: randomIntBetween(-90, 90),
              longitude: randomIntBetween(-180, 180)
            }
          ],
          postcode: randomString(6)
        }
      ]
    },
    restricted: {
      document_details: [
        {
          documentType: 'PASSPORT',
          issuingCountry: 'GBR'
        }
      ],
      nameParts: [
        {
          type: 'GivenName',
          value: randomString(6)
        },
        {
          type: 'GivenName',
          value: randomString(6)
        },
        {
          type: 'FamilyName',
          value: randomString(6)
        }
      ]
    }
  }
}

export function generateDocumentUploadedRequest(userID: string): F2fDocumentUploaded {
  return {
    event_name: 'F2F_DOCUMENT_UPLOADED',
    component_id: 'UNKNOWN',
    event_id: uuidv4(),
    timestamp: Date.now(),
    user: {
      user_id: userID,
      ip_address: '1.2.3.4',
      session_id: uuidv4()
    },
    extensions: {
      post_office_visit_details: [
        {
          post_office_date_of_visit: randomString(6),
          post_office_time_of_visit: randomString(6)
        }
      ]
    }
  }
}

export function generateIPVRequest(userID: string, signinJourneyID: string): IpvF2fVcConsumed {
  const timestamp = new Date().toISOString()
  return {
    event_id: uuidv4(),
    component_id: 'UNKNOWN',
    client_id: uuidv4(),
    clientLandingPageUrl: 'https://www.gov.uk/request-copy-criminal-record',
    event_name: 'IPV_F2F_CRI_VC_CONSUMED',
    rp_name: 'replay',
    timestamp: Date.now(),
    timestamp_formatted: timestamp,
    user: {
      user_id: userID,
      govuk_signin_journey_id: signinJourneyID
    },
    restricted: {
      nameParts: [
        {
          type: 'GivenName',
          value: randomString(6)
        },
        {
          type: 'GivenName',
          value: randomString(6)
        },
        {
          type: 'FamilyName',
          value: randomString(6)
        }
      ],
      docExpiryDate: randomString(6)
    }
  }
}
