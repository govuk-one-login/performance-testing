import { type Response } from 'k6/http'
import { check } from 'k6'

export function isStatusCode200 (res: Response): boolean {
  return check(res, {
    'is status 200': (r) => r.status === 200
  })
}

export function isStatusCode302 (res: Response): boolean {
  return check(res, {
    'is status 302': (r) => r.status === 302
  })
}

export function validatePageContent (res: Response, pageContent: string): boolean {
  return check(res, {
    'validate page content': (r) => (r.body as string).includes(pageContent)
  })
}
