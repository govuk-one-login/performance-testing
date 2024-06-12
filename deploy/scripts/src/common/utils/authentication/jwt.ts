import crypto, { type Algorithm } from 'k6/crypto'
import { b64encode } from 'k6/encoding'

// Supported JWT algorithms
export type JwtAlgorithm = 'HS256' | 'HS384' | 'HS512'
const algoMapping: Record<JwtAlgorithm, Algorithm> = {
  HS256: 'sha256',
  HS384: 'sha384',
  HS512: 'sha512'
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
  const hasher = crypto.createHMAC(algoMapping[algorithm], secret)
  hasher.update(`${header}.${payload}`)
  const signature = hasher.digest('base64rawurl')
  return `${header}.${payload}.${signature}`
}
