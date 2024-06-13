import { type Options } from 'k6/options'
import { createKey } from './utils/authentication/jwt'

export const options: Options = {
  vus: 1,
  iterations: 1
}

export default async function (): Promise<void> {
  await createKey('ES256')
}
