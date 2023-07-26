import { type AUTH_IPV_AUTHORISATION_REQUESTED, type F2F_YOTI_START, type IPV_F2F_CRI_VC_CONSUMED } from '../requestGenerator/ipvrReqFormat'
import { uuidv4 } from '../../common/utils/jslib/index'
import encoding from 'k6/encoding'

const userID = uuidv4()
const signinJourneyID = uuidv4()
const userURN = `urn:fdc:gov.uk:2022:${userID}`
const email = `${uuidv4()}@digital.cabinet-office.gov.uk`
const encodedEmail = encoding.b64encode(email)
const timestamp = new Date().toISOString()

export function generateAuthRequest (): AUTH_IPV_AUTHORISATION_REQUESTED {
  const sampleAuthRequest: AUTH_IPV_AUTHORISATION_REQUESTED = {
    event_id: uuidv4(),
    client_id: uuidv4(),
    component_id: 'UNKNOWN',
    event_name: 'AUTH_IPV_AUTHORISATION_REQUESTED',
    extensions: {
      rpPairwiseId: userURN
    },
    timestamp: Date.now().toString().substring(0, 10),
    timestamp_formatted: timestamp,
    user: {
      user_id: userURN,
      email: encodedEmail,
      ip_address: '127.0.0.1',
      session_id: uuidv4(),
      persistent_session_id: uuidv4(),
      govuk_signin_journey_id: signinJourneyID
    },
    txma: {
      obfuscated: true
    }
  }

  return sampleAuthRequest
}

export function generateF2FRequest (): F2F_YOTI_START {
  const sampleF2FRequest: F2F_YOTI_START = {
    event_name: 'F2F_YOTI_START',
    user: {
      user_id: userID,
      session_id: uuidv4(),
      govuk_signin_journey_id: signinJourneyID
    },
    client_id: randomStringGenerator(8).toUpperCase(),
    timestamp: Date.now().toString().substring(0, 10),
    component_id: 'https://review-o.dev.account.gov.uk', // To be updated once the build environment specific details are available
    extensions: {
      evidence: [
        {
          txn: uuidv4()
        }
      ],
      post_office_details: {
        address: '1 The Street, Funkytown',
        location: {
          latitude: 0.34322,
          longitude: -42.48372
        },
        post_code: 'N1 2AA"'
      }
    },
    restricted: {
      documentType: 'ukPassport',
      issuingCountry: 'GBR'
    }
  }

  return sampleF2FRequest
}

export function generateIPVRequest (): IPV_F2F_CRI_VC_CONSUMED {
  const sampleIPVRequest: IPV_F2F_CRI_VC_CONSUMED = {
    event_id: uuidv4(),
    component_id: 'https://identity.staging.account.gov.uk', // To be updated once the build environment specific details are available
    event_name: 'IPV_F2F_CRI_VC_CONSUMED',
    restricted: {
      nameParts: [
        {
          type: randomStringGenerator(64),
          value: randomStringGenerator(64)
        },
        {
          type: randomStringGenerator(64),
          value: randomStringGenerator(64)
        }
      ]
    },
    timestamp: Date.now().toString().substring(0, 10),
    timestamp_formatted: timestamp,
    user: {
      user_id: userURN,
      govuk_signin_journey_id: signinJourneyID
    },
    txma: {
      obfuscated: true
    }
  }

  return sampleIPVRequest
}

function randomStringGenerator (charLen: number): string {
  let result = ''
  const characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-' // pragma: allowlist secret
  for (let i = charLen; i > 0; i--) result += characters[Math.round(Math.random() * (characters.length - 1))]
  return result
}
