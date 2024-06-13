import { type Algorithm } from 'k6/crypto'
import * as c from 'k6/crypto'
import { crypto, type HmacKeyGenParams, type EcKeyGenParams } from 'k6/experimental/webcrypto'
import { b64encode } from 'k6/encoding'

// Supported JWT algorithms
export type JwtAlgorithm = 'HS256' | 'HS384' | 'HS512' | 'ES256' | 'ES384' | 'ES512'
const algoMapping: Record<JwtAlgorithm, Algorithm> = {
  HS256: 'sha256',
  HS384: 'sha384',
  HS512: 'sha512',
  ES256: 'sha256',
  ES384: 'sha384',
  ES512: 'sha512'
}
const alorithmMapping: Record<JwtAlgorithm, HmacKeyGenParams | EcKeyGenParams> = {
  HS256: {
    name: 'HMAC',
    hash: 'SHA-256'
  } as HmacKeyGenParams,
  HS384: {
    name: 'HMAC',
    hash: 'SHA-384'
  } as HmacKeyGenParams,
  HS512: {
    name: 'HMAC',
    hash: 'SHA-512'
  } as HmacKeyGenParams,
  ES256: {
    name: 'ECDSA',
    namedCurve: 'P-256'
  } as EcKeyGenParams,
  ES384: {
    name: 'ECDSA',
    namedCurve: 'P-384'
  } as EcKeyGenParams,
  ES512: {
    name: 'ECDSA',
    namedCurve: 'P-521'
  } as EcKeyGenParams
}

/**
 *
 * @param {object} rawPayload
 * @param {string | ArrayBuffer} secret
 * @param {JwtAlgorithm} [algorithm]
 * @returns
 */
export function createJwt(rawPayload: object, secret: string | ArrayBuffer, algorithm: JwtAlgorithm = 'HS256'): string {
  const header = b64encode(JSON.stringify({ typ: 'JWT', alg: algorithm }), 'rawurl')
  const payload = b64encode(JSON.stringify(rawPayload), 'rawurl')
  const hasher = c.createHMAC(algoMapping[algorithm], secret)
  hasher.update(`${header}.${payload}`)
  const signature = hasher.digest('base64rawurl')
  return `${header}.${payload}.${signature}`
}

/**
 *
 * @param type
 * @returns
 */
export async function createKey(type: JwtAlgorithm): Promise<string> {
  const params = alorithmMapping[type]
  // TypeScript type narrowing to prevent problem with overload definitions of `generateKey()`
  if ('hash' in params) {
    const key = await crypto.subtle.generateKey(params, true, ['sign', 'verify'])
    console.log('HMAC', key)
  } else {
    const key = await crypto.subtle.generateKey(params, true, ['sign', 'verify'])
    console.log('ECDSA', key)
  }
  return ''
}
