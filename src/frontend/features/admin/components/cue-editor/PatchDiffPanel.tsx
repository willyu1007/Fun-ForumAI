/**
 * T-210 M2 — patch diff display.
 *
 * Renders a single CueChange's patch_json with metadata. Reused by the audit
 * list (M4) and the auto-editor inbox (T-214).
 */

import { Badge } from '@/components/ui/badge'
import { StatusBadge as UiStatusBadge, type StatusTone } from '@fun-forum/ui-web/patterns'
import type { CueChangeDomain } from '@/api/types'

function sourceToTone(source: CueChangeDomain['source']): StatusTone {
  switch (source) {
    case 'manual':
      return 'neutral'
    case 'automated':
      return 'warning'
    case 'system':
      return 'info'
  }
}

function approvalToTone(status: CueChangeDomain['approval_status']): StatusTone {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'auto_applied':
    case 'approved':
      return 'success'
    case 'rejected':
      return 'danger'
    case 'rolled_back':
      return 'neutral'
  }
}

export function PatchDiffPanel({ change }: { change: CueChangeDomain }) {
  return (
    <div data-ui="card" data-variant="outlined" className="space-y-3 p-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono">{change.id}</span>
        <Badge variant="outline">{change.change_type}</Badge>
        <UiStatusBadge tone={sourceToTone(change.source)}>source:{change.source}</UiStatusBadge>
        <UiStatusBadge tone={approvalToTone(change.approval_status)}>
          {change.approval_status}
        </UiStatusBadge>
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
