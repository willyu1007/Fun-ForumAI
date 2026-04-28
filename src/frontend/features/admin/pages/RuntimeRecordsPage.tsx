import { useMemo, useState } from 'react'
import { StatusBadge as UiStatusBadge, type StatusTone } from '@fun-forum/ui-web/patterns'
import {
  useAdminRuntimeInfraSnapshot,
  useAdminRuntimeLlmConnectivity,
  useAdminRuntimeLlmConnectivityTest,
  useAdminRuntimeOperationRecord,
  useAdminRuntimeOperationRecords,
} from '@/api/hooks/admin'
import { useAuth } from '@/shared/hooks/use-auth'
import { adminRuntimeRecordsUiEnabled } from '@/shared/config/frontend-capabilities'
import type {
  InfraSnapshotData,
  InfraSnapshotSection,
  InfraSnapshotStatus,
  LlmConnectivityRow,
  LlmConnectivityTestResult,
  RuntimeOperationRecord,
  RuntimeOperationRecordListFilters,
  RuntimeOperationSeverity,
  RuntimeOperationSource,
  RuntimeOperationStatus,
} from '@/api/types'
import { Button } from '@/components/ui/button'

const SEVERITIES: RuntimeOperationSeverity[] = ['info', 'warn', 'error', 'critical']

const SOURCES: RuntimeOperationSource[] = [
  'runtime_loop',
  'event_queue',
  'agent_executor',
  'post_scheduler',
  'proactive_interaction',
  'llm_gateway',
  'media_worker',
  'guidance_worker',
  'db_diagnostic',
  'system',
]

const STATUSES: RuntimeOperationStatus[] = [
  'started',
  'succeeded',
  'failed',
  'retried',
  'dead_lettered',
  'skipped',
]

const SECTION_LABELS: Record<keyof InfraSnapshotData['sections'], string> = {
  process: 'Process',
  http: 'HTTP/API',
  postgres: 'Postgres',
  redisQueue: 'Redis / Queue',
  sse: 'SSE',
  llm: 'LLM',
  storageMedia: 'Storage / Media',
}

