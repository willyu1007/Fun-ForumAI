/**
 * T-210 M2 — Cue Detail Editor.
 *
 * Six sections per cue-editor-admin/00-overview.md §2:
 *   Basic — community / scope, trigger time, timezone, lane, priority, risk level
 *   Theme — topic seed, discussion question, angle hint, tone band
 *   Scene — privacy / safety policies (deep nested editing punted to follow-up)
 *   Role  — role requirements vector (read-only in MVP; deep editor follow-up)
 *   Media — picker + attached items list
 *   Runtime — locked_fields editor + read-only dispatch_policy
 *
 * Patch construction: form state diffed against original cue → minimal CuePatchV1.
 *
 * Forbidden inputs (umbrella §3): not rendered. UI is the first defense; schema
 * + server are backstops.
 *
 * Deferred to follow-ups (kept read-only / minimal in MVP):
 *   - Full nested editing of scene_constraints (allowed_scene_families multi-select etc.)
 *   - Full nested editing of role_requirements vector
 *   - Editing dispatch_policy / admission_policy / load_policy
 * These are visible (read-only JSON) but not directly editable in MVP.
 */

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { LockedFieldsEditor } from './LockedFieldsEditor'
import { MediaPickerDialog, type AttachMediaSelection } from './MediaPickerDialog'
import { PatchDiffPanel } from './PatchDiffPanel'
import { PreviewPanel } from './PreviewPanel'
import {
  useAdminCueAttachMedia,
  useAdminCueAudit,
  useAdminCueCancel,
  useAdminCueDetail,
  useAdminCueForceSkip,
  useAdminCuePreview,
  useAdminCuePublish,
  useAdminCueRemoveMedia,
  useAdminCueUpdate,
} from '@/api/hooks/admin'
import type { CueLane, CuePatchV1, CueRiskLevel, CueToneBand, PublicDiscussionCueDomain } from '@/api/types'

const TONE_OPTIONS: CueToneBand[] = [
  'calm',
  'warm',
  'tense_but_playful',
  'sharp',
  'reflective',
  'story_like',
]
const LANE_OPTIONS: CueLane[] = ['prime', 'standard', 'background']
const RISK_OPTIONS: CueRiskLevel[] = ['low', 'standard', 'high', 'strict_review']

interface FormState {
  trigger_at: string // datetime-local format
  timezone: string
  lane: CueLane
  priority: number
  risk_level: CueRiskLevel
  topic_seed: string
  discussion_question: string
  angle_hint: string
  tone_band: CueToneBand | ''
  locked_fields: string[]
}

