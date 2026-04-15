import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type {
  KickoffSuiteEditAction,
  WarmupBatchReadModel,
  WarmupGovernanceAction,
  WarmupReviewReasonCode,
} from '@/api/types'
import type { AdminPanelController } from './use-admin-panel-controller'

type WarmupSlice = AdminPanelController['warmup']

const REVIEW_REASON_OPTIONS: Array<{
  value: WarmupReviewReasonCode
  label: string
}> = [
  { value: 'content_quality', label: '内容质量' },
  { value: 'distribution_density', label: '密度不足' },
  { value: 'media_coverage', label: '媒体覆盖' },
  { value: 'kickoff_invalid', label: 'Kickoff 失效' },
  { value: 'process_issue', label: '流程问题' },
]

const EDIT_ACTION_OPTIONS: Array<{
  value: KickoffSuiteEditAction
  label: string
}> = [
  { value: 'rewrite_post', label: 'rewrite_post' },
  { value: 'replace_post_media', label: 'replace_post_media' },
  { value: 'regenerate_thread', label: 'regenerate_thread' },
  { value: 'regenerate_turn', label: 'regenerate_turn' },
]

function BatchCard({
  title,
  batch,
}: {
  title: string
  batch: WarmupBatchReadModel | null
}) {
  if (!batch) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">未生成</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant="outline">{batch.state}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="grid gap-2 sm:grid-cols-5">
          <Metric label="Posts" value={batch.stats.posts} />
          <Metric label="Threads" value={batch.stats.threads} />
          <Metric label="Turns" value={batch.stats.turns} />
          <Metric label="Votes" value={batch.stats.votes} />
          <Metric label="Media" value={batch.stats.media} />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Coverage</p>
          <div className="flex flex-wrap gap-2">
            {batch.coverage.map((item) => (
              <Badge key={item.community_id} variant="secondary">
                {item.community_name} · {item.post_count}
              </Badge>
            ))}
            {batch.coverage.length === 0 && (
              <span className="text-muted-foreground">无社区覆盖数据</span>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <p className="font-medium">Samples</p>
          <div className="space-y-2">
            {batch.samples.map((sample) => (
              <div key={sample.post_id} className="rounded-md border bg-card px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{sample.title}</p>
                  <Badge variant="outline">{sample.distribution_state}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {sample.community_name} · threads {sample.thread_count} · turns {sample.turn_count}
                  {' · '}
                  votes {sample.vote_count} · media {sample.media_count}
                </p>
              </div>
            ))}
            {batch.samples.length === 0 && (
              <p className="text-muted-foreground">无样本卡片</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}

function VerifierStatusBadge({
  status,
}: {
  status: 'running' | 'passed' | 'failed'
}) {
  const variant = status === 'passed' ? 'secondary' : status === 'failed' ? 'destructive' : 'outline'
  return <Badge variant={variant}>{status}</Badge>
}

export function WarmupGovernanceTab({ warmup }: { warmup: WarmupSlice }) {
  const detail = warmup.detail
  const latestVerifierRun = warmup.latestVerifierRun

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Create Candidate Suite</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              placeholder="suite label（默认 launch-warm-start-v1）"
              value={warmup.suiteLabel}
              onChange={(event) => warmup.setSuiteLabel(event.target.value)}
              className="h-8 text-xs"
            />
            <Input
              placeholder="runtime top-up posts"
              value={warmup.topupPosts}
              onChange={(event) => warmup.setTopupPosts(event.target.value)}
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              disabled={warmup.createMutation.isPending}
              onClick={() => {
                void warmup.handleCreateSuite()
              }}
            >
              {warmup.createMutation.isPending ? '生成中…' : '创建 Candidate'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Suites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {warmup.suites.map((suite) => (
              <button
                key={suite.id}
                type="button"
                onClick={() => warmup.setSelectedSuiteId(suite.id)}
                className={`w-full rounded-md border px-3 py-2 text-left ${
                  warmup.selectedSuiteId === suite.id ? 'border-primary bg-muted/40' : 'bg-card'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{suite.suite_label ?? suite.id}</p>
                  <Badge variant="outline">{suite.state}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  posts {suite.summary.posts} · votes {suite.summary.votes}
                  {' · '}
                  media ratio {suite.summary.media_coverage_ratio}
                </p>
              </button>
            ))}
            {warmup.suites.length === 0 && (
              <p className="text-xs text-muted-foreground">暂无 warm-up suite</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm">Warm-up Verifier</CardTitle>
              {latestVerifierRun?.summary ? (
                <VerifierStatusBadge status={latestVerifierRun.summary.status} />
              ) : (
                <Badge variant="outline">no runs</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <Button
              size="sm"
              disabled={warmup.runVerifierMutation.isPending}
              onClick={() => {
                void warmup.handleRunVerifier()
              }}
            >
              {warmup.runVerifierMutation.isPending ? '执行中…' : '重新执行 verifier'}
            </Button>

            {!latestVerifierRun?.summary && (
              <p className="text-muted-foreground">尚无 warm-up closure verifier 运行记录。</p>
            )}

            {latestVerifierRun?.summary && (
              <>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Suite" value={latestVerifierRun.summary.suite_id ? 1 : 0} />
                  <Metric label="Probe" value={latestVerifierRun.summary.probe_post_id ? 1 : 0} />
                  <Metric label="Diagnoses" value={latestVerifierRun.diagnoses.length} />
                  <Metric
                    label="Artifacts"
                    value={latestVerifierRun.summary.artifact_dir ? 1 : 0}
                  />
                </div>

                <div className="space-y-1">
                  <p className="font-medium">Latest Run</p>
                  <p className="text-muted-foreground">run {latestVerifierRun.summary.run_id}</p>
                  <p className="text-muted-foreground">
                    suite {latestVerifierRun.summary.suite_id ?? 'none'}
                    {' · '}
                    baseline {latestVerifierRun.summary.active_baseline_id ?? 'none'}
                    {' · '}
                    probe {latestVerifierRun.summary.probe_post_id ?? 'none'}
                  </p>
                  {latestVerifierRun.summary.failed_phase && (
                    <p className="text-muted-foreground">
                      failed phase: {latestVerifierRun.summary.failed_phase}
                    </p>
                  )}
                </div>

                {latestVerifierRun.top_diagnosis && (
                  <div className="rounded-md border bg-card px-3 py-2">
                    <p className="font-medium">{latestVerifierRun.top_diagnosis.summary_zh}</p>
                    <p className="mt-1 text-muted-foreground">
                      {latestVerifierRun.top_diagnosis.code}
                      {' · '}
                      {latestVerifierRun.top_diagnosis.phase}
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <p className="font-medium">Surface Matrix</p>
                  <div className="flex flex-wrap gap-2">
                    {(['feed', 'home', 'highlights', 'search'] as const).map((surface) => {
                      const ok = latestVerifierRun.summary.surface_matrix[surface]
                      return (
                        <Badge
                          key={surface}
                          variant={ok === true ? 'secondary' : ok === false ? 'destructive' : 'outline'}
                        >
                          {surface} {ok === true ? 'ok' : ok === false ? 'fail' : 'n/a'}
                        </Badge>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="font-medium">Governance Drill</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={
                        latestVerifierRun.summary.governance_drill.quarantine_ok === true
                          ? 'secondary'
                          : latestVerifierRun.summary.governance_drill.quarantine_ok === false
                            ? 'destructive'
                            : 'outline'
                      }
                    >
                      quarantine {latestVerifierRun.summary.governance_drill.quarantine_ok === true
                        ? 'ok'
                        : latestVerifierRun.summary.governance_drill.quarantine_ok === false
                          ? 'fail'
                          : 'n/a'}
                    </Badge>
                    <Badge
                      variant={
                        latestVerifierRun.summary.governance_drill.restore_ok === true
                          ? 'secondary'
                          : latestVerifierRun.summary.governance_drill.restore_ok === false
                            ? 'destructive'
                            : 'outline'
                      }
                    >
                      restore {latestVerifierRun.summary.governance_drill.restore_ok === true
                        ? 'ok'
                        : latestVerifierRun.summary.governance_drill.restore_ok === false
                          ? 'fail'
                          : 'n/a'}
                    </Badge>
                    <Badge
                      variant={
                        latestVerifierRun.summary.governance_drill.cleanup_ok === true
                          ? 'secondary'
                          : latestVerifierRun.summary.governance_drill.cleanup_ok === false
                            ? 'destructive'
                            : 'outline'
                      }
                    >
                      cleanup {latestVerifierRun.summary.governance_drill.cleanup_ok === true
                        ? 'ok'
                        : latestVerifierRun.summary.governance_drill.cleanup_ok === false
                          ? 'fail'
                          : 'n/a'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="font-medium">Artifacts</p>
                  <p className="break-all text-muted-foreground">
                    {latestVerifierRun.summary.artifact_dir}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {!detail && (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">
              选择左侧 suite 查看 review / activation / governance 详情。
            </CardContent>
          </Card>
        )}

        {detail && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">{detail.suite_label ?? detail.id}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      suite {detail.id}
                    </p>
                  </div>
                  <Badge variant="outline">{detail.state}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid gap-2 sm:grid-cols-6">
                  <Metric label="Posts" value={detail.summary.posts} />
                  <Metric label="Threads" value={detail.summary.threads} />
                  <Metric label="Turns" value={detail.summary.turns} />
                  <Metric label="Votes" value={detail.summary.votes} />
                  <Metric label="Media" value={detail.summary.media} />
                  <Metric label="Communities" value={detail.summary.communities} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={detail.activation_readiness.ok ? 'secondary' : 'destructive'}>
                    activation {detail.activation_readiness.ok ? 'ready' : 'blocked'}
                  </Badge>
                  <Badge variant={detail.programming_health.visual_ratio_ok ? 'secondary' : 'destructive'}>
                    visual {detail.programming_health.visual_ratio_ok ? 'ok' : 'blocked'}
                  </Badge>
                  <Badge variant={detail.programming_health.aftershow_pipeline_ok ? 'secondary' : 'destructive'}>
                    aftershow {detail.programming_health.aftershow_pipeline_ok ? 'ok' : 'blocked'}
                  </Badge>
                  <Badge variant="outline">
                    warnings {detail.programming_health.warning_count}
                  </Badge>
                </div>
                {detail.activation_readiness.reasons.length > 0 && (
                  <div className="space-y-1">
                    <p className="font-medium">Activation blockers</p>
                    <div className="flex flex-wrap gap-2">
                      {detail.activation_readiness.reasons.map((reason) => (
                        <Badge key={reason} variant="destructive">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!detail.actions.can_retry || warmup.retryMutation.isPending}
                    onClick={() => {
                      void warmup.handleRetrySuite()
                    }}
                  >
                    Retry
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!detail.actions.can_rebuild || warmup.rebuildMutation.isPending}
                    onClick={() => {
                      void warmup.handleRebuildSuite()
                    }}
                  >
                    Rebuild Warmup
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!detail.actions.can_archive || warmup.archiveMutation.isPending}
                    onClick={() => {
                      void warmup.handleArchiveSuite()
                    }}
                  >
                    Archive
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Review Gate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    value={warmup.reviewDecision}
                    onChange={(event) =>
                      warmup.setReviewDecision(event.target.value as WarmupSlice['reviewDecision'])
                    }
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    <option value="pass_to_active">pass_to_active</option>
                    <option value="not_passed">not_passed</option>
                  </select>
                  <Input
                    placeholder="review note"
                    value={warmup.reviewNote}
                    onChange={(event) => warmup.setReviewNote(event.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                {warmup.reviewDecision === 'not_passed' && (
                  <div className="flex flex-wrap gap-2">
                    {REVIEW_REASON_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => warmup.toggleReason(option.value)}
                        className={`rounded-md border px-2 py-1 ${
                          warmup.reviewReasons.includes(option.value)
                            ? 'border-primary bg-muted/50'
                            : 'bg-card'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}

                <Button
                  size="sm"
                  disabled={warmup.reviewMutation.isPending}
                  onClick={() => {
                    const confirmActivation = warmup.reviewDecision === 'pass_to_active'
                      ? typeof window === 'undefined'
                        ? true
                        : window.confirm(
                            '该操作会接管当前 staging baseline，runtime 放量将以该 suite 为前提，且当前生效 baseline 会被替换。是否继续？',
                          )
                      : false
                    if (!confirmActivation && warmup.reviewDecision === 'pass_to_active') return
                    void warmup.handleReviewSuite(confirmActivation)
                  }}
                >
                  {warmup.reviewMutation.isPending ? '提交中…' : '提交 Review'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Governance Preview / Execute</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex gap-2">
                  <select
                    value={warmup.governanceAction}
                    onChange={(event) =>
                      warmup.setGovernanceAction(event.target.value as WarmupGovernanceAction)
                    }
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    <option value="quarantine">quarantine</option>
                    <option value="restore">restore</option>
                    <option value="archive">archive</option>
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={warmup.previewMutation.isPending}
                    onClick={() => {
                      void warmup.handlePreviewGovernance()
                    }}
                  >
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    disabled={warmup.executeMutation.isPending}
                    onClick={() => {
                      void warmup.handleExecuteGovernance()
                    }}
                  >
                    Execute
                  </Button>
                </div>

                {warmup.governancePreview && (
                  <div className="rounded-md border bg-card px-3 py-2">
                    <p className="font-medium">{warmup.governancePreview.action}</p>
                    <p className="mt-1 text-muted-foreground">
                      posts {warmup.governancePreview.counts.posts} · threads {warmup.governancePreview.counts.threads}
                      {' · '}
                      turns {warmup.governancePreview.counts.turns} · media {warmup.governancePreview.counts.media}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Localized Kickoff Edit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    value={warmup.editAction}
                    onChange={(event) =>
                      warmup.setEditAction(event.target.value as KickoffSuiteEditAction)
                    }
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    {EDIT_ACTION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="reason"
                    value={warmup.editReason}
                    onChange={(event) => warmup.setEditReason(event.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    placeholder="post_id"
                    value={warmup.editPostId}
                    onChange={(event) => warmup.setEditPostId(event.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="thread_id"
                    value={warmup.editThreadId}
                    onChange={(event) => warmup.setEditThreadId(event.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="turn_id"
                    value={warmup.editTurnId}
                    onChange={(event) => warmup.setEditTurnId(event.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <Textarea
                  value={warmup.editPayload}
                  onChange={(event) => warmup.setEditPayload(event.target.value)}
                  className="min-h-28 font-mono text-[11px]"
                  placeholder='{"body":"updated content"}'
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={warmup.previewEditMutation.isPending}
                    onClick={() => {
                      void warmup.handlePreviewEdit().catch((error: unknown) => {
                        alert(error instanceof Error ? error.message : '编辑预览失败')
                      })
                    }}
                  >
                    Preview Edit
                  </Button>
                  <Button
                    size="sm"
                    disabled={warmup.applyEditMutation.isPending}
                    onClick={() => {
                      void warmup.handleApplyEdit().catch((error: unknown) => {
                        alert(error instanceof Error ? error.message : '编辑应用失败')
                      })
                    }}
                  >
                    Apply Edit
                  </Button>
                </div>
                {warmup.editPreview && (
                  <div className="rounded-md border bg-card px-3 py-2">
                    <p className="font-medium">{warmup.editPreview.action}</p>
                    <p className="mt-1 text-muted-foreground">{warmup.editPreview.impact_summary}</p>
                    {warmup.editPreview.target_ids.length > 0 && (
                      <p className="mt-1 text-muted-foreground">
                        target: {warmup.editPreview.target_ids.join(', ')}
                      </p>
                    )}
                    {warmup.editPreview.warnings.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {warmup.editPreview.warnings.map((warning) => (
                          <Badge key={warning} variant="outline">
                            {warning}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {warmup.latestEditResult && (
                  <div className="rounded-md border bg-card px-3 py-2">
                    <p className="font-medium">Latest edit readiness</p>
                    <p className="mt-1 text-muted-foreground">
                      activation {warmup.latestEditResult.suite_readiness.activation_readiness.ok ? 'ready' : 'blocked'}
                      {' · '}
                      warnings {warmup.latestEditResult.suite_readiness.quality_state.warning_count}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      suite {warmup.latestEditResult.suite_detail.id} · state {warmup.latestEditResult.suite_detail.state}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <BatchCard title="Kickoff Layer" batch={detail.kickoff_batch} />
              <BatchCard title="Warmup Layer" batch={detail.warmup_batch} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
