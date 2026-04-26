/**
 * T-215 B-M3 — public cue projection card (upcoming).
 *
 * Renders a single upcoming cue entry. Pure presentational; the
 * consumer hands in a `CueProjectionUpcomingItem` (already sanitized
 * server-side via `CUE_PROJECTION_FORBIDDEN_KEYS`). Internal theme
 * intent / risk_level / allocator details never enter this component.
 *
 * Display shape:
 *   - countdown label derived from `trigger_at`
 *   - lane badge (prime / standard / background)
 *   - community id (caller resolves to slug/name in a richer surface)
 */

import { Badge } from '@/components/ui/badge'
import type { CueProjectionUpcomingItem, CueProjectionLane } from '@/api/types'

const LANE_TONE: Record<CueProjectionLane, string> = {
  prime: 'border-warning/40 bg-warning/10 text-warning',
  standard: 'border-border bg-muted/30 text-foreground',
  background: 'border-border/60 bg-muted/10 text-muted-foreground',
}

function formatTrigger(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}

function formatRelative(iso: string, now = Date.now()): string | null {
  try {
    const diffMs = new Date(iso).getTime() - now
    if (Number.isNaN(diffMs)) return null
    if (diffMs <= 0) return '已开始'
    const minutes = Math.round(diffMs / 60_000)
    if (minutes < 60) return `${minutes} 分钟后`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours} 小时后`
    const days = Math.round(hours / 24)
    return `${days} 天后`
  } catch {
    return null
  }
}

export function CueUpcomingCard({ item }: { item: CueProjectionUpcomingItem }) {
  const relative = formatRelative(item.trigger_at)
  return (
    <div className="rounded-md border border-border/60 bg-card p-3 text-sm shadow-sm">
      <div className="flex items-center gap-2">
        <Badge className={`border-transparent ${LANE_TONE[item.lane]}`}>{item.lane}</Badge>
        <span className="font-medium text-foreground">{formatTrigger(item.trigger_at)}</span>
        {relative ? (
          <span className="text-xs text-muted-foreground">· {relative}</span>
        ) : null}
      </div>
      {item.community_id ? (
        <div className="mt-1 text-xs text-muted-foreground">
          community: <span className="font-mono">{item.community_id}</span>
        </div>
      ) : null}
      <div className="mt-1 text-[11px] text-muted-foreground">
        cue: <span className="font-mono">{item.cue_id}</span>
      </div>
    </div>
  )
}
