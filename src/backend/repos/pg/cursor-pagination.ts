import type { PaginatedResult, PaginationOpts } from '../types.js'

export function buildCursorPaginationQuery(opts: PaginationOpts): {
  take: number
  skip?: number
  cursor?: { id: string }
} {
  return {
    take: opts.limit + 1,
    ...(opts.cursor ? { skip: 1, cursor: { id: opts.cursor } } : {}),
  }
}

export function toCursorPaginatedResult<TRow extends { id: string }, TItem>(
  rows: TRow[],
  opts: PaginationOpts,
  map: (row: TRow) => TItem,
): PaginatedResult<TItem> {
  const hasMore = rows.length > opts.limit
  const page = hasMore ? rows.slice(0, opts.limit) : rows

  return {
    items: page.map(map),
    next_cursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
  }
}
