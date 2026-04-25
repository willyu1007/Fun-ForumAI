import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Play, Rocket, Save, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  useActivateAdminMediaScenePackVersion,
  useAdminMediaScenePack,
  useAdminMediaScenePackCompilePreview,
  useAdminMediaScenePackRoutePreview,
  useAdminMediaScenePacks,
  useCreateAdminMediaScenePackDraft,
  useReleaseAdminMediaScenePackVersion,
  useUpdateAdminMediaScenePackVersion,
} from '@/api/hooks'
import type {
  MediaScenePackDraftPayload,
  MediaScenePackSafetyBoundaries,
  MediaScenePackVersion,
  MediaScenePackVisualContract,
  MediaScenePackTextPolicy,
} from '@/api/types'

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function joinLines(values: string[] | undefined): string {
  return (values ?? []).join('\n')
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label data-ui="stack" data-direction="col" data-gap="1" className="block space-y-1">
      <span data-ui="text" data-variant="label" className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

const VERSION_STATUS_LABELS: Record<string, string> = {
  active: '生效中',
  draft: '草稿',
  released: '已归档',
}

const TEXT_POLICY_LABELS: Record<MediaScenePackTextPolicy, string> = {
  avoid: '尽量无字',
  allow_short_chinese: '可少量中文',
  allow: '可包含文字',
}

function versionStatusLabel(status: string): string {
  return VERSION_STATUS_LABELS[status] ?? status
}

function VersionBadge({ version }: { version: MediaScenePackVersion | null }) {
  if (!version) return <Badge variant="outline">暂无版本</Badge>
  return (
    <Badge variant={version.status === 'active' ? 'default' : 'outline'}>
      v{version.version} {versionStatusLabel(version.status)}
    </Badge>
  )
}

function statusTone(status: string) {
  if (status === 'active') return 'default' as const
  if (status === 'draft') return 'secondary' as const
  return 'outline' as const
}

interface DraftFormState {
  displayName: string
  mediaFamily: string
  whenToUse: string
  doNotUseWhen: string
  surface: string
  composition: string
  textPolicy: MediaScenePackTextPolicy
  realWorldAnchorRequired: boolean
  requiredLayers: string
  routingKeywords: string
  noPrice: boolean
  noEfficacyClaim: boolean
  noRealBrandPromo: boolean
  noPurchaseGuarantee: boolean
  additionalBoundaries: string
  promptSystem: string
  mustHave: string
  rejectIf: string
}

type SafetyCheckKey =
  | 'noPrice'
  | 'noEfficacyClaim'
  | 'noRealBrandPromo'
  | 'noPurchaseGuarantee'

const SAFETY_CHECKS: Array<[SafetyCheckKey, string]> = [
  ['noPrice', '不出现价格'],
  ['noEfficacyClaim', '不做功效承诺'],
  ['noRealBrandPromo', '不宣传真实品牌'],
  ['noPurchaseGuarantee', '不暗示购买保障'],
]

function formFromVersion(version: MediaScenePackVersion | null): DraftFormState {
  return {
    displayName: version?.display_name ?? '',
    mediaFamily: version?.media_family ?? '',
    whenToUse: joinLines(version?.when_to_use),
    doNotUseWhen: joinLines(version?.do_not_use_when),
    surface: version?.visual_contract.surface ?? '',
    composition: version?.visual_contract.composition ?? '',
    textPolicy: version?.visual_contract.text_policy ?? 'allow_short_chinese',
    realWorldAnchorRequired: version?.visual_contract.real_world_anchor_required ?? true,
    requiredLayers: joinLines(version?.visual_contract.required_information_layers),
    routingKeywords: joinLines(version?.visual_contract.routing_keywords),
    noPrice: version?.safety_boundaries.no_price ?? false,
    noEfficacyClaim: version?.safety_boundaries.no_efficacy_claim ?? false,
    noRealBrandPromo: version?.safety_boundaries.no_real_brand_promo ?? true,
    noPurchaseGuarantee: version?.safety_boundaries.no_purchase_guarantee ?? true,
    additionalBoundaries: joinLines(version?.safety_boundaries.additional_boundaries),
    promptSystem: version?.prompt_system ?? '',
    mustHave: joinLines(version?.quality_gate.must_have),
    rejectIf: joinLines(version?.quality_gate.reject_if),
  }
}

function payloadFromForm(form: DraftFormState): MediaScenePackDraftPayload {
  const visualContract: MediaScenePackVisualContract = {
    surface: form.surface,
    composition: form.composition,
    text_policy: form.textPolicy,
    real_world_anchor_required: form.realWorldAnchorRequired,
    required_information_layers: splitLines(form.requiredLayers),
    routing_keywords: splitLines(form.routingKeywords),
  }
  const safetyBoundaries: MediaScenePackSafetyBoundaries = {
    no_price: form.noPrice,
    no_efficacy_claim: form.noEfficacyClaim,
    no_real_brand_promo: form.noRealBrandPromo,
    no_purchase_guarantee: form.noPurchaseGuarantee,
    additional_boundaries: splitLines(form.additionalBoundaries),
  }
  return {
    display_name: form.displayName,
    media_family: form.mediaFamily,
    when_to_use: splitLines(form.whenToUse),
    do_not_use_when: splitLines(form.doNotUseWhen),
    visual_contract: visualContract,
    safety_boundaries: safetyBoundaries,
    prompt_system: form.promptSystem,
    quality_gate: {
      must_have: splitLines(form.mustHave),
      reject_if: splitLines(form.rejectIf),
    },
  }
}

export function MediaPromptsTab() {
  const packsQuery = useAdminMediaScenePacks()
  const packs = useMemo(() => packsQuery.data?.data ?? [], [packsQuery.data?.data])
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedSceneId && packs.length > 0) {
      setSelectedSceneId(packs[0].scene_id)
    }
  }, [packs, selectedSceneId])

  const detailQuery = useAdminMediaScenePack(selectedSceneId)
  const detail = detailQuery.data?.data ?? null
  const activeVersion = detail?.active_version_record ?? null
  const draftVersion = detail?.versions.find((version) => version.status === 'draft') ?? null
  const editableVersion = draftVersion ?? activeVersion
  const [form, setForm] = useState<DraftFormState>(() => formFromVersion(null))
  const [previewText, setPreviewText] = useState('')

  useEffect(() => {
    setForm(formFromVersion(editableVersion))
  }, [editableVersion, editableVersion?.id])

  const createDraft = useCreateAdminMediaScenePackDraft()
  const updateDraft = useUpdateAdminMediaScenePackVersion()
  const activateVersion = useActivateAdminMediaScenePackVersion()
  const releaseVersion = useReleaseAdminMediaScenePackVersion()
  const routePreview = useAdminMediaScenePackRoutePreview()
  const compilePreview = useAdminMediaScenePackCompilePreview()

  const activeCount = useMemo(
    () => packs.filter((pack) => pack.status === 'active' && pack.active_version_record).length,
    [packs],
  )

  const saveDraft = async () => {
    if (!detail) return
    const patch = payloadFromForm(form)
    if (draftVersion) {
      await updateDraft.mutateAsync({
        scene_id: detail.scene_id,
        version: draftVersion.version,
        patch,
      })
      return
    }
    await createDraft.mutateAsync({
      scene_id: detail.scene_id,
      patch,
    })
  }

  const runRoutePreview = async () => {
    await routePreview.mutateAsync({
      text: previewText || form.promptSystem || detail?.display_name || '',
    })
  }

  const runCompilePreview = async () => {
    await compilePreview.mutateAsync({
      text: previewText || form.promptSystem || detail?.display_name || '',
      scene_id: selectedSceneId,
      aspect_ratio_hint: '4:5',
    })
  }

  if (packsQuery.isLoading) {
    return (
      <div className="rounded-md border border-border/60 p-6 text-sm text-muted-foreground">
        文生图场景加载中...
      </div>
    )
  }

  if (packsQuery.error) {
    return (
      <div className="rounded-md border border-destructive/30 p-6 text-sm text-destructive">
        文生图场景管理加载失败。
      </div>
    )
  }

  return (
    <div data-ui="stack" data-direction="col" data-gap="4" className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-border/70 p-4">
          <div className="text-xs text-muted-foreground">已启用内置场景</div>
          <div className="mt-2 text-2xl font-semibold">{activeCount}</div>
        </div>
        <div className="rounded-md border border-border/70 p-4">
          <div className="text-xs text-muted-foreground">场景总数</div>
          <div className="mt-2 text-2xl font-semibold">{packs.length}</div>
        </div>
        <div className="rounded-md border border-border/70 p-4 md:col-span-2">
          <div className="text-xs text-muted-foreground">当前场景</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{detail?.display_name ?? '未选择'}</span>
            <VersionBadge version={activeVersion} />
            {draftVersion ? <VersionBadge version={draftVersion} /> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-md border border-border/70">
          <div className="border-b border-border/70 p-3">
            <h3 className="text-sm font-semibold">场景列表</h3>
          </div>
          <div className="max-h-[760px] overflow-y-auto p-2">
            {packs.map((pack) => (
              <button
                key={pack.scene_id}
                type="button"
                onClick={() => setSelectedSceneId(pack.scene_id)}
                className={[
                  'mb-1 w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                  selectedSceneId === pack.scene_id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted',
                ].join(' ')}
              >
                <div className="font-medium">{pack.display_name}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{pack.scene_id}</div>
              </button>
            ))}
          </div>
        </aside>

        <main className="space-y-4">
          {detailQuery.isLoading ? (
            <div className="rounded-md border border-border/70 p-6 text-sm text-muted-foreground">
              场景详情加载中...
            </div>
          ) : !detail || !editableVersion ? (
            <div className="rounded-md border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
              请选择一个文生图场景。
            </div>
          ) : (
            <>
              <section className="rounded-md border border-border/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{detail.display_name}</h3>
                      <Badge variant="outline">{detail.media_family}</Badge>
                      <Badge variant={statusTone(detail.status)}>{versionStatusLabel(detail.status)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{detail.scene_id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void saveDraft()}
                      disabled={createDraft.isPending || updateDraft.isPending}
                    >
                      <Save className="h-4 w-4" />
                      {draftVersion ? '保存草稿' : '新建草稿'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => draftVersion
                        ? void activateVersion.mutateAsync({
                          scene_id: detail.scene_id,
                          version: draftVersion.version,
                        })
                        : undefined}
                      disabled={!draftVersion || activateVersion.isPending}
                    >
                      <Rocket className="h-4 w-4" />
                      启用草稿
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => draftVersion
                        ? void releaseVersion.mutateAsync({
                          scene_id: detail.scene_id,
                          version: draftVersion.version,
                        })
                        : undefined}
                      disabled={!draftVersion || releaseVersion.isPending}
                    >
                      归档草稿
                    </Button>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="rounded-md border border-border/70 p-4">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">草稿编辑</h3>
                    <Badge variant={draftVersion ? 'secondary' : 'outline'}>
                      正在编辑：{draftVersion ? `草稿 v${draftVersion.version}` : `线上 v${activeVersion?.version}`}
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="展示名称">
                      <Input
                        id="media-prompts-display-name"
                        name="display_name"
                        value={form.displayName}
                        onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                      />
                    </Field>
                    <Field label="媒体类型">
                      <Input
                        id="media-prompts-media-family"
                        name="media_family"
                        value={form.mediaFamily}
                        onChange={(event) => setForm((prev) => ({ ...prev, mediaFamily: event.target.value }))}
                      />
                    </Field>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field label="适用内容">
                      <Textarea
                        id="media-prompts-when-to-use"
                        name="when_to_use"
                        className="min-h-28"
                        value={form.whenToUse}
                        onChange={(event) => setForm((prev) => ({ ...prev, whenToUse: event.target.value }))}
                      />
                    </Field>
                    <Field label="不适用内容">
                      <Textarea
                        id="media-prompts-do-not-use-when"
                        name="do_not_use_when"
                        className="min-h-28"
                        value={form.doNotUseWhen}
                        onChange={(event) => setForm((prev) => ({ ...prev, doNotUseWhen: event.target.value }))}
                      />
                    </Field>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field label="画面形态">
                      <Input
                        id="media-prompts-surface"
                        name="surface"
                        value={form.surface}
                        onChange={(event) => setForm((prev) => ({ ...prev, surface: event.target.value }))}
                      />
                    </Field>
                    <Field label="画面文字策略">
                      <select
                        id="media-prompts-text-policy"
                        name="text_policy"
                        data-ui="select"
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={form.textPolicy}
                        onChange={(event) => setForm((prev) => ({
                          ...prev,
                          textPolicy: event.target.value as MediaScenePackTextPolicy,
                        }))}
                      >
                        <option value="avoid">{TEXT_POLICY_LABELS.avoid}</option>
                        <option value="allow_short_chinese">{TEXT_POLICY_LABELS.allow_short_chinese}</option>
                        <option value="allow">{TEXT_POLICY_LABELS.allow}</option>
                      </select>
                    </Field>
                  </div>

                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      id="media-prompts-real-world-anchor-required"
                      name="real_world_anchor_required"
                      type="checkbox"
                      checked={form.realWorldAnchorRequired}
                      onChange={(event) => setForm((prev) => ({
                        ...prev,
                        realWorldAnchorRequired: event.target.checked,
                      }))}
                    />
                    <span>必须有现实锚点</span>
                  </label>

                  <div className="mt-3">
                    <Field label="构图要求">
                      <Textarea
                        id="media-prompts-composition"
                        name="composition"
                        className="min-h-24"
                        value={form.composition}
                        onChange={(event) => setForm((prev) => ({ ...prev, composition: event.target.value }))}
                      />
                    </Field>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field label="必须呈现的信息层">
                      <Textarea
                        id="media-prompts-required-layers"
                        name="required_information_layers"
                        className="min-h-28"
                        value={form.requiredLayers}
                        onChange={(event) => setForm((prev) => ({ ...prev, requiredLayers: event.target.value }))}
                      />
                    </Field>
                    <Field label="路由关键词">
                      <Textarea
                        id="media-prompts-routing-keywords"
                        name="routing_keywords"
                        className="min-h-28"
                        value={form.routingKeywords}
                        onChange={(event) => setForm((prev) => ({ ...prev, routingKeywords: event.target.value }))}
                      />
                    </Field>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field label="场景提示词">
                      <Textarea
                        id="media-prompts-prompt-system"
                        name="prompt_system"
                        className="min-h-40"
                        value={form.promptSystem}
                        onChange={(event) => setForm((prev) => ({ ...prev, promptSystem: event.target.value }))}
                      />
                    </Field>
                    <div className="space-y-3">
                      <Field label="质量必达项">
                        <Textarea
                          id="media-prompts-quality-must-have"
                          name="quality_must_have"
                          className="min-h-20"
                          value={form.mustHave}
                          onChange={(event) => setForm((prev) => ({ ...prev, mustHave: event.target.value }))}
                        />
                      </Field>
                      <Field label="质量退回条件">
                        <Textarea
                          id="media-prompts-quality-reject-if"
                          name="quality_reject_if"
                          className="min-h-20"
                          value={form.rejectIf}
                          onChange={(event) => setForm((prev) => ({ ...prev, rejectIf: event.target.value }))}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="mt-3 rounded-md border border-border/70 p-3">
                    <div className="mb-2 text-xs font-medium text-muted-foreground">安全边界</div>
                    <div className="grid gap-2 text-sm md:grid-cols-2">
                      {SAFETY_CHECKS.map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            id={`media-prompts-safety-${key}`}
                            name={`safety_${key}`}
                            type="checkbox"
                            checked={form[key]}
                            onChange={(event) => setForm((prev) => ({
                              ...prev,
                              [key]: event.target.checked,
                            }))}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3">
                      <Field label="其他边界">
                        <Textarea
                          id="media-prompts-additional-boundaries"
                          name="additional_boundaries"
                          className="min-h-20"
                          value={form.additionalBoundaries}
                          onChange={(event) => setForm((prev) => ({
                            ...prev,
                            additionalBoundaries: event.target.value,
                          }))}
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <section className="rounded-md border border-border/70 p-4">
                    <h3 className="text-sm font-semibold">版本记录</h3>
                    <div className="mt-3 space-y-2">
                      {detail.versions.map((version) => (
                        <div
                          key={version.id}
                          className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
                        >
                          <span>v{version.version}</span>
                          <Badge variant={statusTone(version.status)}>{versionStatusLabel(version.status)}</Badge>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-md border border-border/70 p-4">
                    <h3 className="text-sm font-semibold">路由与编译预览</h3>
                    <Textarea
                      id="media-prompts-preview-text"
                      name="preview_text"
                      className="mt-3 min-h-28"
                      value={previewText}
                      onChange={(event) => setPreviewText(event.target.value)}
                      placeholder="输入根帖主题、发帖目标或画面简述..."
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void runRoutePreview()}
                        disabled={routePreview.isPending}
                      >
                        <Search className="h-4 w-4" />
                        匹配场景
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void runCompilePreview()}
                        disabled={compilePreview.isPending}
                      >
                        <Play className="h-4 w-4" />
                        编译提示词
                      </Button>
                    </div>

                    {routePreview.data?.data.candidates.length ? (
                      <div className="mt-4 space-y-2">
                        {routePreview.data.data.candidates.map((candidate) => (
                          <div key={`${candidate.scene_id}-${candidate.version}`} className="rounded-md bg-muted/40 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{candidate.display_name}</span>
                              <Badge variant="outline">{Math.round(candidate.confidence * 100)}%</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{candidate.reason}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {compilePreview.data?.data.compiled_prompt ? (
                      <div className="mt-4">
                        <div className="mb-2 text-xs font-medium text-muted-foreground">编译结果</div>
                        <pre className="max-h-96 overflow-auto rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap">
                          {compilePreview.data.data.compiled_prompt.rendered_prompt}
                        </pre>
                      </div>
                    ) : null}
                  </section>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
