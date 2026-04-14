import { useEffect, useState } from 'react'
import { AlertCircle, Check, ChevronDown, ChevronRight, Copy, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  useDevKickoffLatestRun,
  useDevKickoffRecentRuns,
  useDevKickoffRun,
  useDevKickoffStatus,
} from '@/api/hooks/dev'

interface DevKickoffPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DevKickoffPanel({ open, onOpenChange }: DevKickoffPanelProps) {
  const statusQuery = useDevKickoffStatus(open)
  const latestRunQuery = useDevKickoffLatestRun(open)
  const recentRunsQuery = useDevKickoffRecentRuns(open)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [artifactsExpanded, setArtifactsExpanded] = useState(false)

  useEffect(() => {
    if (!open) return
    const nextRunId = latestRunQuery.data?.data.summary.run_id ?? null
    if (nextRunId) {
      setSelectedRunId(nextRunId)
    }
  }, [latestRunQuery.data?.data.summary.run_id, open])

  const runQuery = useDevKickoffRun(selectedRunId, open)

  const currentMode = statusQuery.data?.data.current_data_mode ?? 'unknown'
  const modeSource = statusQuery.data?.data.mode_source ?? null
  const currentSuite = statusQuery.data?.data.current_suite ?? null
  const hasSuite = Boolean(currentSuite?.id)
  const readiness = statusQuery.data?.data.latest_runtime_readiness ?? null
  const latestImportReport = statusQuery.data?.data.latest_import_report ?? null
  const latestRun = latestRunQuery.data?.data ?? null
  const selectedRun = runQuery.data?.data ?? latestRun
  const failureMessage =
    typeof selectedRun?.failure_log?.message === 'string' ? selectedRun.failure_log.message : null
  const recentRuns = recentRunsQuery.data?.data ?? []

  const activationOk = readiness?.activation_readiness.ok ?? false
  const kickoffOk = readiness?.layer_readiness.kickoff_layer_ready ?? false
  const warmupOk = readiness?.layer_readiness.warmup_layer_ready ?? false
  const allReady = activationOk && kickoffOk && warmupOk

