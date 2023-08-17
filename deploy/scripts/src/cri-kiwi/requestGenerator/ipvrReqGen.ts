import { type AUTH_IPV_AUTHORISATION_REQUESTED, type F2F_YOTI_START, type IPV_F2F_CRI_VC_CONSUMED } from '../requestGenerator/ipvrReqFormat'
import { uuidv4 } from '../../common/utils/jslib/index'

const userID = uuidv4()
const signinJourneyID = uuidv4()
const userURN = `urn:fdc:gov.uk:2022:${userID}`
const randomNum = Math.floor(Math.random() * 9999999) // Random sleep between 2-4 seconds
const randomEmail = `perfSPOT${randomNum}@digital.cabinet-office.gov.uk`

export function generateAuthRequest (): AUTH_IPV_AUTHORISATION_REQUESTED {
  const timestamp = new Date().toISOString()
  const sampleAuthRequest: AUTH_IPV_AUTHORISATION_REQUESTED = {
    event_id: uuidv4(),
    client_id: uuidv4(),
    clientLandingPageUrl: 'https://www.gov.uk/request-copy-criminal-record',
    event_name: 'AUTH_IPV_AUTHORISATION_REQUESTED',
    rp_name: 'replay',
    timestamp: Date.now().toString().substring(0, 10),
    timestamp_formatted: timestamp,
    user: {
      user_id: userURN,
      email: randomEmail,
      govuk_signin_journey_id: signinJourneyID
    }
  }

  return sampleAuthRequest
}

export function generateF2FRequest (): F2F_YOTI_START {
  const timestamp = new Date().toISOString()
  const sampleF2FRequest: F2F_YOTI_START = {
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

  return sampleF2FRequest
}

export function generateIPVRequest (): IPV_F2F_CRI_VC_CONSUMED {
  const timestamp = new Date().toISOString()
  const sampleIPVRequest: IPV_F2F_CRI_VC_CONSUMED = {
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
          value: randomStringGenerator(6)
        },
        {
          type: 'GivenName',
          value: randomStringGenerator(6)
        },
        {
          type: 'FamilyName',
          value: randomStringGenerator(6)
        }
      ]
    }
  }

  return sampleIPVRequest
}

function randomStringGenerator (charLen: number): string {
  let result = ''
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' // pragma: allowlist secret
  for (let i = charLen; i > 0; i--) result += characters[Math.round(Math.random() * (characters.length - 1))]
  return result
}
