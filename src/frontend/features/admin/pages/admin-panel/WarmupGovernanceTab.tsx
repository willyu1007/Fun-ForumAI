import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { AdminPanelController } from './use-admin-panel-controller'

type WarmupSlice = AdminPanelController['warmup']

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}

function VerifierStatusBadge({ status }: { status: 'running' | 'passed' | 'failed' }) {
  const variant =
    status === 'passed' ? 'secondary' : status === 'failed' ? 'destructive' : 'outline'
  return <Badge variant={variant}>{status}</Badge>
}

export function WarmupGovernanceTab({ warmup }: { warmup: WarmupSlice }) {
  const kickoff = warmup.kickoff
  const detail = warmup.detail
  const latestVerifierRun = warmup.latestVerifierRun
  const hasGeneratingRun = warmup.runs.some((run) => run.state === 'generating')

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Kickoff Baseline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {!kickoff && <p className="text-muted-foreground">尚未导入 kickoff baseline。</p>}
            {kickoff && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{kickoff.baseline_label ?? kickoff.id}</p>
                    <p className="text-muted-foreground">kickoff {kickoff.id}</p>
                  </div>
                  <Badge variant="outline">{kickoff.state}</Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Metric label="Posts" value={kickoff.kickoff_batch.stats.posts} />
                  <Metric label="Media" value={kickoff.kickoff_batch.stats.media} />
                  <Metric label="Threads" value={kickoff.kickoff_batch.stats.threads} />
                  <Metric label="Communities" value={kickoff.kickoff_batch.stats.communities} />
                </div>
                <div>
                  <p className="font-medium">Verification</p>
                  <p className="mt-1 text-muted-foreground">
                    {kickoff.verification.ok
                      ? 'kickoff baseline ready'
                      : kickoff.verification.missing.join(' · ')}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Warmup Runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {warmup.runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => warmup.setSelectedRunId(run.id)}
                className={`w-full rounded-md border px-3 py-2 text-left ${
                  warmup.selectedRunId === run.id ? 'border-primary bg-muted/40' : 'bg-card'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{run.id}</p>
                  <Badge variant={run.is_current ? 'secondary' : 'outline'}>
                    {run.is_current ? 'current' : run.state}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  target {run.target_posts} · attempts {run.attempted}/{run.max_attempts} ·
                  triggered {run.triggered}
                </p>
              </button>
            ))}
            {warmup.runs.length === 0 && (
              <p className="text-xs text-muted-foreground">暂无 warmup run。</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Runtime Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-muted-foreground">target_posts</span>
                <Input
                  value={warmup.targetPosts}
                  onChange={(event) => warmup.setTargetPosts(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground">max_attempts</span>
                <Input
                  value={warmup.maxAttempts}
                  onChange={(event) => warmup.setMaxAttempts(event.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={
                  warmup.startMutation.isPending || !kickoff?.verification.ok || hasGeneratingRun
                }
                onClick={() => {
                  void warmup.handleStartWarmupRun()
                }}
              >
                {warmup.startMutation.isPending ? '启动中…' : 'Start Warmup'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  warmup.rollbackMutation.isPending
                  || !warmup.selectedRunId
                  || warmup.detail?.state === 'generating'
                  || warmup.detail?.state === 'archived'
                }
                onClick={() => {
                  void warmup.handleRollbackWarmupRun()
                }}
              >
                {warmup.rollbackMutation.isPending ? '回滚中…' : 'Rollback Selected Run'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={warmup.runVerifierMutation.isPending || hasGeneratingRun}
                onClick={() => {
                  void warmup.handleRunVerifier()
                }}
              >
                {warmup.runVerifierMutation.isPending ? '执行中…' : 'Run Verifier'}
              </Button>
            </div>
            {hasGeneratingRun && (
              <p className="text-muted-foreground">
                当前已有 warmup run 正在执行，待其结束后再启动下一次 run 或执行 verifier。
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm">Selected Run</CardTitle>
              {detail ? (
                <Badge variant={detail.is_current ? 'secondary' : 'outline'}>
                  {detail.is_current ? 'current' : detail.state}
                </Badge>
              ) : (
                <Badge variant="outline">none</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {!detail && <p className="text-muted-foreground">选择左侧 warmup run 查看详情。</p>}
            {detail && (
              <>
                <div className="grid gap-2 sm:grid-cols-4">
                  <Metric label="Posts" value={detail.stats.posts} />
                  <Metric label="Threads" value={detail.stats.threads} />
                  <Metric label="Turns" value={detail.stats.turns} />
                  <Metric label="Media" value={detail.stats.media} />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Run Summary</p>
                  <p className="text-muted-foreground">
                    stop {detail.stop_reason ?? 'pending'} · source {detail.source_run_id ?? 'none'}
                  </p>
                  {detail.errors.length > 0 && (
                    <p className="text-muted-foreground">{detail.errors.join(' · ')}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Coverage</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.coverage.map((item) => (
                      <Badge key={item.community_id} variant="secondary">
                        {item.community_name} · {item.post_count}
                      </Badge>
                    ))}
                    {detail.coverage.length === 0 && (
                      <span className="text-muted-foreground">无社区覆盖数据</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm">Verifier</CardTitle>
              {latestVerifierRun?.summary ? (
                <VerifierStatusBadge status={latestVerifierRun.summary.status} />
              ) : (
                <Badge variant="outline">no runs</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {!latestVerifierRun?.summary && (
              <p className="text-muted-foreground">尚无 warmup verifier 记录。</p>
            )}
            {latestVerifierRun?.summary && (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Metric label="Diagnoses" value={latestVerifierRun.diagnoses.length} />
                  <Metric label="Probe" value={latestVerifierRun.summary.probe_post_id ? 1 : 0} />
                  <Metric
                    label="Artifacts"
                    value={latestVerifierRun.summary.artifact_dir ? 1 : 0}
                  />
                </div>
                <p className="text-muted-foreground">
                  run {latestVerifierRun.summary.run_id} · phase{' '}
                  {latestVerifierRun.summary.failed_phase ?? 'passed'}
                </p>
                {latestVerifierRun.top_diagnosis && (
                  <div className="rounded-md border bg-card px-3 py-2">
                    <p className="font-medium">{latestVerifierRun.top_diagnosis.summary_zh}</p>
                    <p className="mt-1 text-muted-foreground">
                      {latestVerifierRun.top_diagnosis.code}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
