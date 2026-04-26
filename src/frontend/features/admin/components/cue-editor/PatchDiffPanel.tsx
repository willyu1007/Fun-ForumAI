/**
 * T-210 M2 — patch diff display.
 *
 * Renders a single CueChange's patch_json with metadata. Reused by the audit
 * list (M4) and the auto-editor inbox (T-214).
 */

import { Badge } from '@/components/ui/badge'
import type { CueChangeDomain } from '@/api/types'

const APPROVAL_TONE: Record<CueChangeDomain['approval_status'], string> = {
  pending: 'border-warning/40 bg-warning/10 text-warning',
  auto_applied: 'border-success/40 bg-success/10 text-success',
  approved: 'border-success/40 bg-success/10 text-success',
  rejected: 'border-destructive/40 bg-destructive/10 text-destructive',
  rolled_back: 'border-muted/40 bg-muted/20 text-muted-foreground',
}

const SOURCE_TONE: Record<CueChangeDomain['source'], string> = {
  manual: 'border-border bg-muted/30 text-foreground',
  automated: 'border-warning/40 bg-warning/10 text-warning',
  system: 'border-border/60 bg-muted/10 text-muted-foreground',
}

export function PatchDiffPanel({ change }: { change: CueChangeDomain }) {
  return (
    <div data-ui="card" data-variant="outlined" className="space-y-3 p-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono">{change.id}</span>
        <Badge variant="outline">{change.change_type}</Badge>
        <Badge variant="outline" className={SOURCE_TONE[change.source]}>
          source:{change.source}
        </Badge>
        <Badge variant="outline" className={APPROVAL_TONE[change.approval_status]}>
          {change.approval_status}
        </Badge>
        {change.actor_user_id ? (
          <Badge variant="outline">actor:{change.actor_user_id}</Badge>
        ) : null}
        {change.actor_system ? (
          <Badge variant="outline">system:{change.actor_system}</Badge>
        ) : null}
        {change.base_revision !== null ? (
          <Badge variant="outline">base@rev{change.base_revision}</Badge>
        ) : null}
      </div>

      <p className="text-muted-foreground">
        created: {new Date(change.created_at).toLocaleString('zh-CN')}
        {change.applied_at ? ` · applied: ${new Date(change.applied_at).toLocaleString('zh-CN')}` : ''}
        {change.reason ? ` · reason: ${change.reason}` : ''}
      </p>

      <div>
        <p className="font-semibold text-muted-foreground">patch_json</p>
        <pre className="mt-1 max-h-72 overflow-auto rounded bg-muted/30 p-3 text-[10px]">
          {JSON.stringify(change.patch_json, null, 2)}
        </pre>
      </div>
    </div>
  )
}
