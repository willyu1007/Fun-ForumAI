/**
 * T-215 B-M3 — admin preview tab for the public cue projection facet.
 *
 * Surfaces the same `CueProjectionFacet` the home tonight + community
 * pages would render so admins can verify sanitization (theme intent,
 * risk_level, allocator details all stripped at the server) and
 * inspect the actual upcoming / live / completed slate.
 *
 * Read-only. Server route is gated by `inspect_programming_audit`.
 */

import { useState } from 'react'
import { useAdminCueProjection } from '@/api/hooks'
import { CueProjectionPanel } from '@/features/programming/components/CueProjectionPanel'

export function CueProjectionPreviewTab() {
  const [communityId, setCommunityId] = useState('')
  const [lookahead, setLookahead] = useState(360) // 6h
  const [completedWindow, setCompletedWindow] = useState(1440) // 24h

  const query = useAdminCueProjection({
    ...(communityId ? { community_id: communityId } : {}),
    lookahead_minutes: lookahead,
    completed_window_minutes: completedWindow,
  })

  const facet = query.data?.data
  const total = facet
    ? facet.upcoming.length + facet.live.length + facet.completed.length
    : 0

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end gap-3 rounded-md border border-border/60 bg-muted/10 p-3">
        <label className="space-y-1 text-xs">
          <span className="block font-semibold text-muted-foreground">community_id（可选）</span>
          <input
            value={communityId}
            onChange={(e) => setCommunityId(e.target.value.trim())}
            placeholder="留空查看全部"
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="block font-semibold text-muted-foreground">lookahead (min)</span>
          <input
            type="number"
            value={lookahead}
            min={1}
            max={48 * 60}
            onChange={(e) => setLookahead(Number(e.target.value) || 360)}
            className="w-24 rounded border border-border bg-background px-2 py-1 text-xs"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="block font-semibold text-muted-foreground">completed window (min)</span>
          <input
            type="number"
            value={completedWindow}
            min={1}
            max={72 * 60}
            onChange={(e) => setCompletedWindow(Number(e.target.value) || 1440)}
            className="w-24 rounded border border-border bg-background px-2 py-1 text-xs"
          />
        </label>
        <span className="ml-auto text-xs text-muted-foreground">
          共 {total} 项
        </span>
      </header>

      {query.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : query.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          加载失败：{(query.error as Error).message}
        </div>
      ) : facet ? (
        <CueProjectionPanel facet={facet} />
      ) : (
        <div className="text-sm text-muted-foreground">无数据。</div>
      )}
    </div>
  )
}