function fromCue(cue: PublicDiscussionCueDomain): FormState {
  return {
    trigger_at: toDatetimeLocal(cue.trigger_at),
    timezone: cue.timezone,
    lane: cue.lane,
    priority: cue.priority,
    risk_level: cue.risk_level,
    topic_seed: cue.theme_intent.topic_seed,
    discussion_question: cue.theme_intent.discussion_question ?? '',
    angle_hint: cue.theme_intent.angle_hint ?? '',
    tone_band: (cue.theme_intent.tone_band as CueToneBand | undefined) ?? '',
    locked_fields: cue.locked_fields,
  }
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(local: string): string {
  return new Date(local).toISOString()
}

function buildPatch(original: PublicDiscussionCueDomain, form: FormState): CuePatchV1 | null {
  const partial: CuePatchV1['partial'] = {}

  const newTriggerAt = fromDatetimeLocal(form.trigger_at)
  if (newTriggerAt !== original.trigger_at) {
    partial.trigger_at = newTriggerAt
  }
  if (form.timezone !== original.timezone) partial.timezone = form.timezone
  if (form.lane !== original.lane) partial.lane = form.lane
  if (form.priority !== original.priority) partial.priority = form.priority
  if (form.risk_level !== original.risk_level) partial.risk_level = form.risk_level

  const themeChanged =
    form.topic_seed !== original.theme_intent.topic_seed ||
    form.discussion_question !== (original.theme_intent.discussion_question ?? '') ||
    form.angle_hint !== (original.theme_intent.angle_hint ?? '') ||
    (form.tone_band || undefined) !== (original.theme_intent.tone_band ?? undefined)

  if (themeChanged) {
    partial.theme_intent = {
      ...original.theme_intent,
      topic_seed: form.topic_seed,
      ...(form.discussion_question
        ? { discussion_question: form.discussion_question }
        : { discussion_question: undefined }),
      ...(form.angle_hint ? { angle_hint: form.angle_hint } : { angle_hint: undefined }),
      ...(form.tone_band ? { tone_band: form.tone_band } : { tone_band: undefined }),
    }
  }

  const lockedChanged =
    form.locked_fields.length !== original.locked_fields.length ||
    form.locked_fields.some((p, i) => p !== original.locked_fields[i])
  if (lockedChanged) partial.locked_fields = form.locked_fields

  if (Object.keys(partial).length === 0) return null
  return { version: 1, partial }
}

export function CueDetailEditor({ cueId, onClose }: { cueId: string; onClose: () => void }) {
  const detail = useAdminCueDetail(cueId)
  const updateMutation = useAdminCueUpdate()
  const cancelMutation = useAdminCueCancel()
  const skipMutation = useAdminCueForceSkip()
  const publishMutation = useAdminCuePublish()
  const attachMediaMutation = useAdminCueAttachMedia()
  const removeMediaMutation = useAdminCueRemoveMedia()
  const previewMutation = useAdminCuePreview()
  const auditQuery = useAdminCueAudit({ cue_id: cueId, limit: 20 })

  const [form, setForm] = useState<FormState | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (detail.data?.data.cue) {
      setForm(fromCue(detail.data.data.cue))
    }
  }, [detail.data])

  const original = detail.data?.data.cue
  const patch = useMemo(() => {
    if (!original || !form) return null
    return buildPatch(original, form)
  }, [original, form])

  if (detail.isLoading || !form || !original) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
        正在加载 cue 详情…
      </div>
    )
  }
  if (detail.error) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-destructive">
        加载失败：{(detail.error as Error).message}
      </div>
    )
  }

  const isReadOnly = !['draft', 'validating', 'validated', 'scheduled', 'deferred'].includes(
    original.status,
  )

  const onSave = async () => {
    if (!patch) return
    setError(null)
    try {
      await updateMutation.mutateAsync({ cueId, patch })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const onPublish = async () => {
    setError(null)
    try {
      await publishMutation.mutateAsync(cueId)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const onCancel = async () => {
    if (!confirm('确定取消此 cue？')) return
    setError(null)
    try {
      await cancelMutation.mutateAsync({ cueId, reason: 'admin_cancel' })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const onForceSkip = async () => {
    if (!confirm('强制跳过此 cue？')) return
    setError(null)
    try {
      await skipMutation.mutateAsync({ cueId, reason: 'force_skip' })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const onAttachMedia = async (selection: AttachMediaSelection) => {
    setPickerOpen(false)
    setError(null)
    try {
      await attachMediaMutation.mutateAsync({ cueId, ...selection })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const onRunPreview = async () => {
    if (!patch) return
    setError(null)
    try {
      await previewMutation.mutateAsync({ cueId, patch })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const onRemoveMedia = async (mediaId: string) => {
    if (!confirm('移除该媒体？')) return
    setError(null)
    try {
      await removeMediaMutation.mutateAsync({ cueId, mediaId })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <Header
        cue={original}
        readOnly={isReadOnly}
        dirty={Boolean(patch)}
        saving={updateMutation.isPending}
        publishing={publishMutation.isPending}
        cancelling={cancelMutation.isPending}
        skipping={skipMutation.isPending}
        onSave={onSave}
        onPublish={onPublish}
        onCancel={onCancel}
        onForceSkip={onForceSkip}
        onClose={onClose}
      />

      {error ? (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <Section title="Basic">
        <Grid>
          <Field label="trigger_at">
            <input
              type="datetime-local"
              value={form.trigger_at}
              disabled={isReadOnly}
              onChange={(e) => setForm({ ...form, trigger_at: e.target.value })}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
          </Field>
          <Field label="timezone">
            <input
              type="text"
              value={form.timezone}
              disabled={isReadOnly}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
          </Field>
          <Field label="lane">
            <select
              value={form.lane}
              disabled={isReadOnly}
              onChange={(e) => setForm({ ...form, lane: e.target.value as CueLane })}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            >
              {LANE_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="priority">
            <input
              type="number"
              min={0}
              max={100}
              value={form.priority}
              disabled={isReadOnly}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
          </Field>
          <Field label="risk_level">
            <select
              value={form.risk_level}
              disabled={isReadOnly}
              onChange={(e) => setForm({ ...form, risk_level: e.target.value as CueRiskLevel })}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            >
              {RISK_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="community / scope">
            <p className="text-xs text-muted-foreground">
              {original.community_id ?? '(unscoped)'} ·{' '}
              {original.scope.mode}
              {original.scope.community_id ? ` · ${original.scope.community_id}` : ''}
            </p>
          </Field>
        </Grid>
      </Section>

      <Section title="Theme">
        <Grid>
          <Field label="topic_seed *">
            <input
              type="text"
              value={form.topic_seed}
              disabled={isReadOnly}
              onChange={(e) => setForm({ ...form, topic_seed: e.target.value })}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
          </Field>
          <Field label="tone_band">
            <select
              value={form.tone_band}
              disabled={isReadOnly}
              onChange={(e) => setForm({ ...form, tone_band: e.target.value as CueToneBand | '' })}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="">(unset)</option>
              {TONE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="discussion_question" full>
            <textarea
              value={form.discussion_question}
              disabled={isReadOnly}
              onChange={(e) => setForm({ ...form, discussion_question: e.target.value })}
              rows={2}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
          </Field>
          <Field label="angle_hint" full>
            <textarea
              value={form.angle_hint}
              disabled={isReadOnly}
              onChange={(e) => setForm({ ...form, angle_hint: e.target.value })}
              rows={2}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
            />
          </Field>
        </Grid>
      </Section>

      <Section title="Scene (read-only in MVP — deep editing follow-up)">
        <Json value={original.scene_constraints} />
      </Section>

      <Section title="Role (read-only in MVP — deep editing follow-up)">
        <Json value={original.role_requirements} />
      </Section>

      <Section title="Media">
        <div className="space-y-2">
          <ul className="space-y-1">
            {detail.data?.data.media.length === 0 ? (
              <li className="text-xs text-muted-foreground">未附加任何媒体。</li>
            ) : (
              detail.data?.data.media.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-2 rounded border border-border/40 bg-muted/10 px-2 py-1 text-xs"
                >
                  <span className="font-mono">{m.asset_id}</span>
                  <Badge variant="outline">role:{m.role}</Badge>
                  <Badge variant="outline">strength:{m.usage_strength}</Badge>
                  <Badge variant="outline">policy:{m.use_policy}</Badge>
                  <Badge variant="outline">{m.validation_status}</Badge>
                  {m.selection_note ? <span className="text-muted-foreground">{m.selection_note}</span> : null}
                  {!isReadOnly ? (
                    <button
                      type="button"
                      className="ml-auto text-destructive disabled:opacity-50"
                      disabled={removeMediaMutation.isPending}
                      onClick={() => onRemoveMedia(m.id)}
                    >
                      移除
                    </button>
                  ) : null}
                </li>
              ))
            )}
          </ul>
          {!isReadOnly ? (
            <button
              type="button"
              className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20"
              onClick={() => setPickerOpen(true)}
            >
              + 添加媒体
            </button>
          ) : null}
        </div>
      </Section>

      <Section title="Runtime">
        <div className="space-y-3">
          <Field label="locked_fields">
            <LockedFieldsEditor
              value={form.locked_fields}
              onChange={(next) => setForm({ ...form, locked_fields: next })}
              disabled={isReadOnly}
            />
          </Field>
          <Field label="dispatch_policy (read-only in MVP)">
            <Json value={original.dispatch_policy} />
          </Field>
          {original.admission_policy ? (
            <Field label="admission_policy (read-only)">
              <Json value={original.admission_policy} />
            </Field>
          ) : null}
          {original.load_policy ? (
            <Field label="load_policy (read-only)">
              <Json value={original.load_policy} />
            </Field>
          ) : null}
        </div>
      </Section>

      {patch ? (
        <Section title="未保存的修改 (CuePatchV1 预览)">
          <div className="space-y-2">
            <Json value={patch} />
            <button
              type="button"
              className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
              disabled={previewMutation.isPending}
              onClick={onRunPreview}
            >
              {previewMutation.isPending ? '运行 preview…' : '运行 preview (5 段链)'}
            </button>
            <PreviewPanel
              result={previewMutation.data?.data ?? null}
              loading={previewMutation.isPending}
              error={previewMutation.error ? (previewMutation.error as Error).message : null}
            />
          </div>
        </Section>
      ) : null}

      <Section title="审计日志（CueChange 链）">
        {auditQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">加载中…</p>
        ) : auditQuery.error ? (
          <p className="text-xs text-destructive">
            加载失败：{(auditQuery.error as Error).message}
          </p>
        ) : !auditQuery.data || auditQuery.data.data.items.length === 0 ? (
          <p className="text-xs text-muted-foreground">暂无 audit 记录。</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              共 {auditQuery.data.data.total} 条改动，显示最近 {auditQuery.data.data.items.length} 条。
              （需要 inspect_programming_audit 权限。）
            </p>
            {auditQuery.data.data.items.map((change) => (
              <PatchDiffPanel key={change.id} change={change} />
            ))}
          </div>
        )}
      </Section>

      <MediaPickerDialog
        open={pickerOpen}
        communityId={original.community_id}
        onClose={() => setPickerOpen(false)}
        onSelect={onAttachMedia}
      />
    </div>
  )
}

function Header({
  cue,
  readOnly,
  dirty,
  saving,
  publishing,
  cancelling,
  skipping,
  onSave,
  onPublish,
  onCancel,
  onForceSkip,
  onClose,
}: {
  cue: PublicDiscussionCueDomain
  readOnly: boolean
  dirty: boolean
  saving: boolean
  publishing: boolean
  cancelling: boolean
  skipping: boolean
  onSave: () => void
  onPublish: () => void
  onCancel: () => void
  onForceSkip: () => void
  onClose: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 bg-muted/10 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono">{cue.id}</span>
        <Badge variant="outline">status:{cue.status}</Badge>
        <Badge variant="outline">rev{cue.revision}</Badge>
        <Badge variant="outline">source:{cue.source_type}</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20 disabled:opacity-50"
          disabled={readOnly || !dirty || saving}
          onClick={onSave}
        >
          {saving ? '保存中…' : '保存修改'}
        </button>
        {cue.status === 'draft' ? (
          <button
            type="button"
            className="rounded-md border border-success/40 bg-success/10 px-3 py-1 text-xs text-success hover:bg-success/20 disabled:opacity-50"
            disabled={publishing || dirty}
            title={dirty ? '请先保存修改再发布' : ''}
            onClick={onPublish}
          >
            {publishing ? '发布中…' : '发布'}
          </button>
        ) : null}
        {!readOnly ? (
          <button
            type="button"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1 text-xs text-destructive hover:bg-destructive/20 disabled:opacity-50"
            disabled={cancelling}
            onClick={onCancel}
          >
            {cancelling ? '取消中…' : '取消 cue'}
          </button>
        ) : null}
        {(cue.status === 'due' || cue.status === 'executing') ? (
          <button
            type="button"
            className="rounded-md border border-destructive/60 bg-destructive/20 px-3 py-1 text-xs text-destructive hover:bg-destructive/30 disabled:opacity-50"
            disabled={skipping}
            onClick={onForceSkip}
          >
            {skipping ? '处理中…' : '强制跳过'}
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-md border border-border bg-muted/30 px-3 py-1 text-xs hover:bg-muted/50"
          onClick={onClose}
        >
          关闭
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section data-ui="card" data-variant="outlined" className="space-y-2 p-4">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

function Field({
  label,
  children,
  full,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <label className={'space-y-1 text-xs ' + (full ? 'sm:col-span-2' : '')}>
      <span className="font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function Json({ value }: { value: unknown }) {
  return (
    <pre className="max-h-60 overflow-auto rounded bg-muted/30 p-2 text-[10px]">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}
