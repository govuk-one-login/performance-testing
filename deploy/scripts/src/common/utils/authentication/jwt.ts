import {
  crypto,
  type HmacKeyGenParams,
  type EcKeyGenParams,
  type EcdsaParams,
  type CryptoKey,
  type Algorithm,
  type CryptoKeyPair
} from 'k6/experimental/webcrypto'
import { b64decode, b64encode } from 'k6/encoding'

// Supported JWT algorithms
export type HmacAlgorithm = 'HS256' | 'HS384' | 'HS512'
export type EcAlgorithm = 'ES256' | 'ES384' | 'ES512'
export type JwtAlgorithm = HmacAlgorithm | EcAlgorithm
export type JwtHeader = {
  typ: 'JWT'
  alg: JwtAlgorithm
}
export const algKeyMap: Record<JwtAlgorithm, HmacKeyGenParams | EcKeyGenParams> = {
  HS256: { name: 'HMAC', hash: 'SHA-256' },
  HS384: { name: 'HMAC', hash: 'SHA-384' },
  HS512: { name: 'HMAC', hash: 'SHA-512' },
  ES256: { name: 'ECDSA', namedCurve: 'P-256' },
  ES384: { name: 'ECDSA', namedCurve: 'P-384' },
  ES512: { name: 'ECDSA', namedCurve: 'P-521' }
}
export const algParamMap: Record<JwtAlgorithm, 'HMAC' | Algorithm<'HMAC'> | EcdsaParams> = {
  HS256: { name: 'HMAC' },
  HS384: { name: 'HMAC' },
  HS512: { name: 'HMAC' },
  ES256: { name: 'ECDSA', hash: 'SHA-256' },
  ES384: { name: 'ECDSA', hash: 'SHA-384' },
  ES512: { name: 'ECDSA', hash: 'SHA-512' }
}

/**
 * Create a key which can be used for signing JWTs
 * @param {JwtAlgorithm} type Algorithm to generate a key or key pair for
 * @returns {CryptoKey | CryptoKeyPair} Returns a crypto key or key pair depending on algorithm
 * @example
 * const hmacKey: CryptoKey = await createKey('HS256') // Key for HMAC
 * const keys: CryptoKeyPair = await createKey('ES256') // Public/private key pair for ECDSA
 * const publicKey = await crypto.subtle.exportKey('jwk', keys.publicKey)
 * const privateKey = await crypto.subtle.exportKey('jwk', keys.privateKey)
 */
export async function createKey(type: HmacAlgorithm): Promise<CryptoKey>
export async function createKey(type: EcAlgorithm): Promise<CryptoKeyPair>
export async function createKey(type: JwtAlgorithm): Promise<CryptoKey | CryptoKeyPair> {
  const params = algKeyMap[type]
  if ('hash' in params) {
    return crypto.subtle.generateKey(params, true, ['sign', 'verify'])
  }
  return crypto.subtle.generateKey(params, true, ['sign', 'verify'])
}

/**
 * Create a JWT token
 * @param {JwtAlgorithm} type Algorithm to use to sign the token
 * @param {CryptoKey} key CryptoKey to use for signing
 * @param {object} data Data payload to use in JWT
 * @returns {string} String representation of JWT
 * @example
 * // Import CryptoKey
 * const jwk = JSON.parse(open('./example-data/hs256-key.json')) as JWK
 * const key = await crypto.subtle.importKey('jwk', jwt, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
 * // Payload to sign
 * const payload = { iss: 'joe', exp: 1300819380, 'http://example.com/is_root': true }
 * // Create JWT string
 * const jwt = await signJwt('EC256', keys.privateKey, payload)
 */
export async function signJwt(type: JwtAlgorithm, key: CryptoKey, data: object): Promise<string> {
  const header = b64encode(JSON.stringify({ alg: type, typ: 'JWT' }), 'rawurl')
  const payload = b64encode(JSON.stringify(data), 'rawurl')
  const buf = strToBuf(`${header}.${payload}`)
  const sigBuf = await crypto.subtle.sign(algParamMap[type], key, buf)
  const signature = b64encode(sigBuf, 'rawurl')
  return `${header}.${payload}.${signature}`
}

/**
 * Verify a JWT signature
 * @param {string} jwt JWT in string format
 * @param {CryptoKey} key CryptoKey used for verification
 * @returns {boolean} Boolean indicating whether the signature has been verified
 * @example
 * const keys: CryptoKeyPair = await createKey('ES256')
 * const jwt = await signJwt('EC256', keys.privateKey, {'data':'value'})
 * const ok: boolean = await verifyJwt(jwt, keys.publicKey)
 * check(null, {
 *  'jwt valid': () => ok
 * })
 */
export async function verifyJwt(jwt: string, key: CryptoKey): Promise<boolean> {
  const token = jwt.split('.')
  const header: JwtHeader = JSON.parse(b64decode(token[0], 'rawurl', 's'))
  const params = algParamMap[header.alg]
  const data = strToBuf(`${token[0]}.${token[1]}`)
  const signature = b64decode(token[2], 'rawurl')
  return await crypto.subtle.verify(params, key, signature, data)
}

/**
 * Converts a string to an ArrayBuffer
 * @param {string} str String to convert
 * @returns {ArrayBuffer} ArrayBuffer result
 */
function strToBuf(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length)
  const bufView = new Uint8Array(buf)
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}
