import { getEnv } from '../../../common/utils/config/environment-variables'

export const environment = getEnv('ENVIRONMENT').toLocaleUpperCase()
const validEnvironments = ['BUILD', 'DEV']
if (!validEnvironments.includes(environment))
  throw new Error(`Environment '${environment}' not in [${validEnvironments.toString()}]`)

export const config = {
  mockURL: getEnv('STATUS_LIST_JWT_MOCK_URL'),
  envURL: getEnv('STATUS_LIST_URL'),
  clientID: getEnv('STATUS_LIST_CLIENT_ID'),
  isProxy: getEnv('STATUS_LIST_PROXY_API')
}