  const handleRefresh = () => {
    void statusQuery.refetch()
    void latestRunQuery.refetch()
    void recentRunsQuery.refetch()
    if (selectedRunId) {
      void runQuery.refetch()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton={false} className="w-full p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-sm">Kickoff 调控台</SheetTitle>
            <SheetDescription className="sr-only">Kickoff 运行状态与导入摘要</SheetDescription>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                {currentMode}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleRefresh}
                aria-label="刷新 kickoff 调试状态"
              >
                <RefreshCw className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3" data-testid="readiness-lights">
            <ReadinessLight label="activation" ok={activationOk} />
            <ReadinessLight label="kickoff" ok={kickoffOk} />
            <ReadinessLight label="warmup" ok={warmupOk} />
            {allReady && (
              <span className="ml-auto text-[11px] text-muted-foreground">全部就绪</span>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-6.5rem)]">
          <div className="divide-y divide-border/50">
            {(statusQuery.error || latestRunQuery.error || runQuery.error) && (
              <div className="flex items-start gap-3 bg-destructive/5 px-4 py-3 text-xs">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground">数据读取失败</p>
                  <p className="text-muted-foreground">
                    {readErrorMessage(statusQuery.error) ??
                      readErrorMessage(latestRunQuery.error) ??
                      readErrorMessage(runQuery.error)}
                  </p>
                </div>
              </div>
            )}

            {/* ── 系统状态 ── */}
            <section className="space-y-3 px-4 py-4">
              <SectionTitle>系统状态</SectionTitle>

              <div className="space-y-1.5 text-xs">
                <Row label="模式" value={currentMode} note={modeSource ? `(${modeSource})` : undefined} />

                {hasSuite ? (
                  <>
                    <Row label="Suite" value={currentSuite!.label ?? currentSuite!.id ?? ''} />
                    {currentSuite!.kickoff_batch_id && (
                      <Row label="Kickoff batch" value={currentSuite!.kickoff_batch_id} mono />
                    )}
                    {currentSuite!.warmup_batch_id && (
                      <Row label="Warmup batch" value={currentSuite!.warmup_batch_id} mono />
                    )}
                    {currentSuite!.active_baseline_id && (
                      <Row label="Baseline" value={currentSuite!.active_baseline_id} mono />
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">未关联 Suite</p>
                )}
              </div>

              {readiness && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>warnings <strong className="text-foreground">{readiness.quality_state.warning_count}</strong></span>
                  <span>media <strong className="text-foreground">{readiness.quality_state.summary.media_coverage_ratio}</strong></span>
                  <span>growth <strong className={readiness.admission.allow_public_growth ? 'text-foreground' : 'text-destructive'}>{String(readiness.admission.allow_public_growth)}</strong></span>
                </div>
              )}

              {readiness?.activation_readiness.reasons.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {readiness.activation_readiness.reasons.map((reason) => (
                    <Badge key={reason} variant="outline" className="text-[10px]">
                      {reason}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </section>

            {/* ── 最近导入 ── */}
            <section className="space-y-3 px-4 py-4">
              <SectionTitle>
                最近导入
                {latestImportReport && (
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    {latestImportReport.report_meta.dry_run ? 'dry-run' : 'apply'}
                  </Badge>
                )}
              </SectionTitle>

              {latestImportReport ? (
                <div className="space-y-2 text-xs">
                  <Row label="Run" value={shortId(latestImportReport.report_meta.run_id)} mono />
                  {latestImportReport.report_meta.patch_id && (
                    <Row label="Patch" value={shortId(latestImportReport.report_meta.patch_id)} mono />
                  )}
                  {latestImportReport.failure_phase && (
                    <Row label="失败阶段" value={latestImportReport.failure_phase} />
                  )}

                  <p className="text-muted-foreground">
                    posts <strong className="text-foreground">{latestImportReport.summary_after_import.posts}</strong>
                    {' · '}threads <strong className="text-foreground">{latestImportReport.summary_after_import.threads}</strong>
                    {' · '}turns <strong className="text-foreground">{latestImportReport.summary_after_import.turns}</strong>
                    {' · '}media <strong className="text-foreground">{latestImportReport.summary_after_import.media}</strong>
                  </p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                    <span>ops: {latestImportReport.op_results?.length ?? 0}</span>
                    <span>refs: {latestImportReport.resolution_map?.length ?? 0}</span>
                  </div>

                  {latestImportReport.recommended_next_actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {latestImportReport.recommended_next_actions.map((action) => (
                        <Badge key={action} variant="secondary" className="text-[10px]">
                          {action}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">暂无导入记录</p>
              )}
            </section>

            {/* ── 运行详情 ── */}
            <section className="space-y-3 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle>运行详情</SectionTitle>
                {recentRuns.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {selectedRunId ? shortId(selectedRunId) : '选择 Run'}
                        <ChevronDown className="size-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-64 w-72 overflow-y-auto">
                      {recentRuns.map((run) => (
                        <DropdownMenuItem
                          key={run.run_id}
                          onClick={() => setSelectedRunId(run.run_id)}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
                            {shortId(run.run_id)}
                          </span>
                          <span className="shrink-0 text-muted-foreground">{run.run_type}</span>
                          {run.failed_phase && (
                            <span className="shrink-0 text-destructive">failed</span>
                          )}
                          {selectedRunId === run.run_id && (
                            <Check className="ml-auto size-3 shrink-0 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {selectedRun ? (
                <div className="space-y-2 text-xs">
                  <Row label="Run" value={shortId(selectedRun.summary.run_id)} mono />
                  <Row label="类型" value={selectedRun.summary.run_type} />
                  {selectedRun.summary.profile_id && (
                    <Row label="Profile" value={selectedRun.summary.profile_id} mono />
                  )}
                  {selectedRun.summary.patch_id && (
                    <Row label="Patch" value={shortId(selectedRun.summary.patch_id)} mono />
                  )}
                  {selectedRun.summary.failed_phase && (
                    <Row label="失败阶段" value={selectedRun.summary.failed_phase} />
                  )}
                  {failureMessage && (
                    <div className="rounded-md bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      {failureMessage}
                    </div>
                  )}

                  {/* artifact paths - collapsible */}
                  <button
                    type="button"
                    className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setArtifactsExpanded((v) => !v)}
                  >
                    <ChevronRight className={cn('size-3 transition-transform', artifactsExpanded && 'rotate-90')} />
                    Artifact 路径
                  </button>

                  {artifactsExpanded && (
                    <div className="space-y-1.5 pl-4">
                      <ArtifactRow label="dir" value={selectedRun.summary.artifact_dir} hint="产物根目录" />
                      <ArtifactRow label="context-pack" value={selectedRun.artifacts.context_pack_path} hint="上下文快照" />
                      <ArtifactRow label="patch" value={selectedRun.artifacts.generated_patch_path} hint="生成的内容补丁" />
                      <ArtifactRow label="import" value={selectedRun.artifacts.import_report_path} hint="导入结果报告" />
                      <ArtifactRow label="readiness" value={selectedRun.artifacts.readiness_snapshot_path} hint="就绪状态快照" />
                      <ArtifactRow label="repair" value={selectedRun.artifacts.repair_patch_path} hint="修复补丁" />
                      <ArtifactRow label="failure" value={selectedRun.artifacts.failure_log_path} hint="失败日志" />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">暂无运行记录</p>
              )}
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

/* ── Primitives ── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-foreground">{children}</h3>
}

function ReadinessLight({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]">
      <span
        className={cn(
          'inline-block size-2 rounded-full',
          ok ? 'bg-emerald-500' : 'bg-destructive',
        )}
      />
      <span className={ok ? 'text-muted-foreground' : 'text-foreground'}>{label}</span>
    </span>
  )
}

function Row({
  label,
  value,
  mono = false,
  note,
}: {
  label: string
  value: string
  mono?: boolean
  note?: string
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('min-w-0 break-all', mono && 'font-mono text-[11px]')}>
        {value}
      </span>
      {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
    </div>
  )
}

function ArtifactRow({
  label,
  value,
  hint,
}: {
  label: string
  value: string | null | undefined
  hint?: string
}) {
  const canCopy = Boolean(value)
  const display = value ? toRelativePath(value) : 'n/a'

  const handleCopy = () => {
    if (value) {
      void navigator.clipboard.writeText(value)
    }
  }

  return (
    <div className="group flex items-baseline gap-2 text-[11px]">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span className="min-w-0 truncate font-mono text-muted-foreground">{display}</span>
        {canCopy && (
          <button
            type="button"
            className="shrink-0 text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            onClick={handleCopy}
            aria-label={`复制 ${label} 路径`}
          >
            <Copy className="size-3" />
          </button>
        )}
      </div>
      {hint && <span className="shrink-0 text-[10px] text-muted-foreground/60">{hint}</span>}
    </div>
  )
}

function shortId(id: string): string {
  if (id.length <= 24) return id
  return `${id.slice(0, 20)}…${id.slice(-6)}`
}

function toRelativePath(absolutePath: string): string {
  const cwd = typeof window !== 'undefined'
    ? (window as unknown as Record<string, unknown>).__CWD__ as string | undefined
    : undefined
  if (cwd && absolutePath.startsWith(cwd)) {
    const rel = absolutePath.slice(cwd.length)
    return rel.startsWith('/') ? rel.slice(1) : rel
  }
  const marker = '/.ai/'
  const idx = absolutePath.indexOf(marker)
  if (idx !== -1) {
    return absolutePath.slice(idx + 1)
  }
  return absolutePath
}

function readErrorMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message
  return null
}
