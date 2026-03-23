import type { SearchCursorPayload } from '../../repos/types.js'

function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function encodeBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

export function encodeSearchCursor(payload: SearchCursorPayload | null): string | null {
  if (!payload) return null
  return encodeBase64(JSON.stringify(payload))
}

export function decodeSearchCursor(cursor: string | undefined): SearchCursorPayload | undefined {
  if (!cursor) return undefined
  try {
    const parsed = JSON.parse(decodeBase64(cursor)) as Partial<SearchCursorPayload>
    if (typeof parsed.id !== 'string' || typeof parsed.score !== 'number') {
      return undefined
    }
    return {
      id: parsed.id,
      score: Number(parsed.score.toFixed(6)),
    }
  } catch {
    return undefined
  }
}
