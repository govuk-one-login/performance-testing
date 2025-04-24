import { Checkers } from 'k6'
import { Response } from 'k6/http'

export function validateRedirect(redirectUri: string, requiredQueryParams?: string[]): Checkers<Response> {
  return {
    validateRedirectUrl: res => {
      const url = new URL(res.headers.Location)
      return `${url.origin}${url.pathname}` === redirectUri
    },
    ...(requiredQueryParams
      ? {
          validateQueryParameters: res => {
            const url = new URL(res.headers.Location)
            return requiredQueryParams.every(param => url.searchParams.has(param))
          }
        }
      : {})
  }
}

// TODO: Ask if these types of assertions should be kept or not - it is implied by the STS specification that if the status code is 200, then these fields should already be present, so perhaps checking their presence is redundant for a performance test
export function validateGenerateClientAttestationResponse(res: Response): boolean {
  return res.json('client_attestation') !== undefined
}

export function validateAccessTokenResponse(res: Response): boolean {
  return res.json('access_token') !== undefined && res.json('id_token') !== undefined
}

export function validateTokenExchangeResponse(res: Response): boolean {
  return res.json('access_token') !== undefined
}
