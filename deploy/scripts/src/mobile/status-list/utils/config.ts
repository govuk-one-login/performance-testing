import { getEnv } from '../../../common/utils/config/environment-variables'

export const environment = getEnv('ENVIRONMENT').toLocaleUpperCase()
const validEnvironments = ['BUILD', 'DEV']
if (!validEnvironments.includes(environment))
  throw new Error(`Environment '${environment}' not in [${validEnvironments.toString()}]`)

export const config = {
  mockURL: getEnv(`STATUS_LIST_MOCK_URL_${environment}`),
  envURL: getEnv(`STATUS_LIST_URL_${environment}`),
  clientID: getEnv(`STATUS_LIST_CLIENT_ID_${environment}`),
  isProxy: getEnv('STATUS_LIST_PROXY_API'),
  crsURL: getEnv(`STATUS_LIST_CRS_URL_${environment}`)
}
