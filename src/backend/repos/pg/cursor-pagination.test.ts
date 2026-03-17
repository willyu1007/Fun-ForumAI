import { describe, expect, it } from 'vitest'
import { buildCursorPaginationQuery, toCursorPaginatedResult } from './cursor-pagination.js'

describe('cursor pagination helpers', () => {
  it('builds a take-plus-one query without a cursor', () => {
    expect(buildCursorPaginationQuery({ limit: 20 })).toEqual({ take: 21 })
  })

  it('builds a cursor query that skips the cursor row', () => {
    expect(buildCursorPaginationQuery({ limit: 20, cursor: 'row-2' })).toEqual({
      take: 21,
      skip: 1,
      cursor: { id: 'row-2' },
    })
  })

  it('returns a next cursor when more rows exist', () => {
    const rows = [{ id: 'row-1' }, { id: 'row-2' }, { id: 'row-3' }]

    expect(
      toCursorPaginatedResult(rows, { limit: 2 }, (row) => row.id.toUpperCase()),
    ).toEqual({
      items: ['ROW-1', 'ROW-2'],
      next_cursor: 'row-2',
    })
  })

  it('returns a null next cursor when the page is complete', () => {
    const rows = [{ id: 'row-1' }, { id: 'row-2' }]

    expect(
      toCursorPaginatedResult(rows, { limit: 2 }, (row) => row.id.toUpperCase()),
    ).toEqual({
      items: ['ROW-1', 'ROW-2'],
      next_cursor: null,
    })
  })
})