function statusToTone(status: InfraSnapshotStatus | RuntimeOperationSeverity | string): StatusTone {
  switch (status) {
    case 'critical':
    case 'error':
    case 'failed':
    case 'dead_lettered':
      return 'danger'
    case 'warn':
    case 'retried':
      return 'warning'
    case 'unknown':
    case 'skipped':
    case 'info':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function FilterBar({
  filters,
  onChange,
}: {
  filters: RuntimeOperationRecordListFilters
  onChange: (next: RuntimeOperationRecordListFilters) => void
}) {
  return (
    <div data-ui="card" data-padding="md" className="flex flex-wrap gap-3 items-end border rounded">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Severity</label>
        <select
          multiple
          value={filters.severity ?? []}
          onChange={(e) =>
            onChange({
              ...filters,
              severity: Array.from(e.target.selectedOptions).map(
                (o) => o.value as RuntimeOperationSeverity,
              ),
            })
          }
          className="border rounded px-2 py-1 text-sm h-24 min-w-[120px]"
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Source</label>
        <select
          multiple
          value={filters.source ?? []}
          onChange={(e) =>
            onChange({
              ...filters,
              source: Array.from(e.target.selectedOptions).map(
                (o) => o.value as RuntimeOperationSource,
              ),
            })
          }
          className="border rounded px-2 py-1 text-sm h-24 min-w-[160px]"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Status</label>
        <select
          multiple
          value={filters.status ?? []}
          onChange={(e) =>
            onChange({
              ...filters,
              status: Array.from(e.target.selectedOptions).map(
                (o) => o.value as RuntimeOperationStatus,
              ),
            })
          }
          className="border rounded px-2 py-1 text-sm h-24 min-w-[140px]"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Trace ID</label>
        <input
          type="text"
          value={filters.trace_id ?? ''}
          onChange={(e) => onChange({ ...filters, trace_id: e.target.value || undefined })}
          className="border rounded px-2 py-1 text-sm w-48"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Agent ID</label>
        <input
          type="text"
          value={filters.agent_id ?? ''}
          onChange={(e) => onChange({ ...filters, agent_id: e.target.value || undefined })}
          className="border rounded px-2 py-1 text-sm w-48"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Since</label>
        <input
          type="datetime-local"
          value={filters.since ?? ''}
          onChange={(e) => onChange({ ...filters, since: e.target.value || undefined })}
          className="border rounded px-2 py-1 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Until</label>
        <input
          type="datetime-local"
          value={filters.until ?? ''}
          onChange={(e) => onChange({ ...filters, until: e.target.value || undefined })}
          className="border rounded px-2 py-1 text-sm"
        />
      </div>
      <Button variant="ghost" size="sm" onClick={() => onChange({ limit: filters.limit ?? 50 })}>
        清除
      </Button>
    </div>
  )
}

function InfraSnapshotPanel({ data, isError }: { data: InfraSnapshotData | null; isError: boolean }) {
  if (isError) {
    return (
      <div className="border rounded p-4 text-sm text-muted-foreground">
        Failed to load infra snapshot.
      </div>
    )
  }
  if (!data) {
    return (
      <div className="border rounded p-4 text-sm text-muted-foreground">Loading infra snapshot…</div>
    )
  }
  const sections = Object.entries(data.sections) as Array<
    [keyof InfraSnapshotData['sections'], InfraSnapshotSection]
  >
  return (
    <div className="border rounded">
      <div className="flex items-center justify-between p-3 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Overall</span>
          <UiStatusBadge tone={statusToTone(data.overall_status)}>
            {data.overall_status}
          </UiStatusBadge>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDateTime(data.generated_at)} · poll {Math.round(data.poll_interval_ms / 1000)}s
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 p-3">
        {sections.map(([key, section]) => (
          <div key={key} className="border rounded p-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{SECTION_LABELS[key]}</span>
              <UiStatusBadge tone={statusToTone(section.status)}>
                {section.status}
              </UiStatusBadge>
            </div>
            {section.summary && (
              <p className="text-xs text-muted-foreground mt-1">{section.summary}</p>
            )}
            {typeof section.latency_ms === 'number' && (
              <p className="text-xs text-muted-foreground">latency {section.latency_ms} ms</p>
            )}
            {section.error_message_redacted && (
              <p className="text-xs text-destructive mt-1">{section.error_message_redacted}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function LlmConnectivityPanel({
  rows,
  testResults,
  onTest,
  onTestAll,
  isPending,
}: {
  rows: LlmConnectivityRow[]
  testResults: Map<string, LlmConnectivityTestResult>
  onTest: (route: LlmConnectivityRow) => void
  onTestAll: () => void
  isPending: boolean
}) {
  return (
    <div className="border rounded">
      <div className="flex items-center justify-between p-3 border-b bg-muted/40">
        <span className="font-medium">LLM 连通性</span>
        <Button size="sm" variant="outline" disabled={isPending || rows.length === 0} onClick={onTestAll}>
          测试全部
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">暂无 admitted 路由。</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-2 py-1">Profile</th>
                <th className="text-left px-2 py-1">Provider</th>
                <th className="text-left px-2 py-1">Model</th>
                <th className="text-left px-2 py-1">Voice line</th>
                <th className="text-left px-2 py-1">Credential pool</th>
                <th className="text-left px-2 py-1">Last test</th>
                <th className="text-left px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const result = testResults.get(row.route_id)
                return (
                  <tr key={row.route_id} className="border-t">
                    <td className="px-2 py-1 font-mono text-xs">{row.profile_id}</td>
                    <td className="px-2 py-1">{row.provider_id}</td>
                    <td className="px-2 py-1">
                      <div className="font-mono text-xs">{row.model_id}</div>
                      {row.model_version && (
                        <div className="text-xs text-muted-foreground">{row.model_version}</div>
                      )}
                    </td>
                    <td className="px-2 py-1 text-xs">{row.voice_line_id}</td>
                    <td className="px-2 py-1 text-xs">{row.credential_pool_id ?? '—'}</td>
                    <td className="px-2 py-1 text-xs">
                      {result ? (
                        <div>
                          <UiStatusBadge tone={statusToTone(result.status)}>
                            {result.status}
                          </UiStatusBadge>
                          <div className="text-muted-foreground mt-1">
                            {result.latency_ms !== null && <span>{result.latency_ms}ms · </span>}
                            {formatDateTime(result.tested_at)}
                          </div>
                          {result.error_message_redacted && (
                            <div className="text-destructive">{result.error_message_redacted}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1">
                      <Button size="sm" variant="ghost" disabled={isPending} onClick={() => onTest(row)}>
                        测试
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RecordsTable({
  records,
  onSelect,
  selectedId,
}: {
  records: RuntimeOperationRecord[]
  onSelect: (id: string) => void
  selectedId: string | null
}) {
  return (
    <div className="overflow-x-auto border rounded">
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="text-left px-2 py-1">时间</th>
            <th className="text-left px-2 py-1">Severity</th>
            <th className="text-left px-2 py-1">Source</th>
            <th className="text-left px-2 py-1">Operation</th>
            <th className="text-left px-2 py-1">Status</th>
            <th className="text-left px-2 py-1">Trace</th>
            <th className="text-left px-2 py-1">Agent / Event</th>
            <th className="text-left px-2 py-1">Error</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">
                没有匹配的运行记录。
              </td>
            </tr>
          ) : (
            records.map((rec) => (
              <tr
                key={rec.id}
                className={`border-t cursor-pointer hover:bg-muted/30 ${
                  selectedId === rec.id ? 'bg-muted/40' : ''
                }`}
                onClick={() => onSelect(rec.id)}
              >
                <td className="px-2 py-1 text-xs">{formatDateTime(rec.occurred_at)}</td>
                <td className="px-2 py-1">
                  <UiStatusBadge tone={statusToTone(rec.severity)}>
                    {rec.severity}
                  </UiStatusBadge>
                </td>
                <td className="px-2 py-1 text-xs">{rec.source}</td>
                <td className="px-2 py-1 text-xs">{rec.operation}</td>
                <td className="px-2 py-1">
                  <UiStatusBadge tone={statusToTone(rec.status)}>
                    {rec.status}
                  </UiStatusBadge>
                </td>
                <td className="px-2 py-1 font-mono text-xs">{rec.trace_id ?? '—'}</td>
                <td className="px-2 py-1 text-xs">
                  <div>{rec.agent_id ?? '—'}</div>
                  <div className="text-muted-foreground">{rec.event_id ?? '—'}</div>
                </td>
                <td className="px-2 py-1 text-xs text-destructive truncate max-w-[200px]">
                  {rec.error_message_redacted ?? '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function RecordDetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useAdminRuntimeOperationRecord(id, { enabled: id !== null })
  if (!id) return null
  return (
    <div className="border rounded p-3 bg-muted/20">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">运行记录详情</span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          关闭
        </Button>
      </div>
      {detail.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : detail.isError || !detail.data?.data ? (
        <p className="text-sm text-destructive">无法加载记录详情。</p>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="font-mono text-xs">{detail.data.data.record.id}</div>
          <pre className="bg-background border rounded p-2 text-xs overflow-x-auto">
            {JSON.stringify(detail.data.data.record, null, 2)}
          </pre>
          {Object.keys(detail.data.data.references).length > 0 && (
            <div>
              <div className="text-xs font-medium mb-1">References</div>
              <pre className="bg-background border rounded p-2 text-xs">
                {JSON.stringify(detail.data.data.references, null, 2)}
              </pre>
            </div>
          )}
          {detail.data.data.payload_summary && (
            <div>
              <div className="text-xs font-medium mb-1">Payload (redacted)</div>
              <pre className="bg-background border rounded p-2 text-xs overflow-x-auto">
                {JSON.stringify(detail.data.data.payload_summary.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function RuntimeRecordsPage() {
  const { currentIdentity } = useAuth()
  const [filters, setFilters] = useState<RuntimeOperationRecordListFilters>({ limit: 50 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [llmTestResults, setLlmTestResults] = useState<Map<string, LlmConnectivityTestResult>>(
    () => new Map(),
  )

  const isAdmin = currentIdentity === 'admin'
  const flagOn = adminRuntimeRecordsUiEnabled

  const recordsQuery = useAdminRuntimeOperationRecords(filters, { enabled: isAdmin && flagOn })
  const infraQuery = useAdminRuntimeInfraSnapshot({ enabled: isAdmin && flagOn })
  const llmQuery = useAdminRuntimeLlmConnectivity({ enabled: isAdmin && flagOn })
  const llmTest = useAdminRuntimeLlmConnectivityTest()

  const records = recordsQuery.data?.data?.records ?? []
  const writeEnabled = recordsQuery.data?.data?.write_enabled ?? false
  const llmRows = llmQuery.data?.data?.rows ?? []
  const isAnyTestPending = llmTest.isPending

  const writeFlagBadge = useMemo(() => {
    if (writeEnabled) {
      return <UiStatusBadge>write_enabled=true</UiStatusBadge>
    }
    return <UiStatusBadge tone="warning">write_enabled=false</UiStatusBadge>
  }, [writeEnabled])

  if (!isAdmin) {
    return (
      <div data-ui="stack" data-direction="col" data-gap="4">
        <h1 className="text-2xl font-semibold">运行记录</h1>
        <p className="text-muted-foreground">请先以管理员身份登录。</p>
      </div>
    )
  }

  if (!flagOn) {
    return (
      <div data-ui="stack" data-direction="col" data-gap="4">
        <h1 className="text-2xl font-semibold">运行记录</h1>
        <p className="text-muted-foreground">
          运行记录控制台功能未启用。请设置 <code>VITE_FF_ADMIN_RUNTIME_RECORDS_UI=true</code>{' '}
          后重新构建前端。
        </p>
      </div>
    )
  }

  const handleTest = async (route: LlmConnectivityRow) => {
    const result = await llmTest.mutateAsync({ route_ids: [route.route_id] })
    const next = new Map(llmTestResults)
    for (const r of result.data?.results ?? []) {
      next.set(r.route_id, r)
    }
    setLlmTestResults(next)
  }

  const handleTestAll = async () => {
    const result = await llmTest.mutateAsync({ scope: 'all_admitted' })
    const next = new Map(llmTestResults)
    for (const r of result.data?.results ?? []) {
      next.set(r.route_id, r)
    }
    setLlmTestResults(next)
  }

  return (
    <div data-ui="stack" data-direction="col" data-gap="5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">运行记录</h1>
        <div className="flex items-center gap-2 text-xs">
          {writeFlagBadge}
          {recordsQuery.data?.data?.retention_policy && (
            <span className="text-muted-foreground">
              保留 {recordsQuery.data.data.retention_policy.error_critical_days}/
              {recordsQuery.data.data.retention_policy.warn_days}/
              {recordsQuery.data.data.retention_policy.info_days}d
            </span>
          )}
        </div>
      </div>

      <InfraSnapshotPanel
        data={infraQuery.data?.data ?? null}
        isError={infraQuery.isError}
      />

      <LlmConnectivityPanel
        rows={llmRows}
        testResults={llmTestResults}
        onTest={handleTest}
        onTestAll={handleTestAll}
        isPending={isAnyTestPending}
      />

      <FilterBar filters={filters} onChange={setFilters} />

      {!writeEnabled && (
        <div className="text-xs text-muted-foreground border rounded p-2">
          后端写 flag <code>FF_RUNTIME_OPERATION_RECORDS_WRITE</code>{' '}
          当前关闭，列表中不会出现新记录。
        </div>
      )}

      {recordsQuery.isError ? (
        <div className="border rounded p-4 text-sm text-destructive">
          加载运行记录失败。
        </div>
      ) : (
        <RecordsTable records={records} onSelect={setSelectedId} selectedId={selectedId} />
      )}

      <RecordDetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}
