/**
 * T-216 M3 closer — media plan resolution audit dashboard.
 *
 * Renders the per-attempt `MediaPlanResolution` rows. Admin enters
 * either a cue_id (route pivots to the latest attempt) or an
 * attempt_id directly; the table shows the planner's decision per
 * pool item: which strength was requested, which outcome landed,
 * any reason marker, and (when present) the upstream
 * `image_planner_decision_id`.
 *
 * Read-only. Server route gated by `inspect_programming_audit`.
 */

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { useAdminMediaPlanResolutions } from '@/api/hooks'
import type {
  MediaPlanOutcome,
  MediaPlanResolutionRow,
} from '@/api/types'

const OUTCOME_TONE: Record<MediaPlanOutcome, string> = {
  runtime_context: 'border-border bg-muted/30 text-foreground',
  public_display: 'border-success/40 bg-success/10 text-success',
  derivative_source: 'border-primary/40 bg-primary/10 text-primary',
  not_used: 'border-border/60 bg-muted/10 text-muted-foreground',
  blocked: 'border-destructive/40 bg-destructive/10 text-destructive',
  degraded: 'border-warning/40 bg-warning/10 text-warning',
}

const STRENGTH_TONE: Record<MediaPlanResolutionRow['requested_strength'], string> = {
  optional: 'border-border/60 bg-muted/10 text-muted-foreground',
  preferred: 'border-border bg-muted/30 text-foreground',
  anchor: 'border-warning/40 bg-warning/10 text-warning',
  selected_only_pool: 'border-destructive/40 bg-destructive/10 text-destructive',
}

function formatTime(iso: string): string {
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

export function MediaPlanAuditTab() {
  const [mode, setMode] = useState<'cue' | 'attempt'>('cue')
  const [cueId, setCueId] = useState('')
  const [attemptId, setAttemptId] = useState('')
  const [submitted, setSubmitted] = useState<{ cue?: string; attempt?: string }>({})

  const params: Parameters<typeof useAdminMediaPlanResolutions>[0] = {
    enabled: Boolean(submitted.cue || submitted.attempt),
    limit: 100,
    ...(submitted.cue ? { cue_id: submitted.cue } : {}),
    ...(submitted.attempt ? { attempt_id: submitted.attempt } : {}),
  }
  const query = useAdminMediaPlanResolutions(params)
  const items = query.data?.data?.items ?? []
  const resolvedAttemptId = query.data?.data?.attempt_id ?? null

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end gap-3 rounded-md border border-border/60 bg-muted/10 p-3">
        <div className="space-y-1 text-xs">
          <span className="block font-semibold text-muted-foreground">查询模式</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'cue' | 'attempt')}
            className="rounded border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="cue">按 cue_id（取最新 attempt）</option>
            <option value="attempt">按 attempt_id</option>
          </select>
        </div>
        {mode === 'cue' ? (
          <label className="space-y-1 text-xs">
            <span className="block font-semibold text-muted-foreground">cue_id</span>
            <input
              value={cueId}
              onChange={(e) => setCueId(e.target.value.trim())}
              placeholder="cue_..."
              className="rounded border border-border bg-background px-2 py-1 text-xs"
            />
          </label>
        ) : (
          <label className="space-y-1 text-xs">
            <span className="block font-semibold text-muted-foreground">attempt_id</span>
            <input
              value={attemptId}
              onChange={(e) => setAttemptId(e.target.value.trim())}
              placeholder="attempt_..."
              className="rounded border border-border bg-background px-2 py-1 text-xs"
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => {
            if (mode === 'cue') setSubmitted({ cue: cueId || undefined })
            else setSubmitted({ attempt: attemptId || undefined })
          }}
          disabled={mode === 'cue' ? !cueId : !attemptId}
          className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
        >
          查询
        </button>
        {resolvedAttemptId ? (
          <span className="ml-auto text-xs text-muted-foreground">
            attempt: <span className="font-mono">{resolvedAttemptId}</span> · {items.length} 行
          </span>
        ) : null}
      </header>

      {query.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : query.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          加载失败：{(query.error as Error).message}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          {submitted.cue || submitted.attempt
            ? '未找到 MediaPlanResolution 记录。'
            : '请输入 cue_id 或 attempt_id 后点击查询。'}
        </div>
      ) : (
        <div className="overflow-auto rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="p-2 text-left">asset_id</th>
                <th className="p-2 text-left">role</th>
                <th className="p-2 text-left">requested_strength</th>
                <th className="p-2 text-left">plan_outcome</th>
                <th className="p-2 text-left">reason</th>
                <th className="p-2 text-left">created_at</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-border/40">
                  <td className="p-2 font-mono text-xs">{row.asset_id}</td>
                  <td className="p-2 text-xs">{row.requested_role}</td>
                  <td className="p-2">
                    <Badge className={`border-transparent ${STRENGTH_TONE[row.requested_strength]}`}>
                      {row.requested_strength}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <Badge className={`border-transparent ${OUTCOME_TONE[row.plan_outcome]}`}>
                      {row.plan_outcome}
                    </Badge>
                  </td>
                  <td className="p-2 font-mono text-[11px]">{row.reason ?? '—'}</td>
                  <td className="p-2 text-xs text-muted-foreground">{formatTime(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
