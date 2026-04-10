import { describe, expect, it, vi } from 'vitest'
import { PgPublicStageTurnRepository } from '../pg/pg-public-stage-turn-repository.js'

type PublicStageTurnRow = {
  id: string
  threadId: string
  postId: string
  authorActorType: 'AGENT' | 'HUMAN'
  authorAgentId: string | null
  authorUserId: string | null
  turnIndex: number
  anchorTurnId: string | null
  anchorIntent: string | null
  quotedExcerpt: string | null
  body: string
  visibility: 'PUBLIC' | 'GRAY'
  state: 'APPROVED'
  createdAt: Date
  updatedAt: Date
}

function makeTurn(index: number): PublicStageTurnRow {
  const createdAt = new Date(Date.UTC(2026, 3, 10, 0, 0, index))
  return {
    id: `turn-${index}`,
    threadId: 'thread-1',
    postId: 'post-1',
    authorActorType: 'AGENT',
    authorAgentId: 'agent-1',
    authorUserId: null,
    turnIndex: index,
    anchorTurnId: null,
    anchorIntent: null,
    quotedExcerpt: null,
    body: `turn ${index}`,
    visibility: 'PUBLIC',
    state: 'APPROVED',
    createdAt,
    updatedAt: createdAt,
  }
}

describe('PgPublicStageTurnRepository', () => {
  it('backfills the before side when an around-window focus is near the end', async () => {
    const rows = [1, 2, 3, 4, 5].map(makeTurn)
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([rows[3], rows[2], rows[1], rows[0]])
      .mockResolvedValueOnce([rows[4]])
    const repo = new PgPublicStageTurnRepository({
      publicStageTurn: {
        findFirst: vi.fn(async () => rows[4]),
        findMany,
      },
    } as never)

    const result = await repo.findWindowByThread('thread-1', {
      aroundTurnId: 'turn-5',
      limit: 5,
    })

    expect(result.items.map((item) => item.id)).toEqual([
      'turn-1',
      'turn-2',
      'turn-3',
      'turn-4',
      'turn-5',
    ])
    expect(result.next_cursor).toBeNull()
    expect(result.returned_mode).toBe('around')
    expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ take: 4 }))
    expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ take: 6 }))
  })

  it('keeps a centered around-window and reports a cursor when more after rows exist', async () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(makeTurn)
    const repo = new PgPublicStageTurnRepository({
      publicStageTurn: {
        findFirst: vi.fn(async () => rows[4]),
        findMany: vi
          .fn()
          .mockResolvedValueOnce([rows[3], rows[2], rows[1], rows[0]])
          .mockResolvedValueOnce([rows[4], rows[5], rows[6], rows[7], rows[8], rows[9]]),
      },
    } as never)

    const result = await repo.findWindowByThread('thread-1', {
      aroundTurnId: 'turn-5',
      limit: 5,
    })

    expect(result.items.map((item) => item.id)).toEqual([
      'turn-3',
      'turn-4',
      'turn-5',
      'turn-6',
      'turn-7',
    ])
    expect(result.next_cursor).toBe('turn-7')
    expect(result.returned_mode).toBe('around')
  })
})
