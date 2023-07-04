import encoding from 'k6/encoding'

export const env = {
  ipvCoreStub: __ENV.IDENTITY_CORE_STUB_URL,
  kbvEndPoint: __ENV.IDENTITY_KBV_URL,
  addressEndPoint: __ENV.IDENTITY_ADDRESS_URL,
  kbvEnvName: __ENV.IDENTITY_KBV_ENV_NAME,
  addressEnvName: __ENV.IDENTITY_ADDRESS_ENV_NAME
}

export const stubCreds = {
  userName: __ENV.IDENTITY_STUB_USERNAME,
  password: __ENV.IDENTITY_STUB_PASSWORD
}

const credentials = `${stubCreds.userName}:${stubCreds.password}`
export const encodedCredentials = encoding.b64encode(credentials)
