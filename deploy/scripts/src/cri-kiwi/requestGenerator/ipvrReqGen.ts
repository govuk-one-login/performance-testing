import { type AUTH_IPV_AUTHORISATION_REQUESTED, type F2F_YOTI_START, type IPV_F2F_CRI_VC_CONSUMED } from '../requestGenerator/ipvrReqFormat'
import { uuidv4, randomString } from '../../common/utils/jslib/index'

const userID = uuidv4()
const signinJourneyID = uuidv4()
const userURN = `urn:fdc:gov.uk:2022:${userID}`

export function generateAuthRequest (): AUTH_IPV_AUTHORISATION_REQUESTED {
  const timestamp = new Date().toISOString()
  return {
    event_id: uuidv4(),
    client_id: uuidv4(),
    clientLandingPageUrl: 'https://www.gov.uk/request-copy-criminal-record',
    event_name: 'AUTH_IPV_AUTHORISATION_REQUESTED',
    rp_name: 'replay',
    timestamp: Math.floor(Date.now() / 1000).toString(),
    timestamp_formatted: timestamp,
    user: {
      user_id: userURN,
      email: 'test.user@digital.cabinet-office.gov.uk',
      govuk_signin_journey_id: signinJourneyID
    }
  }
}

export function generateF2FRequest (): F2F_YOTI_START {
  const timestamp = new Date().toISOString()
  return {
    event_id: uuidv4(),
    client_id: uuidv4(),
    clientLandingPageUrl: 'https://www.gov.uk/request-copy-criminal-record',
    event_name: 'F2F_YOTI_START',
    rp_name: 'replay',
    timestamp: Date.now().toString().substring(0, 10),
    timestamp_formatted: timestamp,
    user: {
      user_id: userID,
      govuk_signin_journey_id: signinJourneyID
    }
  }
}

export function generateIPVRequest (): IPV_F2F_CRI_VC_CONSUMED {
  const timestamp = new Date().toISOString()
  return {
    event_id: uuidv4(),
    client_id: uuidv4(),
    clientLandingPageUrl: 'https://www.gov.uk/request-copy-criminal-record',
    event_name: 'IPV_F2F_CRI_VC_CONSUMED',
    rp_name: 'replay',
    timestamp: Date.now().toString().substring(0, 10),
    timestamp_formatted: timestamp,
    user: {
      user_id: userURN,
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
      ]
    }
  }
}
