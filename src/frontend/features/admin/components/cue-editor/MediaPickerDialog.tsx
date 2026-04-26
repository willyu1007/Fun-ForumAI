/**
 * T-210 M2 — media picker dialog.
 *
 * Read-only listing of pickable media assets. Server-side filter is the SSOT;
 * UI mirrors but does not relax. Admin selects one asset + role + usage_strength
 * + use_policy; the parent component then calls useAdminCueAttachMedia.
 *
 * Per umbrella D-11, MVP only exposes:
 *   usage_strength ∈ {optional, preferred}
 *   use_policy ∈ {runtime_only, prefer_runtime_context, prefer_public_display, allow_generated_derivative}
 * `anchor` / `selected_only_pool` / `require_public_display` are deferred to T-216 M3.
 */

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { useAdminMediaPicker } from '@/api/hooks/admin'
import type { CueMediaItem, MediaPickerItem } from '@/api/types'

const ROLE_OPTIONS: Array<CueMediaItem['role']> = [
  'context_anchor',
  'mood_reference',
  'evidence_card',
  'visual_seed',
  'cover_candidate',
  'continuity_anchor',
]

const USAGE_OPTIONS = ['optional', 'preferred'] as const
const POLICY_OPTIONS = [
  'runtime_only',
  'prefer_runtime_context',
  'prefer_public_display',
  'allow_generated_derivative',
] as const

export interface AttachMediaSelection {
  asset_id: string
  role: CueMediaItem['role']
  usage_strength: (typeof USAGE_OPTIONS)[number]
  use_policy: (typeof POLICY_OPTIONS)[number]
  selection_note: string | null
}

export function MediaPickerDialog({
  open,
  communityId,
  onClose,
  onSelect,
}: {
  open: boolean
  communityId?: string
  onClose: () => void
  onSelect: (selection: AttachMediaSelection) => void
}) {
  const query = useAdminMediaPicker({ community_id: communityId, enabled: open, limit: 50 })
  const [selectedAsset, setSelectedAsset] = useState<MediaPickerItem | null>(null)
  const [role, setRole] = useState<CueMediaItem['role']>('context_anchor')
  const [usageStrength, setUsageStrength] =
    useState<(typeof USAGE_OPTIONS)[number]>('optional')
  const [usePolicy, setUsePolicy] =
    useState<(typeof POLICY_OPTIONS)[number]>('runtime_only')
  const [note, setNote] = useState('')

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
    >
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-lg">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">选择媒体资源</h3>
          <button
            type="button"
            className="rounded-md border border-border bg-muted/30 px-2 py-1 text-xs hover:bg-muted/50"
            onClick={onClose}
          >
            关闭
          </button>
        </header>

        <div className="flex-1 overflow-auto rounded border border-border/60 bg-muted/10 p-2">
          {query.isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">加载中…</p>
          ) : query.error ? (
            <p className="p-3 text-sm text-destructive">
              加载失败：{(query.error as Error).message}
            </p>
          ) : !query.data || query.data.data.items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">没有符合条件的媒体资源。</p>
          ) : (
            <ul className="space-y-1">
              {query.data.data.items.map((item) => {
                const selected = selectedAsset?.asset_id === item.asset_id
                return (
                  <li
                    key={item.asset_id}
                    className={
                      'cursor-pointer border-l-2 px-3 py-2 text-xs ' +
                      (selected
                        ? 'border-primary bg-primary/10'
                        : 'border-border/40 hover:bg-muted/20')
                    }
                    onClick={() => setSelectedAsset(item)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono">{item.asset_id}</span>
                      <Badge variant="outline">{item.mime_type}</Badge>
                      <Badge variant="outline">{item.source_kind}</Badge>
                      <Badge variant="outline">{item.visibility_policy}</Badge>
                      {item.width && item.height ? (
                        <span className="text-muted-foreground">
                          {item.width}×{item.height}
                        </span>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="role">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as CueMediaItem['role'])}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="usage_strength (optional / preferred)">
            <select
              value={usageStrength}
              onChange={(e) => setUsageStrength(e.target.value as (typeof USAGE_OPTIONS)[number])}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            >
              {USAGE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="use_policy">
            <select
              value={usePolicy}
              onChange={(e) => setUsePolicy(e.target.value as (typeof POLICY_OPTIONS)[number])}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            >
              {POLICY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="selection_note (可选)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="备注"
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
          </Field>
        </div>

        <footer className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-border bg-muted/30 px-3 py-1 text-xs hover:bg-muted/50"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
            disabled={!selectedAsset}
            onClick={() => {
              if (!selectedAsset) return
              onSelect({
                asset_id: selectedAsset.asset_id,
                role,
                usage_strength: usageStrength,
                use_policy: usePolicy,
                selection_note: note.trim() || null,
              })
            }}
          >
            添加到 cue
          </button>
        </footer>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-xs">
      <span className="font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
