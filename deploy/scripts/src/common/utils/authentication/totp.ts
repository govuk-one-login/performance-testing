import crypto, { type Algorithm } from 'k6/crypto'

/**
 * Implementation of RFC 6238 algorithm to generate TOTP codes
 * https://www.rfc-editor.org/rfc/rfc6238
 */
export default class TOTP {
  key: ArrayBuffer

  /**
   * TOTP constructor class
   * @param {string} base32key Required TOTP key in base32 string RFC 4648 format
   * @param {number} [digits] Number of digits for the TOTP, defaults to `6`
   * @param {Algorithm} [algorithm] Hashing algorithm to use, defaults to `sha1`
   * @param {number} [period] Time period in seconds, defaults to `30`
   * @param {number} [startTime] Unix start time to use in seconds, defaults to `0`
   * @example
   * const seed = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' // Ascii string "12345678901234567890" in base32
   * const totp = new TOTP(seed, 8)
   */
  constructor(
    base32key: string,
    private readonly digits = 6,
    private readonly algorithm: Algorithm = 'sha1',
    private readonly period = 30,
    private readonly startTime = 0
  ) {
    this.key = base32ToBytes(base32key)
  }

  /**
   * Calculates the number of time steps
   * @param {number} timestamp Timestamp in milliseconds
   * @returns {ArrayBuffer}  Byte array representing the number of time steps elapsed since the start time
   */
  calculateTime(timestamp: number): ArrayBuffer {
    const seconds = Math.round(timestamp / 1000) - this.startTime
    const steps = Math.floor(seconds / this.period)
    const hexSteps = decToHex(steps).padStart(16, '0')
    return hexToBytes(hexSteps)
  }

  /**
   * Returns TOTP with current time, or specified timestamp in milliseconds
   * See RFC 6238 for more details
   * @param {number} [timestamp] Unix timestamp, in milliseconds, to generate the TOTP for. Defaults to `Date.now()`
   * @returns {string} String value of the time-based one-time password
   * @example
   * const seed = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' // Ascii string "12345678901234567890" in base32
   * const totp = new TOTP(seed)
   * const password = totp.generateTOTP()
   */
  public generateTOTP(timestamp: number = Date.now()): string {
    const time = this.calculateTime(timestamp)

    const hash = crypto.hmac(this.algorithm, this.key, time, 'hex')
    const offset = hexToDec(hash.slice(-1)) * 2
    const totp = (hexToDec(hash.slice(offset, offset + 8)) & 0x7fffffff).toString()
    return totp.slice(-this.digits)
  }
}

// Converts a hex string to a byte array
function hexToBytes(hex: string): ArrayBuffer {
  const bytes: number[] = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16))
  }
  return new Uint8Array(bytes).buffer
}

// Converts a hex string to a decimal
function hexToDec(s: string): number {
  return parseInt(s, 16)
}

// Converts a decimal to a hex string
function decToHex(d: number): string {
  return Math.round(d).toString(16).padStart(2, '0')
}

// Converts a (RFC 4648) base32 string to a byte array
function base32ToBytes(base32: string): ArrayBuffer {
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567' // pragma: allowlist secret
  let bits = ''
  const bytes: number[] = []

  // Removes padding chars, if any
  base32 = base32.replace(/={1,7}$/, '')

  // Converts base32 string to bits
  for (let i = 0; i < base32.length; i++) {
    const val = base32chars.indexOf(base32.charAt(i))
    if (val === -1) throw new Error('Invalid base32 character in key')
    bits += val.toString(2).padStart(5, '0')
  }

  // Chunks bits to bytes
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return new Uint8Array(bytes).buffer
}
