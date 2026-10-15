import { b64decode } from 'k6/encoding'
import { uuidv4 } from '../../common/utils/jslib'
import { bufToString, signJwt } from '../utils/crypto'
import { credentialOfferParams } from './config'

//Function to build an access token for the credential offer request
export async function buildAccessToken(
  privateKey: CryptoKey,
  preAuthClaims: Record<string, unknown>,
  cNonce: string,
  kid: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    sub: credentialOfferParams.walletSubjectId,
    iss: preAuthClaims['aud'] as string,
    aud: preAuthClaims['iss'] as string,
    jti: uuidv4(),
    exp: now + 180,
    credential_configuration_ids: preAuthClaims['credential_configuration_ids'],
    credential_identifiers: preAuthClaims['credential_identifiers'],
    c_nonce: cNonce
  }
  return signJwt('ES256', privateKey, payload, { typ: 'at+jwt', kid })
}

//Function to build a proof JWT for the credential offer request
export async function buildProofJwt(
  privateKey: CryptoKey,
  preAuthClaims: Record<string, unknown>,
  cNonce: string,
  didKey: string
): Promise<string> {
  const payload = {
    iss: 'urn:fdc:gov:uk:wallet',
    aud: preAuthClaims['iss'] as string,
    iat: Math.floor(Date.now() / 1000),
    nonce: cNonce
  }
  return signJwt('ES256', privateKey, payload, { typ: 'openid4vci-proof+jwt', kid: didKey })
}

// Function to extract pre-authorized_code from universal link
export function extractPreAuthCode(universalLink: string): string {
  const idx = universalLink.indexOf('credential_offer=')
  if (idx === -1) throw new Error('credential_offer param not found in universal link')
  const encoded = universalLink.slice(idx + 'credential_offer='.length)
  const offer = JSON.parse(decodeURIComponent(encoded)) as {
    grants: { 'urn:ietf:params:oauth:grant-type:pre-authorized_code': { 'pre-authorized_code': string } }
  }
  return offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['pre-authorized_code']
}

const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz' //pragma: allowlist secret

// Function to encode a byte array to a base58 string
export function base58Encode(bytes: Uint8Array): string {
  // Work with a mutable copy as an array of digits in base 58
  const digits = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8
      digits[i] = carry % 58
      carry = Math.floor(carry / 58)
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }
  let result = ''
  for (let i = digits.length - 1; i >= 0; i--) {
    result += base58Alphabet[digits[i]]
  }
  for (const byte of bytes) {
    if (byte === 0) result = '1' + result
    else break
  }
  return result
}

//Convert base64url string to Uint8Array
function base64urlToBytes(b64url: string): Uint8Array {
  const binary = b64decode(b64url, 'rawurl')
  return new Uint8Array(binary as unknown as ArrayBuffer)
}

// Build DID Key: https://w3c-ccg.github.io/did-method-key/#p256
export function buildDidKey(publicKeyJwk: JsonWebKey): string {
  // Compress the P-256 public key: 0x02 or 0x03 prefix + x coordinate
  const x = base64urlToBytes(publicKeyJwk.x!)
  const y = base64urlToBytes(publicKeyJwk.y!)
  const prefix = (y[y.length - 1] & 1) === 0 ? 0x02 : 0x03
  const compressed = new Uint8Array(33)
  compressed[0] = prefix
  compressed.set(x, 1)

  // Multicodec prefix for P-256: 0x1200 (varint encoded)
  const multicodec = new Uint8Array([0x80, 0x24]) // varint for 0x1200
  const multicodecKey = new Uint8Array(multicodec.length + compressed.length)
  multicodecKey.set(multicodec)
  multicodecKey.set(compressed, multicodec.length)

  return `did:key:z${base58Encode(multicodecKey)}`
}

interface MdocFields {
  documentNumber: string
  statusListUri: string
  statusListIdx: number
}

// Function to decode mDoc from base64url-encoded CBOR to extract document_number and status_list
export function decodeMdoc(credentialBase64url: string): MdocFields {
  const raw = b64decode(credentialBase64url, 'rawurl') as unknown as ArrayBuffer
  const bytes = new Uint8Array(raw)
  const mdoc = cborDecode(bytes, { pos: 0 }) as Record<string, unknown>

  // Credential is IssuerSigned directly: { nameSpaces, issuerAuth }
  const nameSpaces = mdoc['nameSpaces'] as Record<string, unknown[]>
  const mdlItems = nameSpaces['org.iso.18013.5.1'] as Array<Record<string, unknown>>
  let documentNumber = ''
  for (const item of mdlItems) {
    if (item['elementIdentifier'] === 'document_number') {
      documentNumber = item['elementValue'] as string
      break
    }
  }

  // issuerAuth is COSE Sign1: [protected, unprotected, payload, signature]
  const issuerAuth = mdoc['issuerAuth'] as unknown[]
  const msoBytes = issuerAuth[2] as Uint8Array
  const mso = cborDecode(msoBytes, { pos: 0 }) as Record<string, unknown>
  const statusEntry = mso['status'] as Record<string, unknown>
  const statusList = statusEntry['status_list'] as Record<string, unknown>

  return {
    documentNumber,
    statusListUri: statusList['uri'] as string,
    statusListIdx: statusList['idx'] as number
  }
}

