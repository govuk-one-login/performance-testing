import { type Options } from 'k6/options'
import { createKey, signJwt } from './utils/authentication/jwt'

export const options: Options = {
  vus: 1,
  iterations: 1
}

export default async function (): Promise<void> {
  const key = await createKey('ES256')
  console.log(signJwt('ES256', key, {}))
}
