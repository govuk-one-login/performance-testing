import { type Options } from 'k6/options'
import { createKey, signJwt } from './utils/authentication/jwt'
import { crypto } from 'k6/experimental/webcrypto'

export const options: Options = {
  vus: 1,
  iterations: 1
}

export default async function (): Promise<void> {
  const key = await createKey('HS256')
  const x = await crypto.subtle.exportKey('jwk', key)
  console.log(x)
  console.log(await signJwt('HS256', key, {}))
}
