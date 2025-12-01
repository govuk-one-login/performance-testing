import { algParamMap, JwtAlgorithm } from '../../common/utils/authentication/jwt'
import { b64encode } from 'k6/encoding'

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

export function bufToString(buf: ArrayBuffer): string {
  let str = ''
  const bufView = new Uint8Array(buf)
  for (let i = 0, bufLen = bufView.length; i < bufLen; i++) {
    str += String.fromCharCode(bufView[i])
  }
  return str
}

export function getPublicKeyJwkForPrivateKey(privateKeyJwk: JsonWebKey) {
  return {
    kty: privateKeyJwk.kty,
    x: privateKeyJwk.x,
    y: privateKeyJwk.y,
    crv: privateKeyJwk.crv
  }
}
