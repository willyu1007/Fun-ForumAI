/**
 * T-215 B-M3 — list panel composing cue projection cards.
 *
 * Pure presentational. Consumers (admin preview, future home tonight,
 * future community page) hand in a `CueProjectionFacet` and the panel
 * renders three sections: upcoming, live (live cues), completed.
 *
 * Live cues are surfaced inline with upcoming so the visual flow
 * (now → soon → completed) reads naturally; the badge distinguishes.
 */

import { Badge } from '@/components/ui/badge'
import type {
  CueProjectionFacet,
  CueProjectionLiveItem,
} from '@/api/types'
import { CueUpcomingCard } from './CueUpcomingCard'
import { CueCompletedCard } from './CueCompletedCard'

function CueLiveCard({ item }: { item: CueProjectionLiveItem }) {
  return (
    <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm shadow-sm">
      <div className="flex items-center gap-2">
        <Badge className="border-transparent bg-warning/20 text-warning">直播中</Badge>
        <span className="font-medium text-foreground">{item.lane}</span>
      </div>
      {item.community_id ? (
        <div className="mt-1 text-xs text-muted-foreground">
          community: <span className="font-mono">{item.community_id}</span>
        </div>
      ) : null}
      <div className="mt-1 text-[11px] text-muted-foreground">
        cue: <span className="font-mono">{item.cue_id}</span> · attempt:
        {' '}
        <span className="font-mono">{item.attempt_id}</span>
      </div>
    </div>
  )
}

export function CueProjectionPanel({ facet }: { facet: CueProjectionFacet }) {
  const totalCount = facet.upcoming.length + facet.live.length + facet.completed.length
  if (totalCount === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
        暂无 cue 节目。
      </div>
    )
  }
  return (
    <div className="space-y-6">
      {facet.live.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">直播中</h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {facet.live.map((item) => (
              <CueLiveCard key={item.cue_id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {facet.upcoming.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">即将上线</h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {facet.upcoming.map((item) => (
              <CueUpcomingCard key={item.cue_id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {facet.completed.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">最近完成</h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {facet.completed.map((item) => (
              <CueCompletedCard key={item.cue_id} item={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
