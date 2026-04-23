import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useWarmupController } from './use-warmup-controller'

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

export function WarmupGovernanceTab() {
  const warmup = useWarmupController()
  const kickoff = warmup.kickoff
  const detail = warmup.detail
  const latestVerifierRun = warmup.latestVerifierRun
  const hasGeneratingRun = warmup.runs.some((run) => run.state === 'generating')

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div data-ui="stack" data-direction="col" data-gap="4">
        <section data-ui="section" className="space-y-3 border-b pb-4">
          <h3 className="text-sm font-semibold">启动基线数据</h3>
          <div className="space-y-3 text-xs">
            {!kickoff && <p className="text-muted-foreground">尚未导入 kickoff baseline。</p>}
            {kickoff && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p data-ui="text" data-variant="body" className="font-medium">{kickoff.baseline_label ?? kickoff.id}</p>
                    <p className="text-muted-foreground">kickoff {kickoff.id}</p>
                  </div>
                  <Badge variant="outline">{kickoff.state}</Badge>
                </div>
                <div data-ui="grid" data-gap="2" className="sm:grid-cols-2">
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
          </div>
        </section>

        <section data-ui="section" className="space-y-3 border-b pb-4">
          <h3 className="text-sm font-semibold">预热执行记录</h3>
          <div data-ui="stack" data-direction="col" data-gap="2">
            <ul data-ui="list" data-variant="admin-rows" className="space-y-2">
              {warmup.runs.map((run) => (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => warmup.setSelectedRunId(run.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left ${
                      warmup.selectedRunId === run.id ? 'border-primary bg-muted/40' : 'bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p data-ui="text" data-variant="body" className="font-medium">{run.id}</p>
                      <Badge variant={run.is_current ? 'secondary' : 'outline'}>
                        {run.is_current ? 'current' : run.state}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      target {run.target_posts} · attempts {run.attempted}/{run.max_attempts} ·
                      triggered {run.triggered}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            {warmup.runs.length === 0 && (
              <p data-ui="text" data-variant="caption" data-tone="muted">暂无 warmup run。</p>
            )}
          </div>
        </section>
      </div>

      <div data-ui="stack" data-direction="col" data-gap="4">
        <section data-ui="section" className="space-y-3 border-b pb-4">
          <h3 className="text-sm font-semibold">Runtime Controls</h3>
          <div className="space-y-3 text-xs">
            <div data-ui="grid" data-gap="3" className="md:grid-cols-2">
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
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      warmup.rollbackMutation.isPending
                      || !warmup.selectedRunId
                      || warmup.detail?.state === 'generating'
                      || warmup.detail?.state === 'archived'
                    }
                  >
                    {warmup.rollbackMutation.isPending ? '回滚中…' : 'Rollback Selected Run'}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Rollback</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to rollback the selected warmup run? This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          void warmup.handleRollbackWarmupRun()
                        }}
                      >
                        Confirm Rollback
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

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
          </div>
        </section>

        <section data-ui="section" className="space-y-3 border-b pb-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Selected Run</h3>
            {detail ? (
              <Badge variant={detail.is_current ? 'secondary' : 'outline'}>
                {detail.is_current ? 'current' : detail.state}
              </Badge>
            ) : (
              <Badge variant="outline">none</Badge>
            )}
          </div>
          <div className="space-y-3 text-xs">
            {!detail && <p className="text-muted-foreground">选择左侧 warmup run 查看详情。</p>}
            {detail && (
              <>
                <div data-ui="grid" data-gap="2" className="sm:grid-cols-4">
                  <Metric label="Posts" value={detail.stats.posts} />
                  <Metric label="Threads" value={detail.stats.threads} />
                  <Metric label="Turns" value={detail.stats.turns} />
                  <Metric label="Media" value={detail.stats.media} />
                </div>
                <div data-ui="stack" data-direction="col" data-gap="1">
                  <p className="font-medium">Run Summary</p>
                  <p className="text-muted-foreground">
                    stop {detail.stop_reason ?? 'pending'} · source {detail.source_run_id ?? 'none'}
                  </p>
                  {detail.errors.length > 0 && (
                    <p className="text-destructive">{detail.errors.join(' · ')}</p>
                  )}
                </div>
                <div data-ui="stack" data-direction="col" data-gap="1">
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
          </div>
        </section>

        <section data-ui="section" className="space-y-3 border-b pb-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">结果验证器</h3>
            {latestVerifierRun?.summary ? (
              <VerifierStatusBadge status={latestVerifierRun.summary.status} />
            ) : (
              <Badge variant="outline">no runs</Badge>
            )}
          </div>
          <div className="space-y-3 text-xs">
            {!latestVerifierRun?.summary && (
              <p className="text-muted-foreground">尚无 warmup verifier 记录。</p>
            )}
            {latestVerifierRun?.summary && (
              <>
                <div data-ui="grid" data-gap="2" className="sm:grid-cols-3">
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
          </div>
        </section>
      </div>
    </div>
  )
}
