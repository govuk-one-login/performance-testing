import { type Response } from 'k6/http'
import { check } from 'k6'

export function checkStatusCode (statusCode: number, res: Response): boolean {
  return check(res, {
    'HTTP Response Status Validation': (r) => r.status === statusCode
  })
}

export function validatePageContent (res: Response, pageContent: string): boolean {
  return check(res, {
    'Validate page content': (r) => (r.body as string).includes(pageContent)
  })
}
