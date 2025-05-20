import { fail } from 'k6'
import { type Response } from 'k6/http'

export function getClientID(r: Response): string {
  const clientId = r.json('clientId')
  if (clientId !== null && typeof clientId === 'string') return clientId
  fail('Client ID not found')
}

export function getCodeFromUrl(url: string): string {
  const code = /code=([^&]*)/.exec(url)
  if (code?.[1] != null) return code[1]
  fail('Code not found')
}

export function getAuthorizeauthorizeLocation(r: Response): string {
  const authorizeLocation = r.json('AuthorizeLocation')
  if (authorizeLocation !== null && typeof authorizeLocation === 'string') return authorizeLocation
  fail('AuthorizeLocation not found')
}

export function getclientassertion(r: Response): string {
  const client_assertion = r.body
  if (client_assertion !== null && typeof client_assertion === 'string') return client_assertion
  fail('client assertion is not found')
}
