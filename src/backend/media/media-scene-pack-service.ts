import { ConflictError, NotFoundError, ValidationError } from '../lib/errors.js'
import type { MediaScenePackRepository } from '../repos/media-scene-pack-repository.js'
import type {
  AspectRatioHint,
  CompiledMediaPrompt,
  CreateMediaScenePackVersionInput,
  MediaGenerationSpec,
  MediaScenePackQualityGate,
  MediaScenePackRef,
  MediaScenePackRouteCandidate,
  MediaScenePackVersion,
  MediaScenePackWithVersions,
  MediaSemanticSnapshot,
  MediaVisualBrief,
  PersistedVisualDirective,
  PublicMediaContextCard,
  UpdateMediaScenePackVersionPatch,
} from '../repos/types.js'
import { compileMediaGenerationSpec } from './media-generation-compiler.js'
import { BUILTIN_MEDIA_SCENE_PACKS, type BuiltinMediaScenePackSeed } from './media-scene-pack-seeds.js'

const SYSTEM_SEED_USER_ID = 'system:media-scene-pack-seed'
const MAX_ROUTE_CANDIDATES = 3

export interface MediaScenePackDraftInput {
  display_name?: string
  media_family?: string
  when_to_use?: string[]
  do_not_use_when?: string[]
  visual_contract?: MediaScenePackVersion['visual_contract']
  safety_boundaries?: MediaScenePackVersion['safety_boundaries']
  prompt_system?: string
  quality_gate?: MediaScenePackVersion['quality_gate']
}

export interface ScenePackRoutePreviewInput {
  text?: string | null
  visual_brief?: MediaVisualBrief | null
}

export interface ScenePackCompilePreviewInput {
  text?: string | null
  scene_id?: string | null
  visual_brief?: MediaVisualBrief | null
  aspect_ratio_hint?: AspectRatioHint | null
}

export interface ScenePackQualityAudit {
  schema_version: 'scene-pack-quality-audit.v1'
  status: 'pass' | 'warn'
  scene_pack_ref: MediaScenePackRef | null
  semantic_snapshot_id: string | null
  semantic_schema_version: string | null
  checked_at: string
  checks: {
    real_world_anchor_present: boolean
    medium_shape_present: boolean
    information_layers_present: boolean
    creator_boundary_present: boolean
  }
  missing_must_have: string[]
  reject_hits: string[]
  notes: string[]
}

interface PlanPromptInput {
  directive?: PersistedVisualDirective | null
  spec: MediaGenerationSpec
  style_hint?: string | null
  reference_card?: PublicMediaContextCard | null
}

interface CompilePromptInput {
  spec: MediaGenerationSpec
  style_hint?: string | null
  scene_pack: MediaScenePackVersion
  visual_brief: MediaVisualBrief
  route_candidates: MediaScenePackRouteCandidate[]
}

function cleanLine(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function compactText(values: Array<string | null | undefined>): string {
  return values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(cleanLine)
    .join(' ')
    .trim()
}

function truncate(value: string, limit = 220): string {
  const cleaned = cleanLine(value)
  if (cleaned.length <= limit) return cleaned
  return `${cleaned.slice(0, limit - 1).trim()}...`
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const cleaned = typeof value === 'string' ? cleanLine(value) : ''
    if (!cleaned || seen.has(cleaned.toLowerCase())) continue
    seen.add(cleaned.toLowerCase())
    result.push(cleaned)
  }
  return result
}

function listLine(label: string, values: string[]): string | null {
  return values.length > 0 ? `${label}: ${values.join(' | ')}` : null
}

