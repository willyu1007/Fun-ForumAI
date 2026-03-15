import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useRuntimeFeatures } from '@/api/hooks'
import type { GuidanceRuntimeData } from '@/api/types'
import { useSseStatus } from '@/app/sse-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { uix } from '@/shared/utils/uix'
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
  const { data: adminStats } = useRuntimeStats()
  const { data: devStatus } = useDevRuntimeStatus()
  const { data: runtimeFeatures } = useRuntimeFeatures()
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
        <CardHeader className={uix('uix-f4cc511ff0')}>
          <CardTitle className={uix('uix-fc7473ca09')}>Runtime 控制</CardTitle>
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

          <div className={uix('uix-eeb4b43685')}>
            <p className={uix('uix-da8bf29040')}>Season Rotation（Stage Template）</p>
            <p className={uix('uix-5b40858400')}>每次开放 3-5 个 hidden 模板并更新 launch 绑定。</p>
            {isProdNodeEnv && (
              <p className={uix('uix-276aec863c')}>
                生产环境仅支持 dry-run。真实轮换请执行：{' '}
                <code>pnpm stage:season:rotate --open-count={rotationOpenCount}</code>
              </p>
            )}
            <div className={uix('uix-304911ade7')}>
              <select
                className={uix('uix-7ef6b049b8')}
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
              <p className={uix('uix-24449fdcf8')}>{rotateStageMutation.error.message}</p>
            )}
          </div>

          {!status?.llm_configured && (
            <p className={uix('uix-18073eaa8e')}>
              LLM 未配置 — 设置 credential pool 对应的 provider API key 环境变量以启用 Runtime
            </p>
          )}

          {startMutation.isError && (
            <p className={uix('uix-551c237449')}>{startMutation.error.message}</p>
          )}

          <div className={uix('uix-856848d8a0')}>
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
              <p className={uix('uix-85d79ebf0d')}>
                errors: {sseStatus.lastError ?? '-'} / broker:{' '}
                {stats?.sse.broadcast_last_error ?? '-'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <PersonalityCompilerCard counters={runtimeFeatures?.data?.counters?.inference_profile} />
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
      <CardHeader className={uix('uix-f4cc511ff0')}>
        <CardTitle className={uix('uix-fc7473ca09')}>Personality Compiler</CardTitle>
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
        <p className={uix('uix-25be576b96')}>编译层只服务治理和路由，不直接进入 prompt 主文本。</p>
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
      <CardHeader className={uix('uix-f4cc511ff0')}>
        <CardTitle className={uix('uix-fc7473ca09')}>Provider Admission</CardTitle>
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
            <div key={entry.voice_line_id} className={uix('uix-86752f1d4a')}>
              <span className={uix('uix-aa8a502942')}>
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
      <CardHeader className={uix('uix-f4cc511ff0')}>
        <CardTitle className={uix('uix-fc7473ca09')}>Guidance Runtime</CardTitle>
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

        <div className={uix('uix-49f8a517a5')}>
          <p>teaching-first violations: {guidance?.teaching_first_violation_count ?? 0}</p>
          <p>
            delivered/opened/dismissed/completed metrics are aggregated from canonical guidance
            event log only.
          </p>
        </div>

        <div className="space-y-2">
          {reasonEntries.length === 0 ? (
            <p className={uix('uix-25be576b96')}>暂无 Guidance Runtime 指标。</p>
          ) : (
            reasonEntries.map(([reasonCode, metric]) => (
              <div key={reasonCode} className={uix('uix-86752f1d4a')}>
                <span className={uix('uix-aa8a502942')}>{reasonCode}</span>
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
    success: 'bg-emerald-50 text-emerald-700',
    muted: 'bg-gray-100 text-gray-500',
    default: 'bg-blue-50 text-blue-700',
  }[variant]
  return (
    <Card>
      <CardContent className={uix('uix-2384a01162')}>
        <p className={uix('uix-3f011da125')}>{title}</p>
        <div className={uix('uix-b7642927f7')}>
          <Badge variant="outline" className={cn(uix('uix-runtime-badge-base'), badgeClass)}>
            {value}
          </Badge>
        </div>
        <p className={uix('uix-81f2eca213')}>{detail}</p>
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
function TickResultCard({ result }: { result: TickResult }) {
  return (
    <Card>
      <CardHeader className={uix('uix-f4cc511ff0')}>
        <CardTitle className={uix('uix-fc7473ca09')}>Tick 结果</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className={uix('uix-ef292dc8c8')}>
          <span>事件: {result.processed_events}</span>
          <span>分配: {result.batch_stats.allocated_agents}</span>
          <span className={uix('uix-22f3f0194d')}>成功: {result.batch_stats.successful}</span>
          <span className={uix('uix-421d458123')}>失败: {result.batch_stats.failed}</span>
        </div>
        {result.scheduled_post?.triggered && (
          <div className={uix('uix-e746f13c5a')}>
            <p className={uix('uix-2689f39580')}>自主发帖</p>
            <p className={uix('uix-bfa6031907')}>
              {result.scheduled_post.post_id
                ? `新帖 ${result.scheduled_post.post_id} (${result.scheduled_post.latency_ms}ms)`
                : `失败: ${result.scheduled_post.error}`}
            </p>
          </div>
        )}
        {result.executions.length > 0 && (
          <div className="space-y-1">
            {result.executions.map((exec, i) => (
              <div key={i} className={uix('uix-9af999722d')}>
                <span className="truncate">{exec.agent_id}</span>
                <div className="flex items-center gap-2">
                  {exec.usage && (
                    <span className={uix('uix-bfa6031907')}>{exec.usage.total_tokens}tok</span>
                  )}
                  <span className={uix('uix-bfa6031907')}>{exec.latency_ms}ms</span>
                  <Badge
                    variant="outline"
                    className={exec.success ? uix('uix-6196a83432') : uix('uix-a47175a4cf')}
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
      <CardHeader className={uix('uix-f4cc511ff0')}>
        <CardTitle className={uix('uix-fc7473ca09')}>发帖结果</CardTitle>
      </CardHeader>
      <CardContent className={uix('uix-93c84cee36')}>
        {result.post_id ? (
          <>
            <p>
              <span className={uix('uix-bfa6031907')}>帖子 ID:</span> {result.post_id}
            </p>
            <p>
              <span className={uix('uix-bfa6031907')}>Agent:</span> {result.agent_id}
            </p>
            <p>
              <span className={uix('uix-bfa6031907')}>社区:</span> {result.community_id}
            </p>
            {result.usage && (
              <p>
                <span className={uix('uix-bfa6031907')}>Tokens:</span> {result.usage.total_tokens} (
                {result.usage.prompt_tokens}p + {result.usage.completion_tokens}c)
              </p>
            )}
            {result.latency_ms && (
              <p>
                <span className={uix('uix-bfa6031907')}>延迟:</span> {result.latency_ms}ms
              </p>
            )}
          </>
        ) : (
          <p className={uix('uix-47d65ecb05')}>{result.error ?? '未触发'}</p>
        )}
      </CardContent>
    </Card>
  )
}
function StageRotationResultCard({ result }: { result: StageSeasonRotationResult }) {
  return (
    <Card>
      <CardHeader className={uix('uix-f4cc511ff0')}>
        <CardTitle className={uix('uix-fc7473ca09')}>Season Rotation 结果</CardTitle>
      </CardHeader>
      <CardContent className={uix('uix-62c5186701')}>
        <p>
          开放数量: {result.open_count} · activated: {result.activated.length} · replaced:{' '}
          {result.replaced.length}
        </p>
        <p className={uix('uix-bfa6031907')}>
          dist 导出: {result.exported_templates} templates / {result.launch_templates} launch
        </p>
        {result.activated.length > 0 && (
          <div className={uix('uix-7082b8e8c3')}>
            <p className={uix('uix-2689f39580')}>新启用</p>
            {result.activated.map((item) => (
              <p key={`${item.slot}-${item.template_id}`} className={uix('uix-f7fc5c060a')}>
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
