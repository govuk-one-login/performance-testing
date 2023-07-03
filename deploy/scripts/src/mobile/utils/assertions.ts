import { type Response } from 'k6/http'
import { check } from 'k6'
import { URL } from '../../common/utils/jslib/url'

export function isStatusCode200 (res: Response): boolean {
  return check(res, {
    'is status 200': (r) => r.status === 200
  })
}

export function isStatusCode201 (res: Response): boolean {
  return check(res, {
    'is status 201': (r) => r.status === 201
  })
}

export function isStatusCode302 (res: Response): boolean {
  return check(res, {
    'is status 302': (r) => r.status === 302
  })
}

export function validatePageRedirect (res: Response, pageUrl: string): boolean {
  return check(res, {
    'validate redirect url': (r) => {
      const url = new URL(r.url)
      return url.pathname.includes(pageUrl)
    }
  })
}

export function validatePageContent (res: Response, pageContent: string): boolean {
  return check(res, {
    'validate page content': (r) => (r.body as string).includes(pageContent)
  })
}

export function validateLocationHeader (res: Response): boolean {
  return check(res, {
    'validate redirect url': (res) => {
      const url = new URL(res.headers.Location)
      return url.pathname.includes('/redirect')
    }
  })
}

export function validateQueryParam (url: string, param: string): boolean {
  return check(url, {
    'validate query param': (url) => {
      const queryParams = new URL(url).searchParams
      return queryParams.get(param) !== null
    }
  })
}
