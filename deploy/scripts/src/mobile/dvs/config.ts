import { getEnv } from '../../common/utils/config/environment-variables'

export const environment = getEnv('ENVIRONMENT').toLocaleUpperCase()
const validEnvironments = ['INTEGRATION']
if (!validEnvironments.includes(environment))
  throw new Error(`Environment '${environment}' not in [${validEnvironments.toString()}]`)

export const env = {
  criURL: getEnv(`MOBILE_DVS_${environment}_CRI_URL`),
  docBuilderURL: getEnv(`MOBILE_DVS_${environment}_DOC_BUILDER_URL`)
}

export const credentialOfferParams = {
  walletSubjectId: getEnv(`MOBILE_DVS_${environment}_WALLET_SUBJECT_ID`),
  credentialType: getEnv(`MOBILE_DVS_${environment}_CREDENTIAL_TYPE`)
}