type CborState = { pos: number }

function cborReadLength(bytes: Uint8Array, state: CborState, info: number): number {
  if (info <= 23) return info
  if (info === 24) return bytes[state.pos++]
  if (info === 25) {
    const v = (bytes[state.pos] << 8) | bytes[state.pos + 1]
    state.pos += 2
    return v
  }
  if (info === 26) {
    const v =
      (bytes[state.pos] << 24) | (bytes[state.pos + 1] << 16) | (bytes[state.pos + 2] << 8) | bytes[state.pos + 3]
    state.pos += 4
    return v
  }
  throw new Error(`Unsupported CBOR length encoding: ${info}`)
}

function cborDecodeBytes(bytes: Uint8Array, state: CborState, len: number): Uint8Array {
  const slice = bytes.slice(state.pos, state.pos + len)
  state.pos += len
  return slice
}

function cborDecodeArray(bytes: Uint8Array, state: CborState, additionalInfo: number): unknown[] {
  const arr: unknown[] = []
  if (additionalInfo === 31) {
    while (bytes[state.pos] !== 0xff) arr.push(cborDecode(bytes, state))
    state.pos++
  } else {
    const len = cborReadLength(bytes, state, additionalInfo)
    for (let i = 0; i < len; i++) arr.push(cborDecode(bytes, state))
  }
  return arr
}

function cborDecodeMap(bytes: Uint8Array, state: CborState, additionalInfo: number): Record<string, unknown> {
  const map: Record<string, unknown> = {}
  if (additionalInfo === 31) {
    while (bytes[state.pos] !== 0xff) {
      const key = cborDecode(bytes, state) as string | number
      map[String(key)] = cborDecode(bytes, state)
    }
    state.pos++
  } else {
    const len = cborReadLength(bytes, state, additionalInfo)
    for (let i = 0; i < len; i++) {
      const key = cborDecode(bytes, state) as string | number
      map[String(key)] = cborDecode(bytes, state)
    }
  }
  return map
}

function cborDecodeFloat16(bytes: Uint8Array, state: CborState): number {
  const u16 = (bytes[state.pos] << 8) | bytes[state.pos + 1]
  state.pos += 2
  const exp = (u16 >> 10) & 0x1f
  const mant = u16 & 0x3ff
  let val: number
  if (exp === 0) val = mant * (1 / (1 << 24))
  else if (exp === 31) val = mant ? Number.NaN : Infinity
  else val = (1 + mant / 1024) * (1 << (exp - 15))
  return u16 & 0x8000 ? -val : val
}

function cborDecodeSimple(bytes: Uint8Array, state: CborState, additionalInfo: number): unknown {
  if (additionalInfo === 20) return false
  if (additionalInfo === 21) return true
  if (additionalInfo === 22 || additionalInfo === 23) return null
  if (additionalInfo === 25) return cborDecodeFloat16(bytes, state)
  throw new Error(`Unsupported CBOR simple/float value: ${additionalInfo}`)
}

// Minimal CBOR decoder supporting the subset needed for mDoc parsing
// Handles: unsigned int, byte string, text string, array, map, tag (24 = embedded CBOR)
export function cborDecode(bytes: Uint8Array, state: CborState): unknown {
  const initialByte = bytes[state.pos++]
  const majorType = (initialByte >> 5) & 0x07
  const additionalInfo = initialByte & 0x1f

  switch (majorType) {
    case 0:
      return cborReadLength(bytes, state, additionalInfo)
    case 1:
      return -1 - cborReadLength(bytes, state, additionalInfo)
    case 2:
      return cborDecodeBytes(bytes, state, cborReadLength(bytes, state, additionalInfo))
    case 3: {
      const slice = cborDecodeBytes(bytes, state, cborReadLength(bytes, state, additionalInfo))
      return bufToString(slice.buffer as ArrayBuffer)
    }
    case 4:
      return cborDecodeArray(bytes, state, additionalInfo)
    case 5:
      return cborDecodeMap(bytes, state, additionalInfo)
    case 6: {
      const tag = cborReadLength(bytes, state, additionalInfo)
      const value = cborDecode(bytes, state)
      return tag === 24 ? cborDecode(value as Uint8Array, { pos: 0 }) : value
    }
    case 7:
      return cborDecodeSimple(bytes, state, additionalInfo)
    default:
      throw new Error(`Unsupported CBOR major type: ${majorType}`)
  }
}
