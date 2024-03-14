import encoding from 'k6/encoding'
import { getEnv } from '../../common/utils/config/environment-variables'

export const env = {
  ipvCoreStub: getEnv('IDENTITY_CORE_STUB_URL'),
  kbvEndPoint: getEnv('IDENTITY_KBV_URL'),
  addressEndPoint: getEnv('IDENTITY_ADDRESS_URL'),
  envName: getEnv('ENVIRONMENT')
}

export const stubCreds = {
  userName: getEnv('IDENTITY_CORE_STUB_USERNAME'),
  password: getEnv('IDENTITY_CORE_STUB_PASSWORD')
}

const credentials = `${stubCreds.userName}:${stubCreds.password}`
export const encodedCredentials = encoding.b64encode(credentials)
