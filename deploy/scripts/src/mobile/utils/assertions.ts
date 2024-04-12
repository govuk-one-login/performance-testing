import { type Response } from 'k6/http'
import { type Checkers } from 'k6'
import { URL } from '../../common/utils/jslib/url'

export function validatePageRedirect(pageUrl: string): Checkers<Response> {
  return {
    'validate redirect url': (r) => {
      const url = new URL(r.url)
      return url.pathname.includes(pageUrl)
    }
  }
}

export function validateLocationHeader(res: Response): boolean {
  const url = new URL(res.headers.Location)
  return url.pathname.includes('/redirect')
}

export function validateQueryParam(param: string): Checkers<Response> {
  return {
    'validate query param': (res) => {
      const queryParams = new URL(res.headers.Location).searchParams
      return queryParams.get(param) !== null
    }
  }
}
