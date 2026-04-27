/**
 * T-215 B-M3 closer — public cue projection container.
 *
 * Production-ready data-bound wrapper around `CueProjectionPanel`.
 * Mounts on home tonight + community pages (consumers pass
 * `communityId` to scope to a single community; omit for global).
 *
 * Self-fetches via `usePublicCueProjection`. Empty / error states
 * gracefully render — never blocks the parent surface.
 */

import { usePublicCueProjection, type UsePublicCueProjectionParams } from '@/api/hooks/forum'
import { CueProjectionPanel } from './CueProjectionPanel'

export function PublicCueProjection(props: UsePublicCueProjectionParams) {
  const query = usePublicCueProjection(props)
  if (query.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading cues…</div>
  }
  if (query.error) {
    // Never block the parent — log once and emit empty state.
    console.error('[PublicCueProjection] query failed', query.error)
    return null
  }
  const facet = query.data?.data
  if (!facet) return null
  const total = facet.upcoming.length + facet.live.length + facet.completed.length
  if (total === 0) return null
  return <CueProjectionPanel facet={facet} />
}
