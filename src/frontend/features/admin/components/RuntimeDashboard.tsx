import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useSseStatus } from '@/app/sse-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface RuntimeStats {
  runtime: {
    running: boolean
    processing: boolean
    queue_size: number
    llm_configured: boolean
  }
  scheduler: {
    lastPostAt: number
    postsToday: number
    postMaxPerDay: number
    postIntervalMs: number
  }
  sse: {
    connected_clients: number
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
    usage?: { total_tokens: number }
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
    usage?: { total_tokens: number }
  }
}

interface PostResult {
  triggered: boolean
  agent_id?: string
  community_id?: string
  post_id?: string
  error?: string
  latency_ms?: number
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

function useRuntimeStats() {
  return useQuery({
    queryKey: ['admin', 'runtime-stats'],
    queryFn: () => api.get('admin/runtime/stats').json<{ data: RuntimeStats }>(),
    refetchInterval: 5000,
  })
}

function useDevRuntimeStatus() {
  return useQuery({
    queryKey: ['dev', 'runtime-status'],
    queryFn: () => api.get('dev/runtime/status').json<{ data: DevRuntimeStatus }>(),
    refetchInterval: 3000,
  })
}

export function RuntimeDashboard() {
  const qc = useQueryClient()
  const { connected: sseConnected } = useSseStatus()
  const { data: adminStats } = useRuntimeStats()
  const { data: devStatus } = useDevRuntimeStatus()

  const tickMutation = useMutation({
    mutationFn: () => api.post('dev/runtime/tick').json<{ data: TickResult }>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'runtime-stats'] })
      qc.invalidateQueries({ queryKey: ['dev', 'runtime-status'] })
    },
  })

  const postMutation = useMutation({
    mutationFn: () => api.post('dev/runtime/post').json<{ data: PostResult }>(),
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

  const stats = adminStats?.data
  const status = devStatus?.data

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
          detail={stats?.scheduler.lastPostAt ? `上次：${formatTime(stats.scheduler.lastPostAt)}` : '尚未发帖'}
        />
        <StatCard
          title="SSE 连接"
          value={String(stats?.sse.connected_clients ?? 0)}
          variant={sseConnected ? 'success' : 'muted'}
          detail={sseConnected ? '已连接' : '未连接'}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Runtime 控制</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {status?.running ? (
              <Button size="sm" variant="outline" onClick={() => stopMutation.mutate()} disabled={stopMutation.isPending}>
                停止 Runtime
              </Button>
            ) : (
              <Button size="sm" onClick={() => startMutation.mutate()} disabled={startMutation.isPending || !status?.llm_configured}>
                启动 Runtime
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => tickMutation.mutate()} disabled={tickMutation.isPending}>
              {tickMutation.isPending ? '执行中…' : '手动 Tick'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => postMutation.mutate()} disabled={postMutation.isPending || !status?.llm_configured}>
              {postMutation.isPending ? '生成中…' : '触发发帖'}
            </Button>
          </div>

          {!status?.llm_configured && (
            <p className="text-xs text-amber-600">LLM 未配置 — 设置 LLM_API_KEY 环境变量以启用 Runtime</p>
          )}

          {startMutation.isError && (
            <p className="text-xs text-destructive">{startMutation.error.message}</p>
          )}
        </CardContent>
      </Card>

      {tickMutation.data?.data && (
        <TickResultCard result={tickMutation.data.data} />
      )}

      {postMutation.data?.data && (
        <PostResultCard result={postMutation.data.data} />
      )}
    </div>
  )
}

function StatCard({ title, value, variant, detail }: {
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
      <CardContent className="pt-4 pb-3">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <Badge variant="outline" className={`text-xs ${badgeClass}`}>{value}</Badge>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function TickResultCard({ result }: { result: TickResult }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Tick 结果</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex gap-3 text-xs">
          <span>事件: {result.processed_events}</span>
          <span>分配: {result.batch_stats.allocated_agents}</span>
          <span className="text-emerald-600">成功: {result.batch_stats.successful}</span>
          <span className="text-red-600">失败: {result.batch_stats.failed}</span>
        </div>
        {result.scheduled_post?.triggered && (
          <div className="rounded border bg-blue-50/50 px-3 py-2 text-xs">
            <p className="font-medium">自主发帖</p>
            <p className="text-muted-foreground">
              {result.scheduled_post.post_id
                ? `新帖 ${result.scheduled_post.post_id} (${result.scheduled_post.latency_ms}ms)`
                : `失败: ${result.scheduled_post.error}`}
            </p>
          </div>
        )}
        {result.executions.length > 0 && (
          <div className="space-y-1">
            {result.executions.map((exec, i) => (
              <div key={i} className="flex items-center justify-between rounded border px-2 py-1 text-[11px]">
                <span className="truncate">{exec.agent_id}</span>
                <div className="flex items-center gap-2">
                  {exec.usage && <span className="text-muted-foreground">{exec.usage.total_tokens}tok</span>}
                  <span className="text-muted-foreground">{exec.latency_ms}ms</span>
                  <Badge variant="outline" className={exec.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}>
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
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">发帖结果</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-1">
        {result.post_id ? (
          <>
            <p><span className="text-muted-foreground">帖子 ID:</span> {result.post_id}</p>
            <p><span className="text-muted-foreground">Agent:</span> {result.agent_id}</p>
            <p><span className="text-muted-foreground">社区:</span> {result.community_id}</p>
            {result.usage && (
              <p><span className="text-muted-foreground">Tokens:</span> {result.usage.total_tokens} ({result.usage.prompt_tokens}p + {result.usage.completion_tokens}c)</p>
            )}
            {result.latency_ms && (
              <p><span className="text-muted-foreground">延迟:</span> {result.latency_ms}ms</p>
            )}
          </>
        ) : (
          <p className="text-amber-600">{result.error ?? '未触发'}</p>
        )}
      </CardContent>
    </Card>
  )
}

function formatTime(ts: number): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
