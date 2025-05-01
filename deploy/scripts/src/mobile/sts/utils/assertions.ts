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
