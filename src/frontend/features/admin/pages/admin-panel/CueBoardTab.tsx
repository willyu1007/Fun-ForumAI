import { useMemo, useState } from 'react'
import { StatusBadge as UiStatusBadge, type StatusTone } from '@fun-forum/ui-web/patterns'
import { Badge } from '@/components/ui/badge'
import { useAdminCueBoard, useAdminCueBoardBaselineImport } from '@/api/hooks'
import { CueDetailEditor } from '@/features/admin/components/cue-editor/CueDetailEditor'
import type {
  CueBoardCueItem,
  CueBoardLoadStateEntry,
  CueBoardPayload,
  CueLane,
  CueRiskLevel,
  PublicDiscussionCueStatus,
} from '@/api/types'

// =============================================================================
// Visual helpers
// =============================================================================

function formatTriggerAt(iso: string, timezone: string): string {
  // Use Intl.DateTimeFormat with explicit timeZone so the rendered time
  // matches the schedule's canonical timezone, not the browser locale.
  // Falls back gracefully if the runtime doesn't recognise the timezone string.
  try {
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    return `${formatter.format(new Date(iso))} (${timezone})`
  } catch {
    return `${new Date(iso).toISOString()} (${timezone})`
  }
}

function laneToTone(lane: CueLane): StatusTone {
  switch (lane) {
    case 'prime':
      return 'warning'
    case 'standard':
      return 'neutral'
    case 'background':
      return 'info'
  }
}

function cueStatusToTone(status: PublicDiscussionCueStatus): StatusTone {
  switch (status) {
    case 'scheduled':
    case 'consumed':
      return 'success'
    case 'prewarming':
    case 'due':
    case 'claimed':
    case 'executing':
      return 'warning'
    case 'expired':
    case 'cancelled':
    case 'failed':
      return 'danger'
    case 'draft':
      return 'neutral'
    case 'validated':
      return 'info'
    case 'deferred':
    case 'skipped':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function riskToTone(riskLevel: CueRiskLevel): StatusTone {
  switch (riskLevel) {
    case 'low':
      return 'info'
    case 'standard':
      return 'neutral'
    case 'high':
    case 'strict_review':
      return 'danger'
  }
}

function formatScheduleRange(startIso: string, endIso: string, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    return `${formatter.format(new Date(startIso))} → ${formatter.format(new Date(endIso))}`
  } catch {
    return `${new Date(startIso).toISOString()} → ${new Date(endIso).toISOString()}`
  }
}

// =============================================================================
// Cue card
// =============================================================================

function CueCard({
  cue,
  selected,
  onSelect,
}: {
  cue: CueBoardCueItem
  selected: boolean
  onSelect: () => void
}) {
  return (
    <li
      className={
        'cursor-pointer border-l-2 py-3 pl-4 transition ' +
        (selected ? 'border-primary bg-primary/5' : 'border-border/40 hover:bg-muted/20')
      }
      onClick={onSelect}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {formatTriggerAt(cue.trigger_at, cue.timezone)}
        </span>
        <UiStatusBadge tone={laneToTone(cue.lane)}>lane:{cue.lane}</UiStatusBadge>
        <UiStatusBadge tone={cueStatusToTone(cue.status)}>{cue.status}</UiStatusBadge>
        <UiStatusBadge tone={riskToTone(cue.risk_level)}>risk:{cue.risk_level}</UiStatusBadge>
        <Badge variant="outline">priority:{cue.priority}</Badge>
        {cue.community_id ? (
          <Badge variant="outline">{cue.community_id}</Badge>
        ) : null}
        <Badge variant="outline">source:{cue.source_type}</Badge>
      </div>

      <p className="mt-2 text-sm text-foreground">
        {cue.public_topic_label ?? cue.theme_intent_summary}
      </p>
      {cue.public_hook ? (
        <p className="mt-1 text-xs text-muted-foreground">{cue.public_hook}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>roles: {cue.role_requirement_summary}</span>
        {cue.scene_family_preview.length > 0 ? (
          <span>scenes: {cue.scene_family_preview.join(' / ')}</span>
        ) : null}
        <span>media: {cue.media_count}</span>
        {cue.locked_fields_count > 0 ? (
          <span>🔒 {cue.locked_fields_count}</span>
        ) : null}
      </div>
    </li>
  )
}

// =============================================================================
// Cue detail (read-only drawer)
// =============================================================================

function CueDetailDrawer({ cue }: { cue: CueBoardCueItem }) {
  return (
    <div
      data-ui="card"
      data-variant="outlined"
      className="space-y-4 border-border/60 bg-muted/10 p-4 text-sm"
    >
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground">Identifier</h4>
        <p className="font-mono text-xs">{cue.id}</p>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground">Trigger</h4>
        <p>{formatTriggerAt(cue.trigger_at, cue.timezone)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          lane:{cue.lane} · priority:{cue.priority} · status:{cue.status}
        </p>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground">Theme intent</h4>
        <p>{cue.theme_intent_summary}</p>
        {cue.public_hook ? (
          <p className="mt-1 text-xs text-muted-foreground">hook: {cue.public_hook}</p>
        ) : null}
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground">Scene constraints</h4>
        <p className="text-xs text-muted-foreground">
          {cue.scene_family_preview.length > 0
            ? `families: ${cue.scene_family_preview.join(' / ')}`
            : '(no scene families specified)'}
        </p>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground">Role requirements</h4>
        <p className="text-xs">{cue.role_requirement_summary}</p>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground">Media</h4>
        <p className="text-xs">{cue.media_count} attached</p>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground">Governance</h4>
        <p className="text-xs">
          risk:{cue.risk_level} · locked fields: {cue.locked_fields_count}
        </p>
      </div>

      <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
        只读详情。编辑能力即将上线。
      </p>
    </div>
  )
}

// =============================================================================
// CueBoardTab
// =============================================================================

export function CueBoardTab() {
  const query = useAdminCueBoard()
  const importMutation = useAdminCueBoardBaselineImport()
  const payload = query.data?.data
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null)
  const [editingCueId, setEditingCueId] = useState<string | null>(null)

  const selectedCue = useMemo(() => {
    if (!payload || !selectedCueId) return null
    return payload.cues.find((c) => c.id === selectedCueId) ?? null
  }, [payload, selectedCueId])

  if (query.isLoading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
        正在读取 cue board…
      </div>
    )
  }

  if (query.error) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-destructive">
        <p>Cue board 加载失败：{(query.error as Error).message}</p>
        <button
          type="button"
          className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs text-destructive hover:bg-destructive/20"
          onClick={() => query.refetch()}
        >
          重试
        </button>
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
        Cue board 暂无数据。
      </div>
    )
  }

  if (editingCueId) {
    return (
      <CueDetailEditor cueId={editingCueId} onClose={() => setEditingCueId(null)} />
    )
  }

  return (
    <CueBoardContent
      payload={payload}
      selectedCueId={selectedCueId}
      onSelectCue={setSelectedCueId}
      selectedCue={selectedCue}
      onEditCue={setEditingCueId}
      onImportBaseline={() => importMutation.mutate()}
      importInFlight={importMutation.isPending}
      importError={importMutation.error as Error | null}
    />
  )
}

