import { Response } from 'k6/http'

export function validateAppCheckTokenResponse(res: Response): boolean {
  return res.json('token') !== undefined
}

export function validateClientAttestationResponse(res: Response): boolean {
  return res.json('client_attestation') !== undefined
}
