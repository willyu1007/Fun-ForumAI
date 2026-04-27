/**
 * T-214 A-M4 — admin auto-patch inbox UI.
 *
 * Lists pending automated `CueChange` rows from the auto-editor, lets
 * admins inspect the proposed patch + reasoning + risk classification,
 * and exposes approve / reject actions backed by
 * `useApproveAutoPatch` / `useRejectAutoPatch`. MVP zero auto-apply: no
 * patch lands without a human approval click.
 *
 * Visual hierarchy:
 *   - left rail: list of pending patches sorted newest-first; risk band
 *     pill + trigger type badge per row
 *   - right pane: detail view with patch JSON, reasoning, and the
 *     approve / reject controls
 *   - approve emits a confirmation step in-line; reject requires a
 *     non-empty reason (server enforces 400 on missing reason)
 */

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  useAdminAutoPatchInbox,
  useAdminAutoPatchDetail,
  useApproveAutoPatch,
  useRejectAutoPatch,
} from '@/api/hooks'
import type { CueChangeDomain, CueRiskLevel } from '@/api/types'

const RISK_TONE: Record<CueRiskLevel, string> = {
  low: 'border-border/60 bg-muted/10 text-muted-foreground',
  standard: 'border-border bg-muted/30 text-foreground',
  high: 'border-destructive/40 bg-destructive/10 text-destructive',
  strict_review: 'border-destructive/60 bg-destructive/20 text-destructive',
}

const APPROVAL_STATUS_TONE: Record<string, string> = {
  pending: 'border-warning/40 bg-warning/10 text-warning',
  approved: 'border-success/40 bg-success/10 text-success',
  rejected: 'border-destructive/40 bg-destructive/10 text-destructive',
  auto_applied: 'border-success/40 bg-success/10 text-success',
  rolled_back: 'border-destructive/40 bg-destructive/10 text-destructive',
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso
  }
}

function PatchRow({
  item,
  selected,
  onSelect,
}: {
  item: CueChangeDomain
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={[
        'flex w-full flex-col gap-1 rounded-md border p-3 text-left transition-colors',
        selected
          ? 'border-primary/60 bg-primary/5'
          : 'border-border/60 hover:bg-muted/40',
      ].join(' ')}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>{item.change_type}</span>
        <Badge className={`border-transparent ${RISK_TONE[item.risk_level] ?? ''}`}>
          {item.risk_level}
        </Badge>
        <Badge className={`border-transparent ${APPROVAL_STATUS_TONE[item.approval_status] ?? ''}`}>
          {item.approval_status}
        </Badge>
      </div>
      <div className="text-xs text-muted-foreground">
        {item.trigger_type ?? 'no_trigger'} · {formatTime(item.created_at)}
      </div>
      {item.reason ? (
        <div className="line-clamp-2 text-xs text-foreground/80">{item.reason}</div>
      ) : null}
    </button>
  )
}

function PatchDetail({ change }: { change: CueChangeDomain }) {
  const [reason, setReason] = useState('')
  const approveMut = useApproveAutoPatch()
  const rejectMut = useRejectAutoPatch()

  const isPending = change.approval_status === 'pending'
  const inFlight = approveMut.isPending || rejectMut.isPending

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold">{change.change_type}</span>
        <Badge className={`border-transparent ${RISK_TONE[change.risk_level] ?? ''}`}>
          {change.risk_level}
        </Badge>
        <Badge className={`border-transparent ${APPROVAL_STATUS_TONE[change.approval_status] ?? ''}`}>
          {change.approval_status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          trigger: {change.trigger_type ?? '—'}
        </span>
      </div>

      <section>
        <h3 className="text-sm font-medium">Reasoning</h3>
        <p className="mt-1 text-sm text-foreground/80">
          {change.reason ?? '—'}
        </p>
      </section>

      <section>
        <h3 className="text-sm font-medium">Patch (CuePatchV1)</h3>
        <pre className="mt-1 max-h-96 overflow-auto rounded-md bg-muted/40 p-3 text-xs">
          {JSON.stringify(change.patch_json, null, 2)}
        </pre>
      </section>

      <section>
        <h3 className="text-sm font-medium">Validation + load snapshot</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">validation</div>
            <pre className="mt-1 rounded-md bg-muted/30 p-2 text-xs">
              {JSON.stringify(change.validation_json, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">load_snapshot</div>
            <pre className="mt-1 rounded-md bg-muted/30 p-2 text-xs">
              {JSON.stringify(change.load_snapshot_json, null, 2)}
            </pre>
          </div>
        </div>
      </section>

      {isPending ? (
        <section className="flex flex-col gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
          <h3 className="text-sm font-medium">Decision</h3>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional reason for approve, required for reject (1-500 chars)"
            className="min-h-20 w-full rounded-md border border-border/60 bg-background p-2 text-sm"
            maxLength={500}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={inFlight}
              onClick={() => {
                approveMut.mutate({
                  id: change.id,
                  ...(reason ? { reason } : {}),
                })
              }}
            >
              Approve
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={inFlight || reason.trim().length === 0}
              onClick={() => {
                rejectMut.mutate({ id: change.id, reason })
              }}
              title={reason.trim().length === 0 ? 'Reject requires a non-empty reason' : undefined}
            >
              Reject
            </Button>
            {approveMut.error || rejectMut.error ? (
              <span className="text-xs text-destructive">
                {(approveMut.error ?? rejectMut.error)?.message ?? 'request failed'}
              </span>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
          Already {change.approval_status}
          {change.applied_at ? ` at ${formatTime(change.applied_at)}` : null}
          {change.actor_user_id ? ` by ${change.actor_user_id}` : null}.
        </section>
      )}
    </div>
  )
}

export function AutoPatchInboxTab() {
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const listQuery = useAdminAutoPatchInbox({ approval_status: filter, limit: 50 })
  const detailQuery = useAdminAutoPatchDetail(selectedId)

  const items = useMemo(
    () => listQuery.data?.data?.items ?? [],
    [listQuery.data],
  )

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px),minmax(0,1fr)]">
      <aside className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Auto-patch inbox</span>
          <select
            className="rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter)
              setSelectedId(null)
            }}
          >
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
          </select>
          <span className="ml-auto text-xs text-muted-foreground">
            {listQuery.data?.data?.total ?? 0} total
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {listQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
              No {filter} auto-patches.
            </div>
          ) : (
            items.map((item) => (
              <PatchRow
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onSelect={() => setSelectedId(item.id)}
              />
            ))
          )}
        </div>
      </aside>

      <main className="rounded-md border border-border/60 p-4">
        {selectedId ? (
          detailQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading detail…</div>
          ) : detailQuery.data?.data?.change ? (
            <PatchDetail change={detailQuery.data.data.change} />
          ) : (
            <div className="text-sm text-muted-foreground">Patch not found.</div>
          )
        ) : (
          <div className="text-sm text-muted-foreground">
            Select an auto-patch from the list to review.
          </div>
        )}
      </main>
    </div>
  )
}
