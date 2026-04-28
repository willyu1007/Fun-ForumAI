/**
 * T-210 M3 — pre-publish preview panel.
 *
 * Renders the 5-stage chain output. Stages with `source: 'stub_until_t21X'`
 * surface an info banner so admins know the result is a placeholder.
 */

import { Badge } from '@/components/ui/badge'
import { StatusBadge as UiStatusBadge, type StatusTone } from '@fun-forum/ui-web/patterns'
import type { CuePreviewPayload, PreviewStage } from '@/api/types'

const STAGE_LABEL: Record<PreviewStage['stage'], string> = {
  schema: '1. Schema validation',
  deterministic: '2. Deterministic checks (forbidden / locked / time / scope)',
  load: '3. Load preview (cached ~30 秒 TTL；admission 路径独立读取实时 snapshot)',
  media: '4. Media revalidation',
  director_compile: '5. Director brief dry-run (T-212 supplies; stub placeholder)',
}

function previewStatusToTone(status: PreviewStage['status']): StatusTone {
  switch (status) {
    case 'ok':
      return 'success'
    case 'warning':
      return 'warning'
    case 'error':
      return 'danger'
  }
}

export function PreviewPanel({
  result,
  loading,
  error,
}: {
  result: CuePreviewPayload | null
  loading?: boolean
  error?: string | null
}) {
  if (loading) {
    return (
      <div className="rounded border border-border/60 bg-muted/10 p-3 text-xs text-muted-foreground">
        正在执行 5 段 preview…
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
        Preview 失败：{error}
      </div>
    )
  }
  if (!result) {
    return (
      <div className="rounded border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
        点击"运行 preview"以预先校验当前 cue 状态。
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">overall</span>
        <UiStatusBadge tone={previewStatusToTone(overallToStatus(result.overall))}>
          {result.overall}
        </UiStatusBadge>
      </div>
      <ul className="space-y-2">
        {result.stages.map((stage) => (
          <li
            key={stage.stage}
            className="rounded border border-border/60 bg-muted/10 p-2 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{STAGE_LABEL[stage.stage]}</span>
              <UiStatusBadge tone={previewStatusToTone(stage.status)}>{stage.status}</UiStatusBadge>
              {stage.source ? (
                <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                  {stage.source}
                </Badge>
              ) : null}
            </div>
            {stage.source === 'stub_until_t213' ? (
              <p className="mt-1 text-[10px] text-warning">
                T-213 cue-load-control 上线后此段才显示真实 load snapshot
              </p>
            ) : null}
            {stage.source === 'load_signal_service:cached' ? (
              <p className="mt-1 text-[10px] text-muted-foreground">
                来自缓存（~30 秒 TTL）；admission 路径读取实时 snapshot
              </p>
            ) : null}
            <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/30 p-2 text-[10px]">
              {JSON.stringify(stage.payload, null, 2)}
            </pre>
          </li>
        ))}
      </ul>
    </div>
  )
}

function overallToStatus(overall: CuePreviewPayload['overall']): PreviewStage['status'] {
  if (overall === 'has_errors') return 'error'
  if (overall === 'has_warnings') return 'warning'
  return 'ok'
}
