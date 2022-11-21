import { check, group } from 'k6';
import TOTP from './utils/authentication/totp';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1.00'],
  }
}

export default () => {
  group("totp", () => {
    // Examples from https://www.rfc-editor.org/rfc/rfc6238
    let sha1seed = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; //Ascii string "12345678901234567890" in base32
    let sha256seed = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA====';  // 32 byte seed
    let sha512seed = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA='; // 64 byte seed
    let sha1otp = new TOTP(sha1seed, 8, 'sha1');
    let sha256otp = new TOTP(sha256seed, 8, 'sha256');
    let sha512otp = new TOTP(sha512seed, 8, 'sha512');

    check(null, {
      '| SHA1   | T+59          |': () => sha1otp.generateTOTP(59 * 1000) === '94287082',
      '| SHA256 | T+1111111109  |': () => sha256otp.generateTOTP(1111111109 * 1000) === '68084774',
      '| SHA512 | T+1111111111  |': () => sha512otp.generateTOTP(1111111111 * 1000) === '99943326',
      '| SHA1   | T+1234567890  |': () => sha1otp.generateTOTP(1234567890 * 1000) === '89005924',
      '| SHA256 | T+2000000000  |': () => sha256otp.generateTOTP(2000000000 * 1000) === '90698825',
      '| SHA512 | T+20000000000 |': () => sha512otp.generateTOTP(20000000000 * 1000) === '47863826',
    });
  });
}
