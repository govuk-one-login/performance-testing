import { fail } from 'k6'
import { type Response } from 'k6/http'

export function getURI(r: Response): string {
  const uriValue = r.json('uri')
  if (uriValue !== null && typeof uriValue === 'string') return uriValue
  fail('URI not found')
}

export function getIDX(r: Response): string {
  const idxValue = r.json('idx')
  if (idxValue !== null && typeof idxValue === 'string') return idxValue
  fail('IDX not found')
}
