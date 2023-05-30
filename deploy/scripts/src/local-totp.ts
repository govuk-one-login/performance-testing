import TOTP from './utils/authentication/totp'

/* This script generates the TOTP when you want to login manually (on your local machine into Accounts test environment using the test users created by the bulk test user creation.
As Auth App Key is a secret, the value has been left blank in the repo. Please follow the below steps.

1.) Update the value of the Auth App Key used for bulk users in the below code.
2.) Run the script. This will print the TOTP on the console. Use the TOTP to login manually.
*/

export default function (): void {
  const secretKey = '' // Left blank - DO NOT COMMIT WITH THE VALUE OF THE AUTH APP KEY HERE
  const totp = new TOTP(secretKey)
  const code = totp.generateTOTP()

  console.log(code)
}
