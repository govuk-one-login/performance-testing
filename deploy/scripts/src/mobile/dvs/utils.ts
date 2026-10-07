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
  const mdoc = cborDecode(bytes, { pos: 0 })

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
  const mso = cborDecode(msoBytes, { pos: 0 })
  const statusEntry = mso['status'] as Record<string, unknown>
  const statusList = statusEntry['status_list'] as Record<string, unknown>

  return {
    documentNumber,
    statusListUri: statusList['uri'] as string,
    statusListIdx: statusList['idx'] as number
  }
}

// Minimal CBOR decoder supporting the subset needed for mDoc parsing
// Handles: unsigned int, byte string, text string, array, map, tag (24 = embedded CBOR)
export function cborDecode(bytes: Uint8Array, state: { pos: number }): Record<string, unknown> & unknown {
  const initialByte = bytes[state.pos++]
  const majorType = (initialByte >> 5) & 0x07
  const additionalInfo = initialByte & 0x1f

  const readLength = (info: number): number => {
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

  switch (majorType) {
    case 0: // unsigned int
      return readLength(additionalInfo) as unknown as Record<string, unknown>
    case 1: // negative int: value is -1 - n
      return (-1 - readLength(additionalInfo)) as unknown as Record<string, unknown>
    case 2: {
      // byte string
      const len = readLength(additionalInfo)
      const slice = bytes.slice(state.pos, state.pos + len)
      state.pos += len
      return slice as unknown as Record<string, unknown>
    }
    case 3: {
      // text string
      const len = readLength(additionalInfo)
      const slice = bytes.slice(state.pos, state.pos + len)
      state.pos += len
      return bufToString(slice.buffer as ArrayBuffer) as unknown as Record<string, unknown>
    }
    case 4: {
      // array (definite or indefinite length)
      const arr: unknown[] = []
      if (additionalInfo === 31) {
        while (bytes[state.pos] !== 0xff) arr.push(cborDecode(bytes, state))
        state.pos++ // consume break byte
      } else {
        const len = readLength(additionalInfo)
        for (let i = 0; i < len; i++) arr.push(cborDecode(bytes, state))
      }
      return arr as unknown as Record<string, unknown>
    }
    case 5: {
      // map (definite or indefinite length)
      const map: Record<string, unknown> = {}
      if (additionalInfo === 31) {
        while (bytes[state.pos] !== 0xff) {
          const key = cborDecode(bytes, state) as unknown as string | number
          map[String(key)] = cborDecode(bytes, state)
        }
        state.pos++ // consume break byte
      } else {
        const len = readLength(additionalInfo)
        for (let i = 0; i < len; i++) {
          const key = cborDecode(bytes, state) as unknown as string | number
          map[String(key)] = cborDecode(bytes, state)
        }
      }
      return map
    }
    case 6: {
      // tag
      const tag = readLength(additionalInfo)
      const value = cborDecode(bytes, state)
      if (tag === 24) {
        // Embedded CBOR: value is a byte string, decode it
        return cborDecode(value as unknown as Uint8Array, { pos: 0 })
      }
      return value
    }
    case 7: {
      // simple values: false, true, null, undefined; also float16 (0xf9)
      if (additionalInfo === 20) return false as unknown as Record<string, unknown>
      if (additionalInfo === 21) return true as unknown as Record<string, unknown>
      if (additionalInfo === 22 || additionalInfo === 23) return null as unknown as Record<string, unknown>
      if (additionalInfo === 25) {
        // float16 — decode to JS number
        const u16 = (bytes[state.pos] << 8) | bytes[state.pos + 1]
        state.pos += 2
        const exp = (u16 >> 10) & 0x1f
        const mant = u16 & 0x3ff
        let val: number
        if (exp === 0) val = mant * (1 / (1 << 24))
        else if (exp === 31) val = mant ? NaN : Infinity
        else val = (1 + mant / 1024) * (1 << (exp - 15))
        return (u16 & 0x8000 ? -val : val) as unknown as Record<string, unknown>
      }
      throw new Error(`Unsupported CBOR simple/float value: ${additionalInfo}`)
    }
    default:
      throw new Error(`Unsupported CBOR major type: ${majorType}`)
  }
}