function nonEmptyLines(values: Array<string | null | undefined>): string[] {
  return values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function booleanFlag(label: string, value: boolean): string {
  return `${label}=${value ? 'true' : 'false'}`
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function containsToken(text: string, token: string): boolean {
  const normalizedToken = normalizeToken(token)
  if (!normalizedToken) return false
  return normalizeToken(text).includes(normalizedToken)
}

function semanticText(snapshot: Pick<MediaSemanticSnapshot, 'summary'> | null | undefined): string {
  if (!snapshot) return ''
  const summary = snapshot.summary
  return compactText([
    summary.scene,
    summary.composition,
    summary.theme,
    summary.mood,
    summary.public_safe_summary,
    summary.internal_full_summary,
    ...summary.salient_entities,
    ...summary.discussion_points,
    ...summary.style_tags,
    ...summary.ocr_snippets,
  ])
}

function packRef(version: MediaScenePackVersion): MediaScenePackRef {
  return {
    scene_id: version.scene_id,
    version: version.version,
    display_name: version.display_name,
    media_family: version.media_family,
  }
}

function makeRouteCandidate(
  version: MediaScenePackVersion,
  score: number,
  reasonParts: string[],
): MediaScenePackRouteCandidate {
  return {
    ...packRef(version),
    confidence: Math.max(0.05, Math.min(0.99, Number(score.toFixed(2)))),
    reason: reasonParts.length > 0 ? reasonParts.join('; ') : 'deterministic fallback candidate',
  }
}

function buildPreviewSpec(input: ScenePackCompilePreviewInput): MediaGenerationSpec {
  const text = input.text?.trim() ? cleanLine(input.text) : 'forum root post visual prompt'
  return {
    intent: 'scratch_scene',
    subject_anchors: [text],
    scene_constraints: ['Use a concrete scene or artifact that makes the post visually specific.'],
    style_constraints: [],
    negative_constraints: ['No real brand logo, no price, no unverifiable claim.'],
    source_projections: [],
    output_policy: {
      aspect_ratio_hint: input.aspect_ratio_hint ?? '4:5',
      public_safe_only: true,
      derivative_display_only: false,
    },
  }
}

function mergeDraft(
  base: MediaScenePackVersion,
  patch: MediaScenePackDraftInput,
): Omit<CreateMediaScenePackVersionInput, 'pack_id' | 'scene_id' | 'version'> {
  return {
    status: 'draft',
    display_name: patch.display_name ?? base.display_name,
    media_family: patch.media_family ?? base.media_family,
    when_to_use: patch.when_to_use ?? base.when_to_use,
    do_not_use_when: patch.do_not_use_when ?? base.do_not_use_when,
    visual_contract: patch.visual_contract ?? base.visual_contract,
    safety_boundaries: patch.safety_boundaries ?? base.safety_boundaries,
    prompt_system: patch.prompt_system ?? base.prompt_system,
    quality_gate: patch.quality_gate ?? base.quality_gate,
  }
}

export class MediaScenePackService {
  private seedPromise: Promise<void> | null = null

  constructor(private readonly deps: { repo: MediaScenePackRepository }) {}

  async ensureBuiltinScenePacks(): Promise<void> {
    if (!this.seedPromise) {
      this.seedPromise = this.seedBuiltinScenePacks()
    }
    return this.seedPromise
  }

  async listScenePacks(): Promise<MediaScenePackWithVersions[]> {
    await this.ensureBuiltinScenePacks()
    return this.deps.repo.listWithVersions()
  }

  async getScenePack(sceneId: string): Promise<MediaScenePackWithVersions> {
    await this.ensureBuiltinScenePacks()
    const pack = await this.deps.repo.findWithVersionsBySceneId(sceneId)
    if (!pack) throw new NotFoundError('Media scene pack', sceneId)
    return pack
  }

  async createDraftVersion(input: {
    scene_id: string
    patch: MediaScenePackDraftInput
    created_by_user_id?: string | null
  }): Promise<MediaScenePackVersion> {
    const pack = await this.getScenePack(input.scene_id)
    const base = pack.active_version_record ?? pack.versions[0]
    if (!base) throw new ValidationError(`Scene pack ${input.scene_id} has no base version`)
    const nextVersion = Math.max(0, ...pack.versions.map((version) => version.version)) + 1
    const draft = mergeDraft(base, input.patch)
    return this.deps.repo.createVersion({
      ...draft,
      pack_id: pack.id,
      scene_id: pack.scene_id,
      version: nextVersion,
      created_by_user_id: input.created_by_user_id ?? null,
      activated_at: null,
      released_at: null,
    })
  }

  async updateDraftVersion(input: {
    scene_id: string
    version: number
    patch: MediaScenePackDraftInput
    updated_by_user_id?: string | null
  }): Promise<MediaScenePackVersion> {
    await this.ensureBuiltinScenePacks()
    const current = await this.deps.repo.findVersion(input.scene_id, input.version)
    if (!current) throw new NotFoundError('Media scene pack version', `${input.scene_id}@${input.version}`)
    if (current.status !== 'draft') {
      throw new ConflictError('Only draft scene pack versions can be edited')
    }
    const patch: UpdateMediaScenePackVersionPatch = {
      ...input.patch,
      ...(input.updated_by_user_id !== undefined
        ? { created_by_user_id: input.updated_by_user_id }
        : {}),
    }
    const updated = await this.deps.repo.updateVersion(current.id, patch)
    if (!updated) throw new NotFoundError('Media scene pack version', current.id)
    return updated
  }

  async activateVersion(input: {
    scene_id: string
    version: number
  }): Promise<MediaScenePackWithVersions> {
    const pack = await this.getScenePack(input.scene_id)
    const target = pack.versions.find((version) => version.version === input.version)
    if (!target) throw new NotFoundError('Media scene pack version', `${input.scene_id}@${input.version}`)
    const now = new Date()
    await this.deps.repo.updateVersionStatuses(pack.id, 'active', {
      status: 'released',
      released_at: now,
    }, { except_version: target.version })
    await this.deps.repo.updateVersion(target.id, {
      status: 'active',
      activated_at: now,
      released_at: null,
    })
    await this.deps.repo.updatePack(pack.id, {
      status: 'active',
      active_version: target.version,
      display_name: target.display_name,
      media_family: target.media_family,
    })
    return this.getScenePack(input.scene_id)
  }

  async releaseVersion(input: {
    scene_id: string
    version: number
    released_by_user_id?: string | null
    reason?: string | null
  }): Promise<MediaScenePackVersion> {
    await this.ensureBuiltinScenePacks()
    const current = await this.deps.repo.findVersion(input.scene_id, input.version)
    if (!current) throw new NotFoundError('Media scene pack version', `${input.scene_id}@${input.version}`)
    if (current.status === 'active') {
      throw new ConflictError('Active scene pack version cannot be released directly; activate another version first')
    }
    const released = await this.deps.repo.updateVersion(current.id, {
      status: 'released',
      released_at: new Date(),
      ...(input.released_by_user_id ? { created_by_user_id: input.released_by_user_id } : {}),
    })
    if (!released) throw new NotFoundError('Media scene pack version', current.id)
    return released
  }

  extractVisualBrief(input: {
    directive?: PersistedVisualDirective | null
    spec?: MediaGenerationSpec | null
    reference_card?: PublicMediaContextCard | null
    text?: string | null
  }): MediaVisualBrief {
    const directive = input.directive ?? null
    const spec = input.spec ?? null
    const card = input.reference_card ?? null
    const visualIntent = compactText([
      directive?.goal.visual_role,
      directive?.goal.human_goal,
      spec?.intent,
      input.text,
    ]) || 'make the root post visually concrete'
    const communicationJob = compactText([
      directive?.narrative_context.objective,
      directive?.narrative_context.hook,
      directive?.narrative_context.semantic_query,
      input.text,
      spec?.subject_anchors[0],
    ]) || visualIntent
    const realWorldAnchor = compactText([
      card?.public_summary.scene,
      card?.public_summary.public_safe_caption,
      ...(card?.public_summary.salient_entities ?? []),
      ...(directive?.narrative_context.required_elements ?? []),
      ...(spec?.subject_anchors ?? []),
    ]) || 'a tangible scene, object, place, or artifact from the post'
    const forbiddenClaims = uniqueStrings([
      ...(directive?.narrative_context.forbidden_elements ?? []),
      ...(directive?.audit.hard_constraints ?? []),
      ...(spec?.negative_constraints ?? []),
    ]).slice(0, 12)

    return {
      visual_intent: truncate(visualIntent),
      emotional_kernel: truncate(compactText([
        directive?.narrative_context.tone_hint,
        directive?.narrative_context.relation_focus,
        directive?.goal.human_goal,
      ]) || 'clear, grounded, discussion-friendly'),
      real_world_anchor: truncate(realWorldAnchor),
      communication_job: truncate(communicationJob),
      forbidden_claims: forbiddenClaims,
    }
  }

  async routeScenePack(input: {
    visual_brief: MediaVisualBrief
    spec?: MediaGenerationSpec | null
    text?: string | null
  }): Promise<MediaScenePackRouteCandidate[]> {
    await this.ensureBuiltinScenePacks()
    const activeVersions = await this.listActiveVersions()
    if (activeVersions.length === 0) return []

    const routeText = compactText([
      input.text ?? null,
      input.visual_brief.visual_intent,
      input.visual_brief.emotional_kernel,
      input.visual_brief.real_world_anchor,
      input.visual_brief.communication_job,
      ...(input.visual_brief.forbidden_claims ?? []),
      input.spec?.intent,
      ...(input.spec?.subject_anchors ?? []),
      ...(input.spec?.scene_constraints ?? []),
      ...(input.spec?.style_constraints ?? []),
    ])

    const scored = activeVersions.map((version) => {
      const keywords = version.visual_contract.routing_keywords ?? []
      const keywordHits = keywords.filter((keyword) => containsToken(routeText, keyword))
      const whenHits = version.when_to_use.filter((rule) => {
        const words = rule.split(/\W+/).filter((word) => word.length >= 5)
        return words.some((word) => containsToken(routeText, word))
      })
      const familyHit = containsToken(routeText, version.media_family) ? 1 : 0
      const displayHit = containsToken(routeText, version.display_name) ? 1 : 0
      const score =
        0.14
        + keywordHits.length * 0.18
        + Math.min(whenHits.length, 2) * 0.12
        + familyHit * 0.1
        + displayHit * 0.08
      const reasonParts = [
        keywordHits.length > 0 ? `matched keywords: ${keywordHits.slice(0, 5).join(', ')}` : null,
        whenHits.length > 0 ? `matched usage rule: ${truncate(whenHits[0], 90)}` : null,
        familyHit ? `matched family ${version.media_family}` : null,
      ].filter((value): value is string => Boolean(value))
      return makeRouteCandidate(version, score, reasonParts)
    })

    return scored
      .sort((left, right) => right.confidence - left.confidence || left.scene_id.localeCompare(right.scene_id))
      .slice(0, MAX_ROUTE_CANDIDATES)
  }

  async planPrompt(input: PlanPromptInput): Promise<CompiledMediaPrompt> {
    const fallback = compileMediaGenerationSpec({
      spec: input.spec,
      style_hint: input.style_hint ?? null,
    })
    try {
      const visualBrief = this.extractVisualBrief({
        directive: input.directive ?? null,
        spec: input.spec,
        reference_card: input.reference_card ?? null,
      })
      const routeCandidates = await this.routeScenePack({
        visual_brief: visualBrief,
        spec: input.spec,
      })
      const selected = routeCandidates[0]
      if (!selected) return fallback
      const scenePack = await this.findActiveVersion(selected.scene_id, selected.version)
      if (!scenePack) return fallback
      return this.compileScenePackPrompt({
        spec: input.spec,
        style_hint: input.style_hint ?? null,
        scene_pack: scenePack,
        visual_brief: visualBrief,
        route_candidates: routeCandidates,
      })
    } catch (error) {
      console.warn(
        '[MediaScenePackService] scene pack prompt planning failed; using legacy compiler:',
        error instanceof Error ? error.message : String(error),
      )
      return fallback
    }
  }

  async previewRoute(input: ScenePackRoutePreviewInput): Promise<{
    visual_brief: MediaVisualBrief
    candidates: MediaScenePackRouteCandidate[]
  }> {
    const visualBrief = input.visual_brief ?? this.extractVisualBrief({ text: input.text ?? null })
    const candidates = await this.routeScenePack({
      visual_brief: visualBrief,
      text: input.text ?? null,
    })
    return { visual_brief: visualBrief, candidates }
  }

  async previewCompile(input: ScenePackCompilePreviewInput): Promise<{
    visual_brief: MediaVisualBrief
    route_candidates: MediaScenePackRouteCandidate[]
    compiled_prompt: CompiledMediaPrompt
  }> {
    const spec = buildPreviewSpec(input)
    const visualBrief = input.visual_brief ?? this.extractVisualBrief({
      spec,
      text: input.text ?? null,
    })
    const routeCandidates = await this.routeScenePack({
      visual_brief: visualBrief,
      spec,
      text: input.text ?? null,
    })
    const selected = input.scene_id
      ? routeCandidates.find((candidate) => candidate.scene_id === input.scene_id)
      : routeCandidates[0]
    const sceneId = input.scene_id ?? selected?.scene_id
    if (!sceneId) throw new NotFoundError('Active media scene pack')
    const active = await this.findActiveVersion(sceneId, selected?.version)
    if (!active) throw new NotFoundError('Active media scene pack', sceneId)
    return {
      visual_brief: visualBrief,
      route_candidates: routeCandidates,
      compiled_prompt: this.compileScenePackPrompt({
        spec,
        scene_pack: active,
        visual_brief: visualBrief,
        route_candidates: selected ? routeCandidates : [
          makeRouteCandidate(active, 0.9, ['selected explicit scene_id']),
          ...routeCandidates,
        ].slice(0, MAX_ROUTE_CANDIDATES),
      }),
    }
  }

  compileScenePackPrompt(input: CompilePromptInput): CompiledMediaPrompt {
    const version = input.scene_pack
    const style = uniqueStrings([
      ...input.spec.style_constraints,
      input.style_hint ?? null,
      version.visual_contract.composition,
    ])
    const negative = uniqueStrings([
      ...input.spec.negative_constraints,
      ...input.visual_brief.forbidden_claims,
      ...version.quality_gate.reject_if,
      ...version.safety_boundaries.additional_boundaries,
      version.safety_boundaries.no_price ? 'No price, discount, coupon, or purchase CTA.' : null,
      version.safety_boundaries.no_efficacy_claim ? 'No efficacy, medical, beauty result, or guaranteed outcome claim.' : null,
      version.safety_boundaries.no_real_brand_promo ? 'No real brand logo, trademark, or brand campaign imitation.' : null,
      version.safety_boundaries.no_purchase_guarantee ? 'No purchase guarantee or conversion promise.' : null,
    ])
    const subject = uniqueStrings([
      ...input.spec.subject_anchors,
      input.visual_brief.real_world_anchor,
    ])
    const scene = uniqueStrings([
      ...input.spec.scene_constraints,
      version.visual_contract.surface,
      ...version.visual_contract.required_information_layers,
    ])
    const renderedPrompt = nonEmptyLines([
      `scene_pack: ${version.scene_id}@${version.version} (${version.display_name})`,
      `media_family: ${version.media_family}`,
      `visual_intent: ${input.visual_brief.visual_intent}`,
      `emotional_kernel: ${input.visual_brief.emotional_kernel}`,
      `real_world_anchor: ${input.visual_brief.real_world_anchor}`,
      `communication_job: ${input.visual_brief.communication_job}`,
      listLine('when_to_use', version.when_to_use),
      `pack_system: ${version.prompt_system}`,
      `surface: ${version.visual_contract.surface}`,
      `composition: ${version.visual_contract.composition}`,
      `text_policy: ${version.visual_contract.text_policy}`,
      listLine('required_information_layers', version.visual_contract.required_information_layers),
      listLine('subject_anchors', subject),
      listLine('scene_constraints', scene),
      listLine('style_constraints', style),
      listLine('negative_constraints', negative),
      `safety_boundaries: ${[
        booleanFlag('no_price', version.safety_boundaries.no_price),
        booleanFlag('no_efficacy_claim', version.safety_boundaries.no_efficacy_claim),
        booleanFlag('no_real_brand_promo', version.safety_boundaries.no_real_brand_promo),
        booleanFlag('no_purchase_guarantee', version.safety_boundaries.no_purchase_guarantee),
      ].join('; ')}`,
      listLine('quality_gate_must_have', version.quality_gate.must_have),
      listLine('quality_gate_reject_if', version.quality_gate.reject_if),
      `output_policy: aspect_ratio=${input.spec.output_policy.aspect_ratio_hint ?? '4:5'}; public_safe_only=${input.spec.output_policy.public_safe_only ? 'true' : 'false'}; derivative_display_only=${input.spec.output_policy.derivative_display_only ? 'true' : 'false'}`,
    ]).join('\n')

    return {
      schema_version: 'compiled-media-prompt.v1',
      template_id: 'scene-pack-prompt-compiler',
      rendered_prompt: renderedPrompt,
      sections: {
        intent: input.visual_brief.visual_intent,
        subject,
        scene,
        style,
        negative,
      },
      style_hint: input.style_hint?.trim() ? cleanLine(input.style_hint) : null,
      aspect_ratio_hint: input.spec.output_policy.aspect_ratio_hint,
      scene_pack_ref: packRef(version),
      visual_brief: input.visual_brief,
      route_candidates: input.route_candidates,
      quality_gate: version.quality_gate,
    }
  }

  auditGeneratedSnapshot(input: {
    compiled_prompt: CompiledMediaPrompt
    snapshot: Pick<MediaSemanticSnapshot, 'id' | 'schema_version' | 'summary'> | null
  }): ScenePackQualityAudit {
    const text = semanticText(input.snapshot)
    const prompt = input.compiled_prompt
    const gate: MediaScenePackQualityGate = prompt.quality_gate ?? { must_have: [], reject_if: [] }
    const missingMustHave = gate.must_have.filter((item) => !containsToken(text, item))
    const rejectHits = gate.reject_if.filter((item) => containsToken(text, item))
    const hasScenePack = prompt.scene_pack_ref !== undefined && prompt.scene_pack_ref !== null
    const realWorldAnchor = prompt.visual_brief?.real_world_anchor ?? ''
    const checks = {
      real_world_anchor_present: !realWorldAnchor || containsToken(text, realWorldAnchor) || text.length > 60,
      medium_shape_present: hasScenePack && text.length > 40,
      information_layers_present: missingMustHave.length <= Math.max(1, Math.floor(gate.must_have.length / 2)),
      creator_boundary_present: rejectHits.length === 0,
    }
    const status = Object.values(checks).every(Boolean) && rejectHits.length === 0 ? 'pass' : 'warn'
    return {
      schema_version: 'scene-pack-quality-audit.v1',
      status,
      scene_pack_ref: prompt.scene_pack_ref ?? null,
      semantic_snapshot_id: input.snapshot?.id ?? null,
      semantic_schema_version: input.snapshot?.schema_version ?? null,
      checked_at: new Date().toISOString(),
      checks,
      missing_must_have: missingMustHave,
      reject_hits: rejectHits,
      notes: [
        status === 'warn' ? 'Audit is advisory only; generation result remains eligible for display.' : null,
        !hasScenePack ? 'No scene_pack_ref found on compiled prompt.' : null,
      ].filter((value): value is string => Boolean(value)),
    }
  }

  private async seedBuiltinScenePacks(): Promise<void> {
    for (const packSeed of BUILTIN_MEDIA_SCENE_PACKS) {
      await this.ensureSeedPack(packSeed)
    }
  }

  private async ensureSeedPack(seedInput: BuiltinMediaScenePackSeed): Promise<void> {
    const existing = await this.deps.repo.findWithVersionsBySceneId(seedInput.scene_id)
    if (existing) {
      if (existing.versions.length === 0) {
        await this.deps.repo.createVersion({
          ...seedInput,
          pack_id: existing.id,
          version: 1,
          status: 'active',
          created_by_user_id: SYSTEM_SEED_USER_ID,
          activated_at: new Date(),
          released_at: null,
        })
      }
      return
    }

    const pack = await this.deps.repo.createPack({
      scene_id: seedInput.scene_id,
      display_name: seedInput.display_name,
      media_family: seedInput.media_family,
      status: 'active',
      active_version: 1,
    })
    await this.deps.repo.createVersion({
      ...seedInput,
      pack_id: pack.id,
      version: 1,
      status: 'active',
      created_by_user_id: SYSTEM_SEED_USER_ID,
      activated_at: new Date(),
      released_at: null,
    })
  }

  private async listActiveVersions(): Promise<MediaScenePackVersion[]> {
    const packs = await this.deps.repo.listWithVersions()
    return packs
      .filter((pack) => pack.status === 'active')
      .map((pack) => pack.active_version_record)
      .filter((version): version is MediaScenePackVersion => Boolean(version))
  }

  private async findActiveVersion(
    sceneId: string,
    version?: number | null,
  ): Promise<MediaScenePackVersion | null> {
    await this.ensureBuiltinScenePacks()
    const pack = await this.deps.repo.findWithVersionsBySceneId(sceneId)
    if (!pack || pack.status !== 'active') return null
    if (version !== undefined && version !== null) {
      const exact = pack.versions.find((item) => item.version === version && item.status === 'active')
      if (exact) return exact
    }
    return pack.active_version_record
  }
}
