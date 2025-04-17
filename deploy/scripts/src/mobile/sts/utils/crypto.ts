import { algParamMap, JwtAlgorithm } from '../../../common/utils/authentication/jwt'
import { b64encode } from 'k6/encoding'

// I'm aware that there are existing cryptographic functions in the common utils
// However I noticed that the k6 crypto library is marked as deprecated (see https://grafana.com/docs/k6/latest/javascript-api/k6-experimental/webcrypto/),
// so I implemented functions like signJwt, etc. specifically as utils for STS, which could eventually replace the common utils,
// but I didn't want to risk breaking any existing performance test scripts

export async function signJwt(
  type: JwtAlgorithm,
  key: CryptoKey,
  payload: object,
  additionalHeaderParameters: object
): Promise<string> {
  const encodedHeader = b64encode(JSON.stringify({ alg: type, typ: 'JWT', ...additionalHeaderParameters }), 'rawurl')
  const encodedPayload = b64encode(JSON.stringify(payload), 'rawurl')
  const buf = strToBuf(`${encodedHeader}.${encodedPayload}`)
  const sigBuf = await crypto.subtle.sign(algParamMap[type], key, buf)
  const signature = b64encode(sigBuf, 'rawurl')
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const data = strToBuf(codeVerifier)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return b64encode(buf, 'rawurl')
}

export async function generateKey() {
  return await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
}

export function strToBuf(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length)
  const bufView = new Uint8Array(buf)
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}
