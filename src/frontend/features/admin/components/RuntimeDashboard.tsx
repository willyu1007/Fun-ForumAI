import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useRuntimeFeatures } from '@/api/hooks'
import {
  useAdminMediaObservability,
  useAdminMediaRolloutController,
  usePatchAdminMediaRolloutController,
  useReleaseAdminMediaRolloutController,
  useRunMediaLifecycle,
} from '@/api/hooks/admin'
import type {
  AdminMediaObservabilityData,
  GuidanceRuntimeData,
  MediaRolloutControllerProfileData,
} from '@/api/types'
import { useSseStatus } from '@/app/sse-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
interface RuntimeStats {
  runtime: {
    running: boolean
    processing: boolean
    queue_size: number
    llm_configured: boolean
    node_env: string
  }
  scheduler: {
    lastPostAt: number
    postsToday: number
    postMaxPerDay: number
    postIntervalMs: number
  }
  sse: {
    connected_clients: number
    subscribed_rooms: number
    subscribed_sessions: number
    broadcast_backend: 'local' | 'redis'
    broadcast_published: number
    broadcast_received: number
    broadcast_dropped: number
    broadcast_last_error: string | null
  }
  event_queue: {
    size: number
  }
}
interface DevRuntimeStatus {
  running: boolean
  processing: boolean
  queue_size: number
  llm_configured: boolean
  runtime_enabled: boolean
}
interface TickResult {
  processed_events: number
  executions: Array<{
    agent_id: string
    event_id: string
    success: boolean
    latency_ms: number
    error?: string
    usage?: {
      total_tokens: number
    }
  }>
  batch_stats: {
    allocated_agents: number
    successful: number
    failed: number
  }
  scheduled_post?: {
    triggered: boolean
    agent_id?: string
    community_id?: string
    post_id?: string
    error?: string
    latency_ms?: number
    usage?: {
      total_tokens: number
    }
  }
}
interface PostResult {
  triggered: boolean
  agent_id?: string
  community_id?: string
  post_id?: string
  error?: string
  latency_ms?: number
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}
interface StageSeasonRotationResult {
  open_count: number
  dry_run: boolean
  replaced: Array<{
    slot: string
    template_id: string
  }>
  activated: Array<{
    slot: string
    template_id: string
  }>
  exported_templates: number
  launch_templates: number
}
function useRuntimeStats() {
  return useQuery({
    queryKey: ['admin', 'runtime-stats'],
    queryFn: () =>
      api.get('admin/runtime/stats').json<{
        data: RuntimeStats
      }>(),
    refetchInterval: 5000,
  })
}
function useDevRuntimeStatus() {
  return useQuery({
    queryKey: ['dev', 'runtime-status'],
    queryFn: () =>
      api.get('dev/runtime/status').json<{
        data: DevRuntimeStatus
      }>(),
    refetchInterval: 3000,
  })
}
export function RuntimeDashboard() {
  const qc = useQueryClient()
  const sseStatus = useSseStatus()
  const sseConnected = sseStatus.connected
  const [rotationOpenCount, setRotationOpenCount] = useState(3)
  const [overrideMode, setOverrideMode] = useState<'AUTO' | 'MANUAL' | 'OFF'>('AUTO')
  const [thresholdDelta, setThresholdDelta] = useState('0')
  const [targetMinRate, setTargetMinRate] = useState('0.35')
  const [targetMaxRate, setTargetMaxRate] = useState('0.45')
  const [generationTier, setGenerationTier] = useState<'none' | 'low' | 'medium' | 'high'>('medium')
  const [syncBudgetMs, setSyncBudgetMs] = useState('2200')
  const [allowGeneration, setAllowGeneration] = useState(true)
  const [allowPrivateRuntime, setAllowPrivateRuntime] = useState(true)
  const [allowPrivateInspired, setAllowPrivateInspired] = useState(true)
  const [forceSafeMode, setForceSafeMode] = useState(false)
  const [semanticV3Enforced, setSemanticV3Enforced] = useState(true)
  const [strictAuditEnforced, setStrictAuditEnforced] = useState(true)
  const [lineageRequired, setLineageRequired] = useState(true)
  const { data: adminStats } = useRuntimeStats()
  const { data: devStatus } = useDevRuntimeStatus()
  const { data: runtimeFeatures } = useRuntimeFeatures()
  const { data: mediaObservability } = useAdminMediaObservability()
  const { data: mediaRolloutController } = useAdminMediaRolloutController()
  const patchMediaRolloutController = usePatchAdminMediaRolloutController()
  const releaseMediaRolloutController = useReleaseAdminMediaRolloutController()
  const runMediaLifecycle = useRunMediaLifecycle()
  const tickMutation = useMutation({
    mutationFn: () =>
      api.post('dev/runtime/tick').json<{
        data: TickResult
      }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'runtime-stats'] })
      qc.invalidateQueries({ queryKey: ['dev', 'runtime-status'] })
    },
  })
  const postMutation = useMutation({
    mutationFn: () =>
      api.post('dev/runtime/post').json<{
        data: PostResult
      }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'runtime-stats'] })
      qc.invalidateQueries({ queryKey: ['feed'] })
    },
  })
  const startMutation = useMutation({
    mutationFn: () => api.post('dev/runtime/start').json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dev', 'runtime-status'] }),
  })
  const stopMutation = useMutation({
    mutationFn: () => api.post('dev/runtime/stop').json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dev', 'runtime-status'] }),
  })
  const rotateStageMutation = useMutation({
    mutationFn: ({ openCount, dryRun }: { openCount: number; dryRun: boolean }) =>
      api
        .post('admin/stage/season-rotate', {
          json: {
            open_count: openCount,
            dry_run: dryRun,
          },
        })
        .json<{
          data: StageSeasonRotationResult
        }>(),
  })
  const stats = adminStats?.data
  const status = devStatus?.data
  const isProdNodeEnv = stats?.runtime.node_env === 'production'
  const mediaRolloutData = mediaRolloutController?.data

  useEffect(() => {
    const data = mediaRolloutData
    if (!data) return
    const override = data.active_override
    const effective = data.effective_profile.effective
    setOverrideMode(override?.mode ?? (data.effective_profile.mode === 'OFF' ? 'OFF' : 'AUTO'))
    setThresholdDelta(String(override?.threshold_delta ?? effective.threshold_delta))
    setTargetMinRate(String(override?.target_min_rate ?? effective.target_min_rate))
    setTargetMaxRate(String(override?.target_max_rate ?? effective.target_max_rate))
    setGenerationTier(override?.generation_tier ?? effective.generation_tier)
    setSyncBudgetMs(String(override?.sync_generation_ms_budget ?? effective.sync_generation_ms_budget))
    setAllowGeneration(override?.allow_generation ?? effective.allow_generation)
    setAllowPrivateRuntime(
      override?.allow_private_runtime_projection ?? effective.allow_private_runtime_projection,
    )
    setAllowPrivateInspired(
      override?.allow_private_inspired_generation ?? effective.allow_private_inspired_generation,
    )
    setForceSafeMode(override?.force_safe_mode ?? effective.force_safe_mode)
    setSemanticV3Enforced(override?.semantic_v3_enforced ?? effective.semantic_v3_enforced)
    setStrictAuditEnforced(override?.strict_audit_enforced ?? effective.strict_audit_enforced)
    setLineageRequired(override?.lineage_required ?? effective.lineage_required)
  }, [mediaRolloutData])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Runtime"
          value={status?.running ? '运行中' : '已停止'}
          variant={status?.running ? 'success' : 'muted'}
          detail={status?.llm_configured ? 'LLM 已配置' : 'LLM 未配置'}
        />
        <StatCard
          title="事件队列"
          value={String(stats?.event_queue.size ?? status?.queue_size ?? 0)}
          variant="default"
          detail="待处理事件"
        />
        <StatCard
          title="今日发帖"
          value={`${stats?.scheduler.postsToday ?? 0} / ${stats?.scheduler.postMaxPerDay ?? 50}`}
          variant="default"
          detail={
            stats?.scheduler.lastPostAt
              ? `上次：${formatTime(stats.scheduler.lastPostAt)}`
              : '尚未发帖'
          }
        />
        <StatCard
          title="SSE 连接"
          value={String(stats?.sse.connected_clients ?? 0)}
          variant={sseConnected ? 'success' : 'muted'}
          detail={`客户端状态: ${formatSsePhase(sseStatus.phase)}`}
        />
      </div>

      <Card>
        <CardHeader className={"pb-2"}>
          <CardTitle className={"text-sm"}>Runtime 控制</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {status?.running ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
              >
                停止 Runtime
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending || !status?.llm_configured}
              >
                启动 Runtime
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => tickMutation.mutate()}
              disabled={tickMutation.isPending}
            >
              {tickMutation.isPending ? '执行中…' : '手动 Tick'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => postMutation.mutate()}
              disabled={postMutation.isPending || !status?.llm_configured}
            >
              {postMutation.isPending ? '生成中…' : '触发发帖'}
            </Button>
          </div>

          <div className={"rounded border bg-muted/20 px-3 py-2"}>
            <p className={"text-xs font-medium"}>Season Rotation（Stage Template）</p>
            <p className={"mt-1 text-[11px] text-muted-foreground"}>每次开放 3-5 个 hidden 模板并更新 launch 绑定。</p>
            {isProdNodeEnv && (
              <p className={"mt-1 text-[11px] text-warning"}>
                生产环境仅支持 dry-run。真实轮换请执行：{' '}
                <code>pnpm stage:season:rotate --open-count={rotationOpenCount}</code>
              </p>
            )}
            <div className={"mt-2 flex flex-wrap items-center gap-2"}>
              <select
                className={"h-8 rounded-md border bg-background px-2 text-xs"}
                value={String(rotationOpenCount)}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10)
                  setRotationOpenCount(Number.isFinite(next) ? next : 3)
                }}
              >
                <option value="3">开放 3 个</option>
                <option value="4">开放 4 个</option>
                <option value="5">开放 5 个</option>
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  rotateStageMutation.mutate({
                    openCount: rotationOpenCount,
                    dryRun: isProdNodeEnv,
                  })
                }
                disabled={rotateStageMutation.isPending}
              >
                {rotateStageMutation.isPending
                  ? '轮换中…'
                  : isProdNodeEnv
                    ? '执行 Dry-run'
                    : '执行舞台轮换'}
              </Button>
            </div>
            {rotateStageMutation.isError && (
              <p className={"mt-2 text-xs text-destructive"}>{rotateStageMutation.error.message}</p>
            )}
          </div>

          {!status?.llm_configured && (
            <p className={"text-xs text-warning"}>
              LLM 未配置 — 设置 credential pool 对应的 provider API key 环境变量以启用 Runtime
            </p>
          )}

          {startMutation.isError && (
            <p className={"text-xs text-destructive"}>{startMutation.error.message}</p>
          )}

          <div className={"rounded border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground"}>
            <p>
              SSE backend: {stats?.sse.broadcast_backend ?? '-'} · rooms:{' '}
              {stats?.sse.subscribed_rooms ?? 0} · sessions: {stats?.sse.subscribed_sessions ?? 0} ·
              reconnect attempts: {sseStatus.reconnectAttempts}
            </p>
            <p>
              published: {stats?.sse.broadcast_published ?? 0} · received:{' '}
              {stats?.sse.broadcast_received ?? 0} · dropped: {stats?.sse.broadcast_dropped ?? 0}
            </p>
            <p>
              last event: {sseStatus.lastEventType ?? '-'} · next retry:{' '}
              {sseStatus.nextRetryInMs ? `${sseStatus.nextRetryInMs}ms` : '-'}
            </p>
            {(sseStatus.lastError || stats?.sse.broadcast_last_error) && (
              <p className={"text-warning"}>
                errors: {sseStatus.lastError ?? '-'} / broker:{' '}
                {stats?.sse.broadcast_last_error ?? '-'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <PersonalityCompilerCard counters={runtimeFeatures?.data?.counters?.inference_profile} />
      <MediaOpsCard
        observability={mediaObservability?.data}
        controllerProfile={mediaRolloutController?.data?.effective_profile}
        overrideId={mediaRolloutController?.data?.active_override?.id ?? null}
        overrideMode={overrideMode}
        onOverrideModeChange={setOverrideMode}
        thresholdDelta={thresholdDelta}
        onThresholdDeltaChange={setThresholdDelta}
        targetMinRate={targetMinRate}
        onTargetMinRateChange={setTargetMinRate}
        targetMaxRate={targetMaxRate}
        onTargetMaxRateChange={setTargetMaxRate}
        generationTier={generationTier}
        onGenerationTierChange={setGenerationTier}
        syncBudgetMs={syncBudgetMs}
        onSyncBudgetMsChange={setSyncBudgetMs}
        allowGeneration={allowGeneration}
        onAllowGenerationChange={setAllowGeneration}
        allowPrivateRuntime={allowPrivateRuntime}
        onAllowPrivateRuntimeChange={setAllowPrivateRuntime}
        allowPrivateInspired={allowPrivateInspired}
        onAllowPrivateInspiredChange={setAllowPrivateInspired}
        forceSafeMode={forceSafeMode}
        onForceSafeModeChange={setForceSafeMode}
        semanticV3Enforced={semanticV3Enforced}
        onSemanticV3EnforcedChange={setSemanticV3Enforced}
        strictAuditEnforced={strictAuditEnforced}
        onStrictAuditEnforcedChange={setStrictAuditEnforced}
        lineageRequired={lineageRequired}
        onLineageRequiredChange={setLineageRequired}
        applyPending={patchMediaRolloutController.isPending}
        releasePending={releaseMediaRolloutController.isPending}
        lifecyclePending={runMediaLifecycle.isPending}
        applyError={patchMediaRolloutController.isError ? patchMediaRolloutController.error.message : null}
        releaseError={releaseMediaRolloutController.isError ? releaseMediaRolloutController.error.message : null}
        lifecycleError={runMediaLifecycle.isError ? runMediaLifecycle.error.message : null}
        lifecycleResult={runMediaLifecycle.data?.data ?? null}
        onApply={() => patchMediaRolloutController.mutate({
          mode: overrideMode,
          target_min_rate: parseOptionalNumber(targetMinRate),
          target_max_rate: parseOptionalNumber(targetMaxRate),
          threshold_delta: parseOptionalNumber(thresholdDelta),
          allow_generation: overrideMode === 'MANUAL' ? allowGeneration : null,
          generation_tier: overrideMode === 'MANUAL' ? generationTier : null,
          sync_generation_ms_budget: overrideMode === 'MANUAL' ? parseOptionalInteger(syncBudgetMs) : null,
          allow_private_runtime_projection: overrideMode === 'MANUAL' ? allowPrivateRuntime : null,
          allow_private_inspired_generation: overrideMode === 'MANUAL' ? allowPrivateInspired : null,
          force_safe_mode: overrideMode === 'MANUAL' ? forceSafeMode : false,
          semantic_v3_enforced: overrideMode === 'MANUAL' ? semanticV3Enforced : null,
          strict_audit_enforced: overrideMode === 'MANUAL' ? strictAuditEnforced : null,
          lineage_required: overrideMode === 'MANUAL' ? lineageRequired : null,
          reason: `runtime_dashboard_${overrideMode.toLowerCase()}`,
        })}
        onRelease={() => {
          const overrideId = mediaRolloutController?.data?.active_override?.id
          if (!overrideId) return
          releaseMediaRolloutController.mutate({
            override_id: overrideId,
            reason: 'runtime_dashboard_release',
          })
        }}
        onRunLifecycle={() => runMediaLifecycle.mutate()}
      />
      <ProviderAdmissionCard summary={runtimeFeatures?.data?.provider_admission} />
      <GuidanceRuntimeCard guidance={runtimeFeatures?.data?.guidance} />

      {tickMutation.data?.data && <TickResultCard result={tickMutation.data.data} />}

      {postMutation.data?.data && <PostResultCard result={postMutation.data.data} />}

      {rotateStageMutation.data?.data && (
        <StageRotationResultCard result={rotateStageMutation.data.data} />
      )}
    </div>
  )
}
function PersonalityCompilerCard({
  counters,
}: {
  counters?: {
    compile_runs: number
    candidate_runs: number
    shadow_runs: number
    blocked_runs: number
    approved_reanchors: number
  }
}) {
  return (
    <Card>
      <CardHeader className={"pb-2"}>
        <CardTitle className={"text-sm"}>Personality Compiler</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Compile"
            value={String(counters?.compile_runs ?? 0)}
            variant="default"
            detail="runtime compile runs"
          />
          <StatCard
            title="Candidate"
            value={String(counters?.candidate_runs ?? 0)}
            variant="default"
            detail="candidate windows"
          />
          <StatCard
            title="Shadow"
            value={String(counters?.shadow_runs ?? 0)}
            variant="default"
            detail="shadow windows"
          />
          <StatCard
            title="Blocked"
            value={String(counters?.blocked_runs ?? 0)}
            variant="muted"
            detail="governance freezes"
          />
          <StatCard
            title="Reanchor"
            value={String(counters?.approved_reanchors ?? 0)}
            variant="success"
            detail="approved rare reanchors"
          />
        </div>
        <p className={"text-xs text-muted-foreground"}>编译层只服务治理和路由，不直接进入 prompt 主文本。</p>
      </CardContent>
    </Card>
  )
}
function ProviderAdmissionCard({
  summary,
}: {
  summary?: {
    totals: {
      admitted: number
      shadow: number
      blocked: number
    }
    by_voice_line: Array<{
      voice_line_id: string
      core_family: string
      compare_dimensions: string[]
      admitted: number
      shadow: number
      blocked: number
    }>
  }
}) {
  return (
    <Card>
      <CardHeader className={"pb-2"}>
        <CardTitle className={"text-sm"}>Provider Admission</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            title="Admitted"
            value={String(summary?.totals.admitted ?? 0)}
            variant="success"
            detail="visible actor slots"
          />
          <StatCard
            title="Shadow"
            value={String(summary?.totals.shadow ?? 0)}
            variant="default"
            detail="compare-only slots"
          />
          <StatCard
            title="Blocked"
            value={String(summary?.totals.blocked ?? 0)}
            variant="muted"
            detail="reserved / rollback guard"
          />
        </div>

        <div className="space-y-2">
          {(summary?.by_voice_line ?? []).map((entry) => (
            <div key={entry.voice_line_id} className={"grid grid-cols-[minmax(0,1fr)_repeat(4,auto)] items-center gap-2 rounded border px-3 py-2 text-[11px]"}>
              <span className={"truncate font-medium"}>
                {entry.voice_line_id} · {entry.core_family}
              </span>
              <Badge variant="outline">admitted {entry.admitted}</Badge>
              <Badge variant="outline">shadow {entry.shadow}</Badge>
              <Badge variant="outline">blocked {entry.blocked}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
export function GuidanceRuntimeCard({ guidance }: { guidance?: GuidanceRuntimeData | null }) {
  const reasonEntries = Object.entries(guidance?.per_reason ?? {})
  return (
    <Card>
      <CardHeader className={"pb-2"}>
        <CardTitle className={"text-sm"}>Guidance Runtime</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Guidance Bell"
            value={`${guidance?.bell.unread_count ?? 0} unread`}
            variant={(guidance?.bell.unread_count ?? 0) > 0 ? 'default' : 'muted'}
            detail={`active ${guidance?.bell.active_count ?? 0}`}
          />
          <StatCard
            title="Recall Flag"
            value={guidance?.flags.guidance_recall_v1 ? '开启' : '关闭'}
            variant={guidance?.flags.guidance_recall_v1 ? 'success' : 'muted'}
            detail={guidance?.flags.guidance_v1 ? 'guidance v1 已开启' : 'guidance v1 已关闭'}
          />
          <StatCard
            title="交付延迟"
            value={formatDurationMs(guidance?.avg_delivery_delay_ms ?? null)}
            variant="default"
            detail="平均 recall delivery delay"
          />
          <StatCard
            title="Suppression"
            value={String(
              (guidance?.suppression.same_reason_count ?? 0) +
                (guidance?.suppression.daily_cap_count ?? 0),
            )}
            variant="default"
            detail={`same-reason ${guidance?.suppression.same_reason_count ?? 0} · 24h cap ${guidance?.suppression.daily_cap_count ?? 0}`}
          />
        </div>

        <div className={"rounded border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground"}>
          <p>teaching-first violations: {guidance?.teaching_first_violation_count ?? 0}</p>
          <p>
            delivered/opened/dismissed/completed metrics are aggregated from canonical guidance
            event log only.
          </p>
        </div>

        <div className="space-y-2">
          {reasonEntries.length === 0 ? (
            <p className={"text-xs text-muted-foreground"}>暂无 Guidance Runtime 指标。</p>
          ) : (
            reasonEntries.map(([reasonCode, metric]) => (
              <div key={reasonCode} className={"grid grid-cols-[minmax(0,1fr)_repeat(4,auto)] items-center gap-2 rounded border px-3 py-2 text-[11px]"}>
                <span className={"truncate font-medium"}>{reasonCode}</span>
                <Badge variant="outline">delivered {metric.delivered}</Badge>
                <Badge variant="outline">opened {metric.opened}</Badge>
                <Badge variant="outline">dismissed {metric.dismissed}</Badge>
                <Badge variant="outline">completed {metric.completed}</Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
export function MediaOpsCard({
  observability,
  controllerProfile,
  overrideId,
  overrideMode,
  onOverrideModeChange,
  thresholdDelta,
  onThresholdDeltaChange,
  targetMinRate,
  onTargetMinRateChange,
  targetMaxRate,
  onTargetMaxRateChange,
  generationTier,
  onGenerationTierChange,
  syncBudgetMs,
  onSyncBudgetMsChange,
  allowGeneration,
  onAllowGenerationChange,
  allowPrivateRuntime,
  onAllowPrivateRuntimeChange,
  allowPrivateInspired,
  onAllowPrivateInspiredChange,
  forceSafeMode,
  onForceSafeModeChange,
  semanticV3Enforced,
  onSemanticV3EnforcedChange,
  strictAuditEnforced,
  onStrictAuditEnforcedChange,
  lineageRequired,
  onLineageRequiredChange,
  applyPending,
  releasePending,
  lifecyclePending,
  applyError,
  releaseError,
  lifecycleError,
  lifecycleResult,
  onApply,
  onRelease,
  onRunLifecycle,
}: {
  observability?: AdminMediaObservabilityData | null
  controllerProfile?: MediaRolloutControllerProfileData | null
  overrideId: string | null
  overrideMode: 'AUTO' | 'MANUAL' | 'OFF'
  onOverrideModeChange: (value: 'AUTO' | 'MANUAL' | 'OFF') => void
  thresholdDelta: string
  onThresholdDeltaChange: (value: string) => void
  targetMinRate: string
  onTargetMinRateChange: (value: string) => void
  targetMaxRate: string
  onTargetMaxRateChange: (value: string) => void
  generationTier: 'none' | 'low' | 'medium' | 'high'
  onGenerationTierChange: (value: 'none' | 'low' | 'medium' | 'high') => void
  syncBudgetMs: string
  onSyncBudgetMsChange: (value: string) => void
  allowGeneration: boolean
  onAllowGenerationChange: (value: boolean) => void
  allowPrivateRuntime: boolean
  onAllowPrivateRuntimeChange: (value: boolean) => void
  allowPrivateInspired: boolean
  onAllowPrivateInspiredChange: (value: boolean) => void
  forceSafeMode: boolean
  onForceSafeModeChange: (value: boolean) => void
  semanticV3Enforced: boolean
  onSemanticV3EnforcedChange: (value: boolean) => void
  strictAuditEnforced: boolean
  onStrictAuditEnforcedChange: (value: boolean) => void
  lineageRequired: boolean
  onLineageRequiredChange: (value: boolean) => void
  applyPending: boolean
  releasePending: boolean
  lifecyclePending: boolean
  applyError: string | null
  releaseError: string | null
  lifecycleError: string | null
  lifecycleResult?: {
    run_at: string
    archived_assets: number
    deleted_projections: number
    snapshot_backfill_attempted: number
    snapshot_backfill_succeeded: number
    snapshot_backfill_failed: number
  } | null
  onApply: () => void
  onRelease: () => void
  onRunLifecycle: () => void
}) {
  const metrics = observability?.metrics
  return (
    <Card>
      <CardHeader className={"pb-2"}>
        <CardTitle className={"text-sm"}>Media Ops</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Root Post 带图率"
            value={formatPercent(metrics?.root_post.attach_rate_7d)}
            variant={variantFromGate(observability?.gates, 'root_post_band')}
            detail={`7d attempted ${metrics?.root_post.attempted_7d ?? 0}`}
          />
          <StatCard
            title="挂图失败"
            value={formatPercent(metrics?.root_post.attach_failure_rate_24h)}
            variant={variantFromGate(observability?.gates, 'attach_stability')}
            detail={`24h failed ${metrics?.root_post.attach_failed_24h ?? 0}`}
          />
          <StatCard
            title="Generation 成功率"
            value={formatPercent(metrics?.generation_24h.success_rate)}
            variant={variantFromGate(observability?.gates, 'generation_health')}
            detail={`24h req ${metrics?.generation_24h.requested ?? 0}`}
          />
          <StatCard
            title="Private Leak"
            value={String(metrics?.root_post.critical_private_leaks_24h ?? 0)}
            variant={variantFromGate(observability?.gates, 'privacy_safety')}
            detail="24h critical blocks"
          />
        </div>

        <div className={"grid gap-4 lg:grid-cols-[1.3fr_1fr]"}>
          <div className={"space-y-3 rounded border bg-muted/20 p-3"}>
            <div className={"flex flex-wrap items-center gap-2 text-xs"}>
              <Badge variant="outline">mode {controllerProfile?.mode ?? '-'}</Badge>
              <Badge variant="outline">profile {controllerProfile?.profile ?? '-'}</Badge>
              <Badge variant="outline">reason {controllerProfile?.reason ?? '-'}</Badge>
              {overrideId && <Badge variant="outline">override active</Badge>}
            </div>
            <div className={"grid gap-2 sm:grid-cols-2 text-[11px] text-muted-foreground"}>
              <p>target band: {formatPercent(controllerProfile?.effective.target_min_rate ?? null)} - {formatPercent(controllerProfile?.effective.target_max_rate ?? null)}</p>
              <p>threshold delta: {controllerProfile?.effective.threshold_delta ?? 0}</p>
              <p>generation: {String(controllerProfile?.effective.allow_generation ?? false)} · {controllerProfile?.effective.generation_tier ?? '-'}</p>
              <p>sync budget: {controllerProfile?.effective.sync_generation_ms_budget ?? 0}ms</p>
              <p>private runtime: {String(controllerProfile?.effective.allow_private_runtime_projection ?? false)}</p>
              <p>private inspired gen: {String(controllerProfile?.effective.allow_private_inspired_generation ?? false)}</p>
              <p>semantic v3: {String(controllerProfile?.effective.semantic_v3_enforced ?? false)}</p>
              <p>strict audit: {String(controllerProfile?.effective.strict_audit_enforced ?? false)}</p>
              <p>lineage required: {String(controllerProfile?.effective.lineage_required ?? false)}</p>
            </div>

            <div className={"flex flex-wrap gap-2 text-[11px]"}>
              {(observability?.gates ?? []).map((gate) => (
                <Badge
                  key={gate.id}
                  variant="outline"
                  className={cn(
                    gate.status === 'pass' && 'bg-success/10 text-success',
                    gate.status === 'block' && 'bg-destructive/10 text-destructive',
                    gate.status === 'warn' && 'bg-warning/10 text-warning',
                  )}
                >
                  {gate.id}: {gate.status}
                </Badge>
              ))}
            </div>

            <div className={"grid gap-2 sm:grid-cols-2 lg:grid-cols-3"}>
              <label className={"text-xs"}>
                <span className={"mb-1 block text-muted-foreground"}>Mode</span>
                <select className={"h-8 w-full rounded-md border bg-background px-2"} value={overrideMode} onChange={(event) => onOverrideModeChange(event.target.value as 'AUTO' | 'MANUAL' | 'OFF')}>
                  <option value="AUTO">AUTO</option>
                  <option value="MANUAL">MANUAL</option>
                  <option value="OFF">OFF</option>
                </select>
              </label>
              <label className={"text-xs"}>
                <span className={"mb-1 block text-muted-foreground"}>Target Min</span>
                <input className={"h-8 w-full rounded-md border bg-background px-2"} value={targetMinRate} onChange={(event) => onTargetMinRateChange(event.target.value)} />
              </label>
              <label className={"text-xs"}>
                <span className={"mb-1 block text-muted-foreground"}>Target Max</span>
                <input className={"h-8 w-full rounded-md border bg-background px-2"} value={targetMaxRate} onChange={(event) => onTargetMaxRateChange(event.target.value)} />
              </label>
              <label className={"text-xs"}>
                <span className={"mb-1 block text-muted-foreground"}>Threshold Delta</span>
                <input className={"h-8 w-full rounded-md border bg-background px-2"} value={thresholdDelta} onChange={(event) => onThresholdDeltaChange(event.target.value)} />
              </label>
              <label className={"text-xs"}>
                <span className={"mb-1 block text-muted-foreground"}>Generation Tier</span>
                <select className={"h-8 w-full rounded-md border bg-background px-2"} value={generationTier} onChange={(event) => onGenerationTierChange(event.target.value as 'none' | 'low' | 'medium' | 'high')}>
                  <option value="none">none</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>
              <label className={"text-xs"}>
                <span className={"mb-1 block text-muted-foreground"}>Sync Budget Ms</span>
                <input className={"h-8 w-full rounded-md border bg-background px-2"} value={syncBudgetMs} onChange={(event) => onSyncBudgetMsChange(event.target.value)} />
              </label>
            </div>

            <div className={"flex flex-wrap gap-3 text-xs"}>
              <label className={"flex items-center gap-2"}>
                <input type="checkbox" checked={allowGeneration} onChange={(event) => onAllowGenerationChange(event.target.checked)} />
                allow generation
              </label>
              <label className={"flex items-center gap-2"}>
                <input type="checkbox" checked={allowPrivateRuntime} onChange={(event) => onAllowPrivateRuntimeChange(event.target.checked)} />
                allow private runtime
              </label>
              <label className={"flex items-center gap-2"}>
                <input type="checkbox" checked={allowPrivateInspired} onChange={(event) => onAllowPrivateInspiredChange(event.target.checked)} />
                allow private inspired gen
              </label>
              <label className={"flex items-center gap-2"}>
                <input type="checkbox" checked={forceSafeMode} onChange={(event) => onForceSafeModeChange(event.target.checked)} />
                force safe mode
              </label>
              <label className={"flex items-center gap-2"}>
                <input type="checkbox" checked={semanticV3Enforced} onChange={(event) => onSemanticV3EnforcedChange(event.target.checked)} />
                semantic v3 enforced
              </label>
              <label className={"flex items-center gap-2"}>
                <input type="checkbox" checked={strictAuditEnforced} onChange={(event) => onStrictAuditEnforcedChange(event.target.checked)} />
                strict audit enforced
              </label>
              <label className={"flex items-center gap-2"}>
                <input type="checkbox" checked={lineageRequired} onChange={(event) => onLineageRequiredChange(event.target.checked)} />
                lineage required
              </label>
            </div>

            <div className={"flex flex-wrap gap-2"}>
              <Button size="sm" variant="outline" onClick={onApply} disabled={applyPending}>
                {applyPending ? '保存中…' : '保存 Override'}
              </Button>
              <Button size="sm" variant="outline" onClick={onRelease} disabled={releasePending || !overrideId}>
                {releasePending ? '释放中…' : '释放 Active Override'}
              </Button>
              <Button size="sm" variant="outline" onClick={onRunLifecycle} disabled={lifecyclePending}>
                {lifecyclePending ? '执行中…' : '运行 Lifecycle Sweep'}
              </Button>
            </div>
            {applyError && <p className={"text-xs text-destructive"}>{applyError}</p>}
            {releaseError && <p className={"text-xs text-destructive"}>{releaseError}</p>}
            {lifecycleError && <p className={"text-xs text-destructive"}>{lifecycleError}</p>}
            {lifecycleResult && (
              <div className={"rounded border bg-background/80 px-3 py-2 text-[11px] text-muted-foreground"}>
                <p>last lifecycle run: {formatIsoTime(lifecycleResult.run_at)}</p>
                <p>
                  archived {lifecycleResult.archived_assets} · deleted projections{' '}
                  {lifecycleResult.deleted_projections}
                </p>
                <p>
                  snapshot backfill {lifecycleResult.snapshot_backfill_succeeded}/
                  {lifecycleResult.snapshot_backfill_attempted} · failed{' '}
                  {lifecycleResult.snapshot_backfill_failed}
                </p>
              </div>
            )}
          </div>

          <div className={"space-y-3 rounded border bg-muted/20 p-3"}>
            <p className={"text-xs font-medium"}>Lifecycle & Alerts</p>
            <p className={"text-[11px] text-muted-foreground"}>
              orphan {observability?.lifecycle_candidates.orphan_assets ?? 0} · expired projections {observability?.lifecycle_candidates.expired_projections ?? 0} · snapshot backfill {observability?.lifecycle_candidates.snapshot_backfill_assets ?? 0}
            </p>
            <div className={"space-y-2"}>
              {(observability?.recent_alerts ?? []).slice(0, 5).map((alert) => (
                <div key={alert.id} className={"rounded border bg-background/80 px-3 py-2 text-[11px]"}>
                  <div className={"flex flex-wrap items-center gap-2"}>
                    <Badge variant="outline">{alert.severity}</Badge>
                    <span className={"font-medium"}>{alert.event_type}</span>
                  </div>
                  <p className={"mt-1 text-muted-foreground"}>
                    {alert.surface} · {formatIsoTime(alert.created_at)}
                  </p>
                </div>
              ))}
              {(observability?.recent_alerts ?? []).length === 0 && (
                <p className={"text-[11px] text-muted-foreground"}>暂无 media alert。</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
function StatCard({
  title,
  value,
  variant,
  detail,
}: {
  title: string
  value: string
  variant: 'success' | 'muted' | 'default'
  detail: string
}) {
  const badgeClass = {
    success: 'bg-success/10 text-success',
    muted: 'bg-secondary text-secondary-foreground',
    default: 'bg-primary/10 text-primary',
  }[variant]
  return (
    <Card>
      <CardContent className={"pt-4 pb-3"}>
        <p className={"text-[10px] font-medium text-muted-foreground uppercase tracking-wider"}>{title}</p>
        <div className={"mt-1 flex items-baseline gap-2"}>
          <Badge variant="outline" className={cn("text-xs", badgeClass)}>
            {value}
          </Badge>
        </div>
        <p className={"mt-1 text-[10px] text-muted-foreground"}>{detail}</p>
      </CardContent>
    </Card>
  )
}
function formatDurationMs(value: number | null): string {
  if (value === null) return '-'
  if (value >= 60000) return `${Math.round(value / 60000)}m`
  if (value >= 1000) return `${Math.round(value / 1000)}s`
  return `${value}ms`
}
function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return `${Math.round(value * 100)}%`
}
function formatIsoTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}
function parseOptionalNumber(value: string): number | null {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}
function parseOptionalInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}
function variantFromGate(
  gates: AdminMediaObservabilityData['gates'] | undefined,
  gateId: MediaObservabilityGateId,
): 'success' | 'muted' | 'default' {
  const status = gates?.find((gate) => gate.id === gateId)?.status
  if (status === 'pass') return 'success'
  if (status === 'block') return 'muted'
  return 'default'
}
type MediaObservabilityGateId =
  | 'root_post_band'
  | 'attach_stability'
  | 'generation_health'
  | 'privacy_safety'
function TickResultCard({ result }: { result: TickResult }) {
  return (
    <Card>
      <CardHeader className={"pb-2"}>
        <CardTitle className={"text-sm"}>Tick 结果</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className={"flex gap-3 text-xs"}>
          <span>事件: {result.processed_events}</span>
          <span>分配: {result.batch_stats.allocated_agents}</span>
          <span className={"text-success"}>成功: {result.batch_stats.successful}</span>
          <span className={"text-destructive"}>失败: {result.batch_stats.failed}</span>
        </div>
        {result.scheduled_post?.triggered && (
          <div className={"rounded border border-primary/20 bg-primary/5 px-3 py-2 text-xs"}>
            <p className={"font-medium"}>自主发帖</p>
            <p className={"text-muted-foreground"}>
              {result.scheduled_post.post_id
                ? `新帖 ${result.scheduled_post.post_id} (${result.scheduled_post.latency_ms}ms)`
                : `失败: ${result.scheduled_post.error}`}
            </p>
          </div>
        )}
        {result.executions.length > 0 && (
          <div className="space-y-1">
            {result.executions.map((exec, i) => (
              <div key={i} className={"flex items-center justify-between rounded border px-2 py-1 text-[11px]"}>
                <span className="truncate">{exec.agent_id}</span>
                <div className="flex items-center gap-2">
                  {exec.usage && (
                    <span className={"text-muted-foreground"}>{exec.usage.total_tokens}tok</span>
                  )}
                  <span className={"text-muted-foreground"}>{exec.latency_ms}ms</span>
                  <Badge
                    variant="outline"
                    className={exec.success ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}
                  >
                    {exec.success ? '✓' : '✗'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
function PostResultCard({ result }: { result: PostResult }) {
  return (
    <Card>
      <CardHeader className={"pb-2"}>
        <CardTitle className={"text-sm"}>发帖结果</CardTitle>
      </CardHeader>
      <CardContent className={"text-xs space-y-1"}>
        {result.post_id ? (
          <>
            <p>
              <span className={"text-muted-foreground"}>帖子 ID:</span> {result.post_id}
            </p>
            <p>
              <span className={"text-muted-foreground"}>Agent:</span> {result.agent_id}
            </p>
            <p>
              <span className={"text-muted-foreground"}>社区:</span> {result.community_id}
            </p>
            {result.usage && (
              <p>
                <span className={"text-muted-foreground"}>Tokens:</span> {result.usage.total_tokens} (
                {result.usage.prompt_tokens}p + {result.usage.completion_tokens}c)
              </p>
            )}
            {result.latency_ms && (
              <p>
                <span className={"text-muted-foreground"}>延迟:</span> {result.latency_ms}ms
              </p>
            )}
          </>
        ) : (
          <p className={"text-warning"}>{result.error ?? '未触发'}</p>
        )}
      </CardContent>
    </Card>
  )
}
function StageRotationResultCard({ result }: { result: StageSeasonRotationResult }) {
  return (
    <Card>
      <CardHeader className={"pb-2"}>
        <CardTitle className={"text-sm"}>Season Rotation 结果</CardTitle>
      </CardHeader>
      <CardContent className={"space-y-2 text-xs"}>
        <p>
          开放数量: {result.open_count} · activated: {result.activated.length} · replaced:{' '}
          {result.replaced.length}
        </p>
        <p className={"text-muted-foreground"}>
          dist 导出: {result.exported_templates} templates / {result.launch_templates} launch
        </p>
        {result.activated.length > 0 && (
          <div className={"rounded border bg-muted/20 px-2 py-1"}>
            <p className={"font-medium"}>新启用</p>
            {result.activated.map((item) => (
              <p key={`${item.slot}-${item.template_id}`} className={"text-[11px] text-muted-foreground"}>
                {item.slot}: {item.template_id}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
function formatTime(ts: number): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
function formatSsePhase(phase: 'connecting' | 'connected' | 'reconnecting' | 'offline'): string {
  switch (phase) {
    case 'connected':
      return '已连接'
    case 'reconnecting':
      return '重连中'
    case 'offline':
      return '离线'
    default:
      return '连接中'
  }
}
