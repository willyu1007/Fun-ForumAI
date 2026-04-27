/**
 * T-215 B-M3 — public cue projection card (completed).
 *
 * Renders a single completed cue with a deep-link to the resulting
 * forum post. Pure presentational. `result_url` is server-rendered
 * (via the configured `postUrlBase`); when missing, the card falls
 * back to displaying just the post id without a link so the consumer
 * can still surface the audit reference.
 */

import { Badge } from '@/components/ui/badge'
import type { CueProjectionCompletedItem } from '@/api/types'

function formatCompleted(iso: string): string {
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

export function CueCompletedCard({ item }: { item: CueProjectionCompletedItem }) {
  return (
    <div className="rounded-md border border-border/60 bg-card p-3 text-sm shadow-sm">
      <div className="flex items-center gap-2">
        <Badge className="border-transparent bg-success/10 text-success">已完成</Badge>
        <span className="font-medium text-foreground">{formatCompleted(item.completed_at)}</span>
      </div>
      {item.community_id ? (
        <div className="mt-1 text-xs text-muted-foreground">
          community: <span className="font-mono">{item.community_id}</span>
        </div>
      ) : null}
      {item.result_post_id ? (
        item.result_url ? (
          <a
            href={item.result_url}
            className="mt-1 block text-xs text-primary hover:underline"
            target="_blank"
            rel="noreferrer noopener"
          >
            查看帖子 → {item.result_post_id}
          </a>
        ) : (
          <div className="mt-1 text-xs text-muted-foreground">
            post: <span className="font-mono">{item.result_post_id}</span>
          </div>
        )
      ) : (
        <div className="mt-1 text-xs text-muted-foreground">未产出帖子</div>
      )}
      <div className="mt-1 text-[11px] text-muted-foreground">
        cue: <span className="font-mono">{item.cue_id}</span>
      </div>
    </div>
  )
}
