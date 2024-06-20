import { type Options } from 'k6/options'
import { createKey, signJwt } from '../common/utils/authentication/jwt'
import { crypto } from 'k6/experimental/webcrypto'
import { ProfileList, selectProfile } from '../common/utils/config/load-profiles'

const profiles: ProfileList = {
  smoke: {
    hs256: {
      vus: 1,
      iterations: 1,
      exec: 'hs256',
      executor: 'per-vu-iterations'
    },
    es256: {
      vus: 1,
      iterations: 1,
      exec: 'es256',
      executor: 'per-vu-iterations'
    }
  }
}
const loadProfile = selectProfile(profiles)

export const options: Options = {
  scenarios: loadProfile.scenarios
}

export async function hs256(): Promise<void> {
  const key = await createKey('HS256')
  const exportedKey = await crypto.subtle.exportKey('jwk', key)
  console.log('Exported key:', exportedKey)
  console.log(await signJwt('HS512', key, {}))
}

export async function es256(): Promise<void> {
  const key = await createKey('ES256')
  const publicKey = await crypto.subtle.exportKey('jwk', key.publicKey)
  const privateKey = await crypto.subtle.exportKey('jwk', key.privateKey)
  console.log('Public key:', publicKey)
  console.log('Private key:', privateKey)
  console.log(await signJwt('ES256', key.privateKey, {}))
}
