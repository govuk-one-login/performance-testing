import {
  selectProfile,
  type ProfileList,
  describeProfile,
  createScenario,
  LoadProfile
} from '../common/utils/config/load-profiles'
import http, { type Response } from 'k6/http'

import { type Options } from 'k6/options'
import { timeGroup } from '../common/utils/request/timing'
import { isStatusCode200, pageContentCheck } from '../common/utils/checks/assertions'
import { iterationsStarted, iterationsCompleted } from '../common/utils/custom_metric/counter'
import { getEnv } from '../common/utils/config/environment-variables'
import { getThresholds } from '../common/utils/config/thresholds'
import { uuidv4 } from '../common/utils/jslib'

const profiles: ProfileList = {
  smoke: {
    ...createScenario('sisIDproving', LoadProfile.smoke),
    ...createScenario('sisIDreuse', LoadProfile.smoke)
  }
}

const loadProfile = selectProfile(profiles)
const groupMap = {
  sisIDproving: ['B01_SISIDProve_01_LaunchOrchestratorReUseStub', 'B01_SISIDProve_02_ContinueOnOrchStub'],
  sisIDreuse: [
    'B02_SISIDReuse_01_LaunchOrchestratorReUseStub',
    'B02_SISIDReuse_02_ContinueOrchStub',
    'B02_SISIDReuse_03_ConfirmDetails'
  ]
} as const

export const options: Options = {
  scenarios: loadProfile.scenarios,
  thresholds: getThresholds(groupMap),
  tags: { name: '' }
}

export function setup(): void {
  describeProfile(loadProfile)
}

const environment = getEnv('ENVIRONMENT').toLocaleUpperCase()
const validEnvironments = ['BUILD', 'DEV', 'DEFAULT', 'PERF']
if (!validEnvironments.includes(environment))
  throw new Error(`Environment '${environment}' not in [${validEnvironments.toString()}]`)

const env = {
  orchStubEndPoint: getEnv(`IDENTITY_SIS_${environment}_ORCH_REUSE_STUB_URL`),
  auth_server_public_base_url: getEnv(`IDENTITY_SIS_${environment}_AUTHSERVER_PUBLIC_BASE_URL`),
  auth_server_private_base_url: getEnv(`IDENTITY_SIS_${environment}_AUTHSERVER_PRIVATE_BASE_URL`)
}

export function sisIDproving(): void {
  const groups = groupMap.sisIDproving
  let res: Response

  iterationsStarted.add(1)

  // B01_SISIDProve_01_LaunchOrchestratorReUseStub
  res = timeGroup(groups[0], () => http.get(env.orchStubEndPoint), { isStatusCode200 })

  // B01_SISIDProve_02_ContinueOnOrchStub
  res = timeGroup(
    groups[1],
    () => {
      const now = Math.floor(Date.now() / 1000)
      const sub = `urn:uuid: ${uuidv4()}`
      const govuk_signin_journey_id = `${uuidv4()}`
      return res.submitForm({
        fields: {
          auth_server_public_base_url: env.auth_server_public_base_url,
          auth_server_private_base_url: env.auth_server_private_base_url,
          createidentity: 'false',
          sub,
          govuk_signin_journey_id,
          response_type: 'code',
          redirect_uri: env.orchStubEndPoint,
          client_id: 'orchestrator-stub',
          iss: 'orchestrator-stub',
          aud: env.auth_server_public_base_url,
          state: 'sample-state',
          vtr: 'P3',
          iat: String(now),
          nbf: String(now),
          exp: String(now + 360)
        },
        submitSelector: '[type="submit"]'
      })
    },
    {
      isStatusCode200,
      validateFinalUrl: r => r.url.includes('record_unavailable')
    }
  )

  iterationsCompleted.add(1)
}

export function sisIDreuse(): void {
  const groups = groupMap.sisIDreuse
  let res: Response

  iterationsStarted.add(1)

  // B02_SISIDReuse_01_LaunchOrchestratorReUseStub
  res = timeGroup(groups[0], () => http.get(env.orchStubEndPoint), { isStatusCode200 })

  // B02_SISIDReuse_02_ContinueOrchStub
  res = timeGroup(
    groups[1],
    () => {
      const now = Math.floor(Date.now() / 1000)
      const sub = `urn:uuid: ${uuidv4()}`
      const govuk_signin_journey_id = `${uuidv4()}`
      return res.submitForm({
        fields: {
          auth_server_public_base_url: env.auth_server_public_base_url,
          auth_server_private_base_url: env.auth_server_private_base_url,
          createidentity: 'true',
          sub,
          govuk_signin_journey_id,
          response_type: 'code',
          redirect_uri: env.orchStubEndPoint,
          client_id: 'orchestrator-stub',
          iss: 'orchestrator-stub',
          aud: env.auth_server_public_base_url,
          state: 'sample-state',
          vtr: 'P3',
          iat: String(now),
          nbf: String(now),
          exp: String(now + 360)
        },
        submitSelector: '[type="submit"]',
        params: {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Origin: env.auth_server_public_base_url,
            Referer: env.orchStubEndPoint
          }
        }
      })
    },
    { isStatusCode200, ...pageContentCheck('Confirm your details') }
  )

  // B02_SISIDReuse_03_ConfirmDetails
  res = timeGroup(
    groups[2],
    () =>
      res.submitForm({
        fields: { action: 'Continue' }
      }),
    { isStatusCode200, ...pageContentCheck('Retrieved user identity') }
  )

  iterationsCompleted.add(1)
}
