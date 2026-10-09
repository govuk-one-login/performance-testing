import { sleep } from 'k6'
import { b64decode } from 'k6/encoding'
import http, { type Response } from 'k6/http'
import { type Options } from 'k6/options'
import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import { getThresholds } from '../common/utils/config/thresholds'
import { iterationsCompleted, iterationsStarted } from '../common/utils/custom_metric/counter'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, isStatusCode202, pageContentCheck } from '../common/utils/checks/assertions'
import { generateKey } from './utils/crypto'
import { uuidv4 } from '../common/utils/jslib'
import { credentialOfferParams, env } from './dvs/config'
import { buildAccessToken, buildDidKey, buildProofJwt, decodeMdoc, extractPreAuthCode } from './dvs/utils'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('dvsJourney', LoadProfile.smoke)
  },
  load20DVS: {
    dvsJourney: {
      executor: 'constant-arrival-rate',
      rate: 40,
      timeUnit: '10s',
      preAllocatedVUs: 20,
      maxVUs: 20,
      duration: '30m',
      exec: 'dvsJourney'
    }
  },
  load40DVS: {
    dvsJourney: {
      executor: 'constant-arrival-rate',
      rate: 40,
      timeUnit: '10s',
      preAllocatedVUs: 40,
      maxVUs: 40,
      duration: '30m',
      exec: 'dvsJourney'
    }
  }
}

const loadProfile = selectProfile(profiles)

const groupMap = {
  dvsJourney: [
    'B01_DVS_01_CreateDocument',
    'B01_DVS_02_GetCredentialOffer',
    'B01_DVS_03_GetCredentialEndpoint',
    'B01_DVS_04_PostCredential',
    'B01_DVS_05_ShareCredential',
    'B01_DVS_06_RevokeCredential'
  ]
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

interface SetupData {
  credentialEndpoint: string
  didKey: string
  privateKeyJwk: JsonWebKey
  publicKeyJwk: JsonWebKey
}

export async function setup(): Promise<SetupData> {
  describeProfile(loadProfile)

  // Generate keypair and build DID Key
  const keys = await generateKey()
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keys.privateKey)
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keys.publicKey)
  const didKey = buildDidKey(publicKeyJwk)

  const metaRes = http.get(`${env.criURL}/.well-known/openid-credential-issuer`)
  const meta = metaRes.json() as { credential_endpoint: string }
  const credentialEndpoint = meta.credential_endpoint

  return { credentialEndpoint, didKey, privateKeyJwk, publicKeyJwk }
}

export async function dvsJourney(data: SetupData): Promise<void> {
  let res: Response
  const groups = groupMap.dvsJourney
  iterationsStarted.add(1)

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    data.privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign']
  )

  // B01_DVS_01_CreateDocument
  res = timeGroup(groups[0], () => http.get(`${env.docBuilderURL}/dvs/build-driving-licence`, { redirects: 0 }))

  const locationHeader = res.headers['Location'] ?? ''
  const itemIdMatch = /\/dvs\/view-credential-offer\/([^?]+)/.exec(locationHeader)
  if (!itemIdMatch) throw new Error(`Could not extract itemId from Location: ${locationHeader}`)
  const itemId = itemIdMatch[1]

  sleep(1)

  // B01_DVS_02_GetCredentialOffer
  res = timeGroup(
    groups[1],
    () =>
      http.get(
        `${env.criURL}/credential_offer?walletSubjectId=${encodeURIComponent(credentialOfferParams.walletSubjectId)}&itemId=${itemId}&credentialType=${encodeURIComponent(credentialOfferParams.credentialType)}`,
        { headers: { Accept: 'application/json' } }
      ),
    { isStatusCode200, ...pageContentCheck('wallet/add?credential_offer=') }
  )

  const universalLink = res.body as string
  const preAuthCode = extractPreAuthCode(universalLink)
  const preAuthClaims = decodeJwtPayload(preAuthCode)

  sleep(1)

  // B01_DVS_03_GetCredentialEndpoint — discover credential endpoint (use setup data)

  timeGroup(
    groups[2],
    () => http.get(`${env.criURL}/.well-known/openid-credential-issuer`, { headers: { Accept: 'application/json' } }),
    { isStatusCode200, ...pageContentCheck('credential_issuer') }
  )

  sleep(1)

  // B01_DVS_04_PostCredential
  const cNonce = uuidv4()
  const accessToken = await buildAccessToken(privateKey, preAuthClaims, cNonce, data.didKey)
  const proofJwt = await buildProofJwt(privateKey, preAuthClaims, cNonce, data.didKey)

  res = timeGroup(
    groups[3],
    () =>
      http.post(data.credentialEndpoint, JSON.stringify({ proof: { proof_type: 'jwt', jwt: proofJwt } }), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        }
      }),
    { isStatusCode200, ...pageContentCheck('notification_id') }
  )

  const credentialResponse = res.json() as { credentials: Array<{ credential: string }> }
  const credentialCbor = credentialResponse.credentials[0].credential
  // Decode mDoc to extract document_number and status_list
  const { documentNumber, statusListUri } = decodeMdoc(credentialCbor)

  sleep(1)

  // B01_DVS_05_ShareCredential — read status list
  timeGroup(groups[4], () => http.get(statusListUri), { isStatusCode200 })

  sleep(1)

  // B01_DVS_06_RevokeCredential
  timeGroup(groups[5], () => http.post(`${env.criURL}/revoke/${documentNumber}`, null), { isStatusCode202 })

  iterationsCompleted.add(1)
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.')
  return JSON.parse(b64decode(parts[1], 'rawurl', 's')) as Record<string, unknown>
}
