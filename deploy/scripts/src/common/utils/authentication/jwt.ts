import { type Algorithm } from 'k6/crypto'
import * as c from 'k6/crypto'
import {
  crypto,
  type HmacKeyGenParams,
  type EcKeyGenParams,
  type EcdsaParams,
  type CryptoKey,
  type Algorithm as A
} from 'k6/experimental/webcrypto'
import { b64decode, b64encode } from 'k6/encoding'

// Supported JWT algorithms
export type JwtAlgorithm = 'HS256' | 'HS384' | 'HS512' | 'ES256' | 'ES384' | 'ES512'
const alorithmMapping: Record<JwtAlgorithm, HmacKeyGenParams | EcKeyGenParams> = {
  HS256: {
    name: 'HMAC',
    hash: 'SHA-256'
  },
  HS384: {
    name: 'HMAC',
    hash: 'SHA-384'
  },
  HS512: {
    name: 'HMAC',
    hash: 'SHA-512'
  },
  ES256: {
    name: 'ECDSA',
    namedCurve: 'P-256'
  },
  ES384: {
    name: 'ECDSA',
    namedCurve: 'P-384'
  },
  ES512: {
    name: 'ECDSA',
    namedCurve: 'P-521'
  }
}
const alorithmMapping2: Record<JwtAlgorithm, 'HMAC' | A<'HMAC'> | EcdsaParams> = {
  HS256: {
    name: 'HMAC'
  },
  HS384: {
    name: 'HMAC'
  },
  HS512: {
    name: 'HMAC'
  },
  ES256: {
    name: 'ECDSA',
    hash: 'SHA-256'
  },
  ES384: {
    name: 'ECDSA',
    hash: 'SHA-384'
  },
  ES512: {
    name: 'ECDSA',
    hash: 'SHA-512'
  }
}

/**
 *
 * @param type
 * @returns
 */
export async function createKey(type: JwtAlgorithm): Promise<CryptoKey> {
  const params = alorithmMapping[type]
  // TypeScript type narrowing to prevent problem with overload definitions of `generateKey()`
  if ('hash' in params) {
    return crypto.subtle.generateKey(params, true, ['sign', 'verify'])
  }
  return (await crypto.subtle.generateKey(params, true, ['sign', 'verify'])).privateKey
}

export async function signJwt(type: JwtAlgorithm, key: CryptoKey, data: object): Promise<string> {
  const header = b64encode(JSON.stringify({ typ: 'JWT', alg: type }), 'rawurl')
  const payload = b64encode(JSON.stringify(data), 'rawurl')
  const buf = b64decode(b64encode(`${header}.${payload}`))
  const sigBuf = await crypto.subtle.sign(alorithmMapping2[type], key, buf)
  const signature = b64encode(sigBuf, 'rawurl')
  return `${header}.${payload}.${signature}`
}
