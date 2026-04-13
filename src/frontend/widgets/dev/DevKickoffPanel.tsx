import { useEffect, useState } from 'react'
import { AlertCircle, ExternalLink, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useDevKickoffLatestRun, useDevKickoffRun, useDevKickoffStatus } from '@/api/hooks/dev'

interface DevKickoffPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DevKickoffPanel({ open, onOpenChange }: DevKickoffPanelProps) {
  const statusQuery = useDevKickoffStatus(open)
  const latestRunQuery = useDevKickoffLatestRun(open)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const nextRunId = latestRunQuery.data?.data.summary.run_id ?? null
    if (nextRunId) {
      setSelectedRunId(nextRunId)
    }
  }, [latestRunQuery.data?.data.summary.run_id, open])

  const runQuery = useDevKickoffRun(selectedRunId, open)

  const currentMode = statusQuery.data?.data.current_data_mode ?? 'unknown'
  const currentSuite = statusQuery.data?.data.current_suite ?? null
  const readiness = statusQuery.data?.data.latest_runtime_readiness ?? null
  const latestImportReport = statusQuery.data?.data.latest_import_report ?? null
  const latestRun = latestRunQuery.data?.data ?? null
  const selectedRun = runQuery.data?.data ?? latestRun
  const failureMessage =
    typeof selectedRun?.failure_log?.message === 'string' ? selectedRun.failure_log.message : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton={false} className="w-full p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SheetTitle className="text-sm">Local Kickoff 调试台</SheetTitle>
              <SheetDescription className="mt-1 text-xs">
                只显示 kickoff import / readiness / run artifact，不混入 release 验证。
              </SheetDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {currentMode}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  void statusQuery.refetch()
                  void latestRunQuery.refetch()
                  if (selectedRunId) {
                    void runQuery.refetch()
                  }
                }}
                aria-label="刷新 kickoff 调试状态"
              >
                <RefreshCw className="size-3.5" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-5rem)]">
          <div className="space-y-4 px-4 py-4">
            {(statusQuery.error || latestRunQuery.error || runQuery.error) && (
              <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3 text-xs">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Kickoff 调试数据读取失败</p>
                  <p className="text-muted-foreground">
                    {readErrorMessage(statusQuery.error) ?? readErrorMessage(latestRunQuery.error) ?? readErrorMessage(runQuery.error)}
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Current Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <KeyValue label="mode" value={currentMode} />
                  <KeyValue label="mode source" value={statusQuery.data?.data.mode_source ?? 'n/a'} />
                  <KeyValue label="suite_id" value={currentSuite?.id ?? 'n/a'} />
                  <KeyValue label="suite_label" value={currentSuite?.label ?? 'n/a'} />
                  <KeyValue label="kickoff_batch_id" value={currentSuite?.kickoff_batch_id ?? 'n/a'} />
                  <KeyValue label="warmup_batch_id" value={currentSuite?.warmup_batch_id ?? 'n/a'} />
                  <KeyValue label="baseline_id" value={currentSuite?.active_baseline_id ?? 'n/a'} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Runtime Readiness</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={readiness?.activation_readiness.ok ? 'secondary' : 'destructive'}>
                      activation {readiness?.activation_readiness.ok ? 'ready' : 'blocked'}
                    </Badge>
                    <Badge variant={readiness?.layer_readiness.kickoff_layer_ready ? 'secondary' : 'destructive'}>
                      kickoff {readiness?.layer_readiness.kickoff_layer_ready ? 'ok' : 'blocked'}
                    </Badge>
                    <Badge variant={readiness?.layer_readiness.warmup_layer_ready ? 'secondary' : 'destructive'}>
                      warmup {readiness?.layer_readiness.warmup_layer_ready ? 'ok' : 'blocked'}
                    </Badge>
                  </div>
                  <KeyValue label="warnings" value={String(readiness?.quality_state.warning_count ?? 0)} />
                  <KeyValue
                    label="media ratio"
                    value={String(readiness?.quality_state.summary.media_coverage_ratio ?? 0)}
                  />
                  <KeyValue label="allow growth" value={String(readiness?.admission.allow_public_growth ?? false)} />
                  {readiness?.activation_readiness.reasons.length ? (
                    <div className="flex flex-wrap gap-2">
                      {readiness.activation_readiness.reasons.map((reason) => (
                        <Badge key={reason} variant="outline">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">当前没有 activation blocker。</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm">Latest Import Summary</CardTitle>
                  {latestImportReport && (
                    <Badge variant="outline" className="text-[10px]">
                      {latestImportReport.report_meta.dry_run ? 'dry-run' : 'apply'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {latestImportReport ? (
                  <>
                    <KeyValue label="run_id" value={latestImportReport.report_meta.run_id} />
                    <KeyValue label="patch_id" value={latestImportReport.report_meta.patch_id ?? 'n/a'} />
                    <KeyValue label="failure_phase" value={latestImportReport.failure_phase ?? 'none'} />
                    <KeyValue
                      label="op_results"
                      value={String(latestImportReport.op_results?.length ?? 0)}
                    />
                    <KeyValue
                      label="resolution_map"
                      value={String(latestImportReport.resolution_map?.length ?? 0)}
                    />
                    <p className="text-muted-foreground">
                      posts {latestImportReport.summary_after_import.posts} · threads {latestImportReport.summary_after_import.threads}
                      {' · '}
                      turns {latestImportReport.summary_after_import.turns} · media {latestImportReport.summary_after_import.media}
                    </p>
                    {latestImportReport.recommended_next_actions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {latestImportReport.recommended_next_actions.map((action) => (
                          <Badge key={action} variant="secondary">
                            {action}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">当前没有 kickoff import report。</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm">Run Detail</CardTitle>
                  <div className="flex items-center gap-2">
                    {latestRun && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedRunId(latestRun.summary.run_id)}
                      >
                        打开最新 Run
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.location.assign('/admin?tab=warmup')
                        }
                      }}
                    >
                      跳转 Warm-up
                      <ExternalLink className="ml-1 size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                {selectedRun ? (
                  <>
                    <KeyValue label="run_id" value={selectedRun.summary.run_id} />
                    <KeyValue label="run_type" value={selectedRun.summary.run_type} />
                    <KeyValue label="profile_id" value={selectedRun.summary.profile_id ?? 'n/a'} />
                    <KeyValue label="patch_id" value={selectedRun.summary.patch_id ?? 'n/a'} />
                    <KeyValue label="failed_phase" value={selectedRun.summary.failed_phase ?? 'none'} />
                    {failureMessage ? <KeyValue label="failure_message" value={failureMessage} /> : null}
                    <KeyValue label="artifact_dir" value={selectedRun.summary.artifact_dir} mono />
                    <KeyValue label="context-pack" value={selectedRun.artifacts.context_pack_path ?? 'n/a'} mono />
                    <KeyValue label="generated-patch" value={selectedRun.artifacts.generated_patch_path ?? 'n/a'} mono />
                    <KeyValue label="import-report" value={selectedRun.artifacts.import_report_path ?? 'n/a'} mono />
                    <KeyValue label="readiness" value={selectedRun.artifacts.readiness_snapshot_path ?? 'n/a'} mono />
                    <KeyValue label="repair-patch" value={selectedRun.artifacts.repair_patch_path ?? 'n/a'} mono />
                    <KeyValue label="failure-log" value={selectedRun.artifacts.failure_log_path ?? 'n/a'} mono />
                  </>
                ) : (
                  <p className="text-muted-foreground">当前没有 kickoff run artifact。</p>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function KeyValue({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className={mono ? 'break-all font-mono text-[11px]' : 'break-all'}>{value}</span>
    </div>
  )
}

function readErrorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message
  return null
}