function CueBoardContent({
  payload,
  selectedCueId,
  onSelectCue,
  selectedCue,
  onEditCue,
  onImportBaseline,
  importInFlight,
  importError,
}: {
  payload: CueBoardPayload
  selectedCueId: string | null
  onSelectCue: (id: string | null) => void
  selectedCue: CueBoardCueItem | null
  onEditCue: (id: string) => void
  onImportBaseline: () => void
  importInFlight: boolean
  importError: Error | null
}) {
  if (!payload.schedule) {
    return (
      <div className="space-y-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
        <p>
          当前还没有发布的 cue schedule。可以先从 baseline 配置导入一个草稿
          schedule，编辑器准备好后再切换到人工创建。
        </p>
        <button
          type="button"
          className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
          onClick={onImportBaseline}
          disabled={importInFlight}
        >
          {importInFlight ? '导入中…' : '从 baseline 配置导入草稿'}
        </button>
        {importError ? (
          <p className="text-xs text-destructive">
            导入失败：{importError.message}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div data-ui="stack" data-direction="col" data-gap="5">
      <ScheduleHeader
        payload={payload}
        onImportBaseline={onImportBaseline}
        importInFlight={importInFlight}
        importError={importError}
      />
      <LoadHeatmapPanel entries={payload.load_state_per_community} />
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,360px)]">
        <ul data-ui="list" data-variant="admin-rows" className="space-y-1">
          {payload.cues.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted-foreground">
              当前 schedule 还没有 cue。
            </li>
          ) : (
            payload.cues.map((cue) => (
              <CueCard
                key={cue.id}
                cue={cue}
                selected={selectedCueId === cue.id}
                onSelect={() =>
                  onSelectCue(selectedCueId === cue.id ? null : cue.id)
                }
              />
            ))
          )}
        </ul>
        <aside className="space-y-3">
          {selectedCue ? (
            <>
              <CueDetailDrawer cue={selectedCue} />
              <button
                type="button"
                className="w-full rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary hover:bg-primary/20"
                onClick={() => onEditCue(selectedCue.id)}
              >
                打开编辑器
              </button>
            </>
          ) : (
            <div
              data-ui="card"
              data-variant="outlined"
              className="border-dashed border-border/60 p-4 text-xs text-muted-foreground"
            >
              点击左侧 cue 查看详情，再点"打开编辑器"进入编辑界面。
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function ScheduleHeader({
  payload,
  onImportBaseline,
  importInFlight,
  importError,
}: {
  payload: CueBoardPayload
  onImportBaseline: () => void
  importInFlight: boolean
  importError: Error | null
}) {
  const s = payload.schedule!
  return (
    <div data-ui="card" data-variant="outlined" className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            Schedule {s.id}
          </h3>
          <Badge variant="outline">status:{s.status}</Badge>
          <Badge variant="outline">source:{s.source}</Badge>
          <Badge variant="outline">v{s.version}</Badge>
          {s.scope_type !== 'global' ? (
            <Badge variant="outline">scope:{s.scope_type}</Badge>
          ) : null}
          {s.baseline_contract_version ? (
            <Badge variant="outline">baseline:{s.baseline_contract_version}</Badge>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-md border border-border bg-muted/30 px-3 py-1 text-xs hover:bg-muted/50 disabled:opacity-50"
          onClick={onImportBaseline}
          disabled={importInFlight}
          title="重新从 launch_programming_schedule.v1.yaml 导入；若 baseline 版本已存在则只会复用既有 schedule。"
        >
          {importInFlight ? '导入中…' : '同步 baseline'}
        </button>
      </div>
      {s.summary ? (
        <p className="mt-2 text-xs text-muted-foreground">{s.summary}</p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        {formatScheduleRange(s.date_range_start, s.date_range_end, s.timezone)} ·
        cues: {payload.cues.length} · generated:{' '}
        {new Intl.DateTimeFormat('zh-CN', {
          timeZone: s.timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date(payload.generated_at))}
      </p>
      {importError ? (
        <p className="mt-2 text-xs text-destructive">
          baseline 同步失败：{importError.message}
        </p>
      ) : null}
    </div>
  )
}

// =============================================================================
// T-213 M4 — load heatmap panel
// =============================================================================

const LOAD_STATE_LABEL: Record<'green' | 'yellow' | 'red', string> = {
  green: '空闲',
  yellow: '吃紧',
  red: '过载',
}

function LoadStateBadge({ entry }: { entry: CueBoardLoadStateEntry }) {
  switch (entry.load_state) {
    case 'green':
      return (
        <UiStatusBadge tone="success">
          {LOAD_STATE_LABEL[entry.load_state]} · {entry.load_state}
        </UiStatusBadge>
      )
    case 'yellow':
      return (
        <UiStatusBadge tone="warning">
          {LOAD_STATE_LABEL[entry.load_state]} · {entry.load_state}
        </UiStatusBadge>
      )
    case 'red':
      return (
        <UiStatusBadge tone="danger">
          {LOAD_STATE_LABEL[entry.load_state]} · {entry.load_state}
        </UiStatusBadge>
      )
  }
}

function LoadHeatmapPanel({
  entries,
}: {
  entries: CueBoardLoadStateEntry[] | null
}) {
  // Backend without `LoadSignalService` returns null → no panel (legacy mode).
  if (entries === null) return null
  if (entries.length === 0) {
    return (
      <div
        data-ui="card"
        data-variant="outlined"
        className="p-4 text-xs text-muted-foreground"
      >
        当前 schedule 无 community 范围；负载热度图暂无数据。
      </div>
    )
  }

  return (
    <div data-ui="card" data-variant="outlined" className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">负载热度图</h3>
        <p className="text-[10px] text-muted-foreground">
          来自缓存 ~30 秒；admission 路径独立读取实时 snapshot
        </p>
      </div>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.community_id}
            className="flex flex-wrap items-center gap-3 border-l-2 border-border/40 pl-3 py-1"
          >
            <LoadStateBadge entry={entry} />
            <span className="text-xs font-medium text-foreground">
              {entry.community_id}
            </span>
            <span className="text-xs text-muted-foreground">
              30 分钟内 cue: {entry.scheduled_cue_count_30m}
            </span>
            <span className="text-xs text-muted-foreground">
              · 自主预测: {entry.predicted_autonomous_count_30m}
            </span>
            <span className="text-[10px] text-muted-foreground">
              · @ {new Intl.DateTimeFormat('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              }).format(new Date(entry.computed_at))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
