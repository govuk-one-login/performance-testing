import { fail } from 'k6'
import { type Response } from 'k6/http'

export function getAccessToken(r: Response): string {
  const accessToken = r.json('access_token')
  if (accessToken !== null && typeof accessToken === 'string') return accessToken
  fail('AccessToken not found')
}
