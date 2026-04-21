import { createHash } from 'node:crypto'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { AchievementRepository } from '../repos/achievement-repository.js'
import type { ChronicleRepository } from '../repos/chronicle-repository.js'
import type { RelationRepository } from '../repos/relation-repository.js'
import type { AgentService } from './agent-service.js'
import type { AgentBioWorldviewService } from './agent-bio-worldview-service.js'
import type { InferenceProfileService } from './inference-profile-service.js'
import type { AgentBiographyRepository } from '../repos/agent-biography-repository.js'
import type { OwnerLifeOverviewService } from './owner-life-overview-service.js'
import type {
  AgentBiographyBookViewModel,
  AgentBiographyChapter,
  AgentBiographyChapterSkeletonV1,
  AgentBiographyCompileState,
  AgentBiographyReadTelemetryEvent,
  BiographyBookCoverViewModel,
  BiographyBookMemory,
  BiographyChapterDigest,
  BiographyChapterRevision,
  BiographyChapterRole,
  BiographyChapterViewModel,
  BiographyCompileStatus,
  BiographyDirectoryStatusLabel,
  BiographyFactualAudit,
  BiographyMaterial,
  BiographyMaterialDigest,
  BiographyMaterialEffect,
  BiographyMaterialSourceType,
  BiographyToneProfile,
  BiographyWriterInput,
  BiographyWriterConfig,
  BiographyChapterBodyV1,
} from '../../shared/agent-biography.js'
import { buildDeterministicChapterBody } from './biography-writer-service.js'
import type { BiographyWriterService } from './biography-writer-service.js'
import type { BiographyFactualAuditService } from './biography-factual-audit-service.js'

type WorldviewCompile = Awaited<ReturnType<AgentBioWorldviewService['compile']>>
type PersonalityNarrative = Awaited<ReturnType<InferenceProfileService['getNarrative']>>

const DEFAULT_WRITER_CONFIG: BiographyWriterConfig = {
  config_id: 'agent-biography-writer-v1',
  model_name: 'hidden-biography-writer',
  temperature: 1,
  max_tokens: 1200,
  style_contract: 'AGENT_BIOGRAPHY_CHAPTER_V2',
  factuality_mode: 'SKELETON_ONLY',
  allow_private_influence: true,
  output_format: 'JSON',
  prompt_version: '2',
}

const SOURCE_LINE =
  '由 chronicle、achievements、relation signals、private digest summary 与 personality narrative 编排。'

function clip(value: string, maxLength = 80): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return ''
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}…`
}

function ensureSentence(value: string): string {
  const normalized = clip(value, 180)
  if (!normalized) return ''
  return /[。！？!?]$/u.test(normalized) ? normalized : `${normalized}。`
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function todayStart(date = new Date()): Date {
  return new Date(date.toISOString().slice(0, 10))
}

function parseDate(value: string | null | undefined): number {
  return value ? Date.parse(value) || 0 : 0
}

function sanitizeLegacyChapterTitle(value: string): string {
  return value
    .replace(/^你与她的/u, '人物')
    .replace(/^你和她的/u, '人物')
    .replace(/来自你/u, '私域回响')
}

function statusLabelForChapter(
  chapter: AgentBiographyChapter,
  revision: BiographyChapterRevision | null,
  compileStatus: BiographyCompileStatus | null,
): BiographyDirectoryStatusLabel {
  if ((revision?.later_notes?.length ?? 0) > 0) return '后来补记'
  if (!revision?.body) return '暂存片段'
  if (chapter.status === 'ACTIVE' && (compileStatus === 'WRITING' || compileStatus === 'AUDITING')) {
    return '正在书写'
  }
  if (chapter.status === 'ACTIVE') return '正在书写'
  return '已经定稿'
}

function effectToAxis(effect: BiographyMaterialEffect): string {
  switch (effect) {
    case 'SELF_EXPRESSION':
      return 'SELF_EXPRESSION'
    case 'SOCIAL_POSITION':
      return 'SOCIAL_POSITION'
    case 'RELATIONSHIP_PATTERN':
      return 'RELATIONSHIP_PATTERN'
    case 'INNER_TENDENCY':
      return 'INNER_TENDENCY'
    case 'PUBLIC_PERSONA':
      return 'PUBLIC_PERSONA'
    case 'STABLE_TRAIT':
      return 'SELF_EXPRESSION'
    case 'UNRESOLVED_HOOK':
    default:
      return 'INNER_TENDENCY'
  }
}

function materialDominantAxis(material: BiographyMaterial): string {
  return effectToAxis(material.possible_effects[0] ?? 'SELF_EXPRESSION')
}

function relationSignalText(count: number, label: string): string {
  if (count <= 0) return ''
  return `${label}形成了 ${count} 条有效关系线`
}

function describeRelationState(state: string): string {
  switch (state) {
    case 'effective':
      return '稳定、可往复的'
    case 'shadow':
      return '正在成形的'
    case 'inactive':
      return '曾经有效但已经回落的'
    case 'blocked':
      return '被迫中断的'
    default:
      return '稳定的'
  }
}

function buildRevisionId(chapterId: string, revisionNo: number): string {
  return `${chapterId}:revision:${revisionNo}`
}

function buildLaterNoteId(chapterId: string, seed: string): string {
  const hash = createHash('sha1').update(seed).digest('hex').slice(0, 8)
  return `${chapterId}:later-note:${hash}`
}

function buildPassAudit(revisionId: string): BiographyFactualAudit {
  return {
    revision_id: revisionId,
    status: 'PASS',
    failure_categories: [],
    unsupported_claims: [],
    private_overreach_claims: [],
    forbidden_lexicon_hits: [],
    invented_abstractions: [],
    invented_entities: [],
    invented_relationships: [],
  }
}

function primaryAuditFailureCategory(audit: BiographyFactualAudit | null): string | null {
  return audit?.failure_categories[0] ?? null
}

function renderMaterialScene(material: BiographyMaterial): string {
  return material.scene?.scene_name ?? material.scene?.scene_type ?? '未命名场景'
}

function buildDegradedViewFromChapter(input: {
  chapter: AgentBiographyChapter
  revision: BiographyChapterRevision | null
  compileStatus: BiographyCompileStatus | null
}): BiographyChapterViewModel {
  const body = input.revision?.body ?? buildDeterministicChapterBody({
    writer_config: DEFAULT_WRITER_CONFIG,
    book_memory: {
      agent_id: input.chapter.agent_id,
      updated_at: input.chapter.updated_at,
      stable_traits: input.chapter.skeleton.sediments.stable_traits,
      recurring_themes: input.chapter.skeleton.sediments.public_impression,
      expression_patterns: input.chapter.skeleton.writer_notes.style_hints,
      relationship_patterns: [],
      current_life_phase: input.chapter.skeleton.mainline.thesis,
      unresolved_hooks: input.chapter.skeleton.sediments.unresolved_hooks.map((hook, index) => ({
        hook_id: `${input.chapter.id}:hook:${index}`,
        description: hook,
        first_seen_chapter_id: input.chapter.id,
        last_seen_chapter_id: input.chapter.id,
      })),
      recent_chapter_index: [],
    },
    previous_chapter_digest: null,
    current_chapter_skeleton: input.chapter.skeleton,
    current_material_digest: {
      agent_id: input.chapter.agent_id,
      from: input.chapter.start_at,
      to: input.chapter.end_at ?? input.chapter.updated_at,
      material_count: input.chapter.material_count,
      top_experiences: input.chapter.skeleton.key_experiences.map((item) => ({
        material_id: item.experience_id,
        title: item.title,
        factual_summary: item.what_happened,
        why_it_may_matter: item.why_it_mattered,
        likely_effects: [item.changed_what],
      })),
      repeated_patterns: input.chapter.skeleton.sediments.acquired_habits,
      relationship_signals: [],
      private_influence_signals: [],
      achievement_signals: [],
      possible_turning_points: input.chapter.skeleton.turning_points.map((item, index) => ({
        material_id: `${input.chapter.id}:turning:${index}`,
        title: item.title,
        before: item.before,
        after: item.after,
      })),
    },
    tone_profile: {
      tone_profile_id: input.chapter.skeleton.writer_notes.tone_profile_id,
      agent_id: input.chapter.agent_id,
      updated_at: input.chapter.updated_at,
      narrative_distance: 'MEDIUM',
      emotional_temperature: 'WARM',
      rhythm: 'BALANCED',
      imagery: 'MEDIUM',
      humor: 'NONE',
      self_awareness: 'MEDIUM',
      metaphor_density: 'LOW',
      preferred_motifs: [],
      avoid_patterns: input.chapter.skeleton.writer_notes.avoid_patterns,
    },
  })
  return {
    chapter_id: input.chapter.id,
    chapter_no: input.chapter.chapter_no,
    title: input.chapter.title ?? input.chapter.skeleton.book_position.chapter_title,
    subtitle: input.chapter.subtitle ?? input.chapter.skeleton.book_position.chapter_subtitle,
    status_label: statusLabelForChapter(input.chapter, input.revision, input.compileStatus),
    epigraph: body.epigraph,
    opening: body.opening,
    body_sections: body.body_sections,
    turning_point: body.turning_point,
    afterword: body.afterword,
    closing_line: body.closing_line,
    trace_text: body.trace_text,
    margin_notes: body.margin_notes,
    later_notes: input.revision?.later_notes,
  }
}

export interface AgentBiographyServiceDeps {
  repo: AgentBiographyRepository
  agentRepo: AgentRepository
  agentService: AgentService
  achievementRepo: AchievementRepository
  chronicleRepo: ChronicleRepository
  relationRepo?: RelationRepository | null
  worldviewService: AgentBioWorldviewService
  inferenceProfileService: InferenceProfileService
  writerService: BiographyWriterService
  factualAuditService: BiographyFactualAuditService
}

export class AgentBiographyService {
  private readonly pendingCompiles = new Map<string, Promise<AgentBiographyBookViewModel | null>>()
  private ownerLifeOverviewService: Pick<OwnerLifeOverviewService, 'getLifeOverview' | 'getChronicleFeed'> | null = null

  constructor(private readonly deps: AgentBiographyServiceDeps) {}

  attachRuntimeDeps(input: {
    ownerLifeOverviewService?: Pick<OwnerLifeOverviewService, 'getLifeOverview' | 'getChronicleFeed'> | null
  }): void {
    if (input.ownerLifeOverviewService !== undefined) {
      this.ownerLifeOverviewService = input.ownerLifeOverviewService ?? null
    }
  }

  async getBook(input: {
    agent_id: string
    chapter_id?: string | null
  }): Promise<AgentBiographyBookViewModel | null> {
    const agent = this.deps.agentRepo.findById(input.agent_id)
    if (!agent) return null

    const state = await this.ensureCompileState(input.agent_id)
    const published = await this.deps.repo.getPublishedBookView(input.agent_id)
    if (published) {
      if (state.dirty || !published.current_chapter || input.chapter_id) {
        this.queueCompensation(input.agent_id)
      }
      if (input.chapter_id && published.current_chapter?.chapter_id !== input.chapter_id) {
        const chapterSpecific = await this.buildPublishedBookView(input.agent_id, input.chapter_id, state, {
          persist: false,
        })
        if (chapterSpecific) return chapterSpecific
      }
      return published
    }

    await this.markDirty(input.agent_id, 'page_open_compensation')
    this.queueCompensation(input.agent_id)
    return this.buildTransitionalBookView(input.agent_id, input.chapter_id ?? null)
  }

  async recordReadTelemetry(event: AgentBiographyReadTelemetryEvent): Promise<void> {
    await this.deps.repo.recordReadTelemetry(event)
  }

  async markDirty(agentId: string, reason: string, now = new Date()): Promise<AgentBiographyCompileState> {
    const current = await this.ensureCompileState(agentId)
    const dirtyReasons = unique([...current.dirty_reasons, reason]).slice(-8)
    return this.deps.repo.saveCompileState({
      ...current,
      dirty: true,
      dirty_reasons: dirtyReasons,
      compile_status: 'DIRTY',
      stale_since: current.stale_since ?? now.toISOString(),
      last_error: current.last_error ?? null,
    })
  }

  async processDirtySweep(input: {
    now: Date
    limit: number
  }): Promise<{ scanned: number; refreshed: number; skipped: number }> {
    const dirtyStates = await this.deps.repo.listDirtyCompileStates({ limit: input.limit })
    let refreshed = 0
    let skipped = 0

    for (const state of dirtyStates) {
      try {
        const result = await this.compileAgent(state.agent_id, { reason: 'hourly_dirty_sweep', now: input.now })
        if (result) refreshed += 1
        else skipped += 1
      } catch {
        skipped += 1
      }
    }

    return {
      scanned: dirtyStates.length,
      refreshed,
      skipped,
    }
  }

  async compileAgent(
    agentId: string,
    opts: {
      reason: string
      now?: Date
      force?: boolean
    },
  ): Promise<AgentBiographyBookViewModel | null> {
    const pending = this.pendingCompiles.get(agentId)
    if (pending) return pending

    const run = this.runCompile(agentId, opts)
    this.pendingCompiles.set(agentId, run)
    try {
      return await run
    } finally {
      if (this.pendingCompiles.get(agentId) === run) {
        this.pendingCompiles.delete(agentId)
      }
    }
  }

  private queueCompensation(agentId: string): void {
    if (this.pendingCompiles.has(agentId)) return
    setTimeout(() => {
      void this.compileAgent(agentId, {
        reason: 'page_open_compensation',
        now: new Date(),
      }).catch((error) => {
        console.error('[AgentBiographyService] page-open compensation failed:', error)
      })
    }, 0)
  }

  private async runCompile(
    agentId: string,
    opts: {
      reason: string
      now?: Date
      force?: boolean
    },
  ): Promise<AgentBiographyBookViewModel | null> {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) return null

    const now = opts.now ?? new Date()
    const compileState = await this.ensureCompileState(agentId)
    if (!opts.force && !compileState.dirty && compileState.compile_status === 'CLEAN') {
      return this.deps.repo.getPublishedBookView(agentId)
    }

    await this.deps.repo.saveCompileState({
      ...compileState,
      compile_status: 'PLANNING',
      dirty: true,
      last_error: null,
    })

    try {
      const worldview = await this.deps.worldviewService.compile(agentId, now)
      const narrative = await this.deps.inferenceProfileService.getNarrative(agentId).catch(() => null)
      const materials = await this.normalizeMaterials({
        agent_id: agentId,
        worldview,
        narrative,
        now,
      })
      const digest = this.buildMaterialDigest(agentId, materials)
      const chapters = await this.planAndPersistChapters({
        agent_id: agentId,
        materials,
        digest,
        worldview,
        narrative,
        state: compileState,
        now,
      })
      const toneProfile = await this.persistToneProfile(agentId, worldview, narrative, now)
      const bookMemory = await this.persistBookMemory(agentId, chapters, now)
      await this.applyLaterNoteIfNeeded({
        chapters,
        digest,
        toneProfile,
        bookMemory,
      })
      const publishedView = await this.buildPublishedBookView(agentId, null, {
        ...compileState,
        dirty: false,
        dirty_reasons: [],
        compile_status: 'PUBLISHED',
        latest_material_digest: digest,
        last_material_id: materials[0]?.id ?? compileState.last_material_id,
        last_compiled_material_id: materials[0]?.id ?? compileState.last_compiled_material_id,
        active_chapter_id: chapters.find((item) => item.status === 'ACTIVE')?.id ?? compileState.active_chapter_id,
        skeleton_revision: chapters.length,
        published_body_revision:
          chapters
            .map((item) => item.current_revision_id)
            .filter((item): item is string => Boolean(item))
            .length,
        stale_since: null,
        last_compiled_at: now.toISOString(),
        last_error: null,
      })
      if (!publishedView) {
        throw new Error('agent_biography_publish_failed')
      }
      await this.deps.repo.saveCompileState({
        ...compileState,
        dirty: false,
        dirty_reasons: [],
        compile_status: 'CLEAN',
        latest_material_digest: digest,
        last_material_id: materials[0]?.id ?? compileState.last_material_id,
        last_compiled_material_id: materials[0]?.id ?? compileState.last_compiled_material_id,
        active_chapter_id: chapters.find((item) => item.status === 'ACTIVE')?.id ?? compileState.active_chapter_id,
        skeleton_revision: chapters.length,
        published_body_revision:
          chapters
            .map((item) => item.current_revision_id)
            .filter((item): item is string => Boolean(item))
            .length,
        stale_since: null,
        last_compiled_at: now.toISOString(),
        last_error: null,
      })
      return publishedView
    } catch (error) {
      await this.deps.repo.saveCompileState({
        ...compileState,
        dirty: true,
        compile_status: 'FAILED',
        last_error: error instanceof Error ? error.message : 'agent_biography_compile_failed',
        stale_since: compileState.stale_since ?? now.toISOString(),
      })
      const fallback = await this.deps.repo.getPublishedBookView(agentId)
      return fallback ?? this.buildTransitionalBookView(agentId, null)
    }
  }

  private async normalizeMaterials(input: {
    agent_id: string
    worldview: WorldviewCompile
    narrative: PersonalityNarrative | null
    now: Date
  }): Promise<BiographyMaterial[]> {
    const chroniclePage = await this.deps.chronicleRepo.findByAgent(input.agent_id, {
      limit: 60,
      cursor: undefined,
    })
    const achievementPage = await this.deps.achievementRepo.findByAgent(input.agent_id, {
      limit: 30,
      cursor: undefined,
    })
    const relationPage = this.deps.relationRepo
      ? await this.deps.relationRepo.listMutualEffective(input.agent_id, { limit: 6, cursor: undefined })
      : { items: [], next_cursor: null }
    const latestOccurredAt =
      chroniclePage.items[0]?.occurred_at.toISOString()
      ?? achievementPage.items[0]?.achieved_at.toISOString()
      ?? input.now.toISOString()

    const persisted: BiographyMaterial[] = []

    const resolveActor = (id: string) => {
      const agent = this.deps.agentRepo.findById(id)
      return {
        id,
        name: agent?.display_name,
        role: id === input.agent_id ? 'SELF' : 'PEER_AGENT',
      } as BiographyMaterial['actors'][number]
    }

    const chronicleMaterials = chroniclePage.items.map((entry) => {
      const sourceType: BiographyMaterialSourceType =
        entry.type === 'PRIVATE_DIGEST'
          ? 'PRIVATE_DIGEST'
          : entry.type === 'RELATION_CHANGE'
            ? 'RELATION_EVENT'
            : entry.type === 'MODERATION'
              ? 'SYSTEM_TUNING'
              : entry.visibility === 'PUBLIC'
                ? 'PUBLIC_DISCUSSION'
                : 'CHRONICLE_ENTRY'
      const material: BiographyMaterial = {
        id: '',
        agent_id: input.agent_id,
        source_type: sourceType,
        source_id: entry.id,
        occurred_at: entry.occurred_at.toISOString(),
        title: entry.title,
        factual_summary:
          entry.type === 'PRIVATE_DIGEST'
            ? '一段更私密的互动留下了余温，并在后续表达里持续发酵。'
            : entry.summary,
        actors: [resolveActor(input.agent_id), ...entry.actors.map((actorId) => resolveActor(actorId))].slice(0, 4),
        scene: entry.location
          ? {
              scene_name: entry.location,
              scene_type: entry.type === 'PRIVATE_DIGEST' ? 'PRIVATE_CHAT' : 'PUBLIC_FORUM',
            }
          : undefined,
        possible_effects:
          entry.type === 'RELATION_CHANGE'
            ? ['RELATIONSHIP_PATTERN', 'SOCIAL_POSITION']
            : entry.type === 'PRIVATE_DIGEST'
              ? ['INNER_TENDENCY', 'SELF_EXPRESSION']
              : entry.type === 'MODERATION'
                ? ['PUBLIC_PERSONA', 'UNRESOLVED_HOOK']
                : entry.visibility === 'PUBLIC'
                  ? ['PUBLIC_PERSONA', 'SELF_EXPRESSION']
                  : ['SELF_EXPRESSION'],
        importance_score: entry.importance_score,
        can_be_turning_point: entry.importance_score >= 0.78 || entry.type !== 'HIGHLIGHT',
        can_be_later_note: entry.type === 'PRIVATE_DIGEST' || entry.type === 'RELATION_CHANGE',
        biography_hint:
          entry.story_context?.outcome_sentence
          ?? entry.story_context?.reaction_sentence
          ?? entry.story_context?.next_hook
          ?? undefined,
        deferred_source: false,
        raw_ref: {
          source_type: entry.type,
          source_id: entry.id,
        },
      }
      return material
    })

    const achievementMaterials = achievementPage.items.map((entry) => ({
      id: '',
      agent_id: input.agent_id,
      source_type: 'ACHIEVEMENT' as const,
      source_id: entry.id,
      occurred_at: entry.achieved_at.toISOString(),
      title: entry.name,
      factual_summary: `拿到了「${entry.name}」这枚印记，它把某种长期特征固定成了可被辨认的成果。`,
      actors: [resolveActor(input.agent_id)],
      possible_effects: ['STABLE_TRAIT', 'PUBLIC_PERSONA'] as BiographyMaterialEffect[],
      importance_score: 0.55 + entry.tier * 0.1,
      can_be_turning_point: entry.tier >= 2,
      can_be_later_note: false,
      deferred_source: false,
      raw_ref: {
        source_type: 'ACHIEVEMENT',
        source_id: entry.id,
      },
    }))

    const relationMaterials = relationPage.items.map((entry) => ({
      id: '',
      agent_id: input.agent_id,
      source_type: 'RELATION_EVENT' as const,
      source_id: entry.id,
      occurred_at: entry.updated_at.toISOString(),
      title: `和 ${this.deps.agentRepo.findById(entry.to_agent_id)?.display_name ?? '某位角色'} 的关系定型`,
      factual_summary: `和 ${this.deps.agentRepo.findById(entry.to_agent_id)?.display_name ?? '某位角色'} 之间形成了 ${describeRelationState(entry.state)}关系状态。`,
      actors: [resolveActor(input.agent_id), resolveActor(entry.to_agent_id)],
      possible_effects: ['RELATIONSHIP_PATTERN', 'SOCIAL_POSITION'] as BiographyMaterialEffect[],
      importance_score: 0.62,
      can_be_turning_point: true,
      can_be_later_note: true,
      deferred_source: false,
      raw_ref: {
        source_type: 'RELATION',
        source_id: entry.id,
      },
    }))

    const worldviewMaterials = unique(
      [
        ...(input.worldview?.worldview.owner_history.private_memory_summaries ?? []).map((summary) => ({
          id: '',
          agent_id: input.agent_id,
          source_type: 'PRIVATE_DIGEST' as const,
          source_id: `private-summary:${createHash('sha1').update(summary).digest('hex').slice(0, 10)}`,
          occurred_at: latestOccurredAt,
          title: '私域影响余波',
          factual_summary: summary,
          actors: [resolveActor(input.agent_id)],
          possible_effects: ['INNER_TENDENCY', 'SELF_EXPRESSION'] as BiographyMaterialEffect[],
          importance_score: 0.34,
          can_be_turning_point: false,
          can_be_later_note: true,
          deferred_source: true,
          raw_ref: {
            source_type: 'PRIVATE_SUMMARY',
            source_id: summary,
          },
        })),
        ...(input.narrative
          ? [
              {
                id: '',
                agent_id: input.agent_id,
                source_type: 'PERSONALITY_NARRATIVE' as const,
                source_id: 'inference-profile:narrative',
                occurred_at: latestOccurredAt,
                title: '人格叙事',
                factual_summary: input.narrative.summary,
                actors: [resolveActor(input.agent_id)],
                possible_effects: ['SELF_EXPRESSION', 'STABLE_TRAIT'] as BiographyMaterialEffect[],
                importance_score: 0.42,
                can_be_turning_point: false,
                can_be_later_note: false,
                deferred_source: false,
                raw_ref: {
                  source_type: 'PERSONALITY_NARRATIVE',
                  source_id: 'inference-profile:narrative',
                },
              },
            ]
          : []),
      ],
    )

    for (const material of [...chronicleMaterials, ...achievementMaterials, ...relationMaterials, ...worldviewMaterials]) {
      const saved = await this.deps.repo.saveMaterial(material)
      persisted.push(saved)
    }

    return persisted.sort((left, right) => {
      const diff = Date.parse(right.occurred_at) - Date.parse(left.occurred_at)
      return diff !== 0 ? diff : right.importance_score - left.importance_score
    })
  }

  private buildMaterialDigest(agentId: string, materials: BiographyMaterial[]): BiographyMaterialDigest {
    const sorted = materials.slice().sort((left, right) => Date.parse(left.occurred_at) - Date.parse(right.occurred_at))
    const from = sorted[0]?.occurred_at ?? new Date().toISOString()
    const to = sorted[sorted.length - 1]?.occurred_at ?? from
    return {
      agent_id: agentId,
      from,
      to,
      material_count: materials.length,
      top_experiences: materials.slice(0, 4).map((item) => ({
        material_id: item.id,
        title: item.title,
        factual_summary: item.factual_summary,
        why_it_may_matter: item.biography_hint ?? item.factual_summary,
        likely_effects: item.possible_effects.map((effect) => effectToAxis(effect)),
      })),
      repeated_patterns: unique(materials.flatMap((item) => item.possible_effects.map((effect) => effectToAxis(effect)))).slice(0, 4),
      relationship_signals: materials
        .filter((item) => item.source_type === 'RELATION_EVENT')
        .slice(0, 3)
        .map((item) => ({
          actor_id: item.actors[1]?.id,
          actor_name: item.actors[1]?.name,
          signal: item.factual_summary,
          possible_change: item.biography_hint ?? item.title,
        })),
      private_influence_signals: materials
        .filter((item) => item.source_type === 'PRIVATE_DIGEST')
        .slice(0, 3)
        .map((item) => ({
          source_label: item.title,
          influence_summary: item.factual_summary,
          biography_safe_summary: ensureSentence(item.factual_summary),
        })),
      achievement_signals: materials
        .filter((item) => item.source_type === 'ACHIEVEMENT')
        .slice(0, 3)
        .map((item) => ({
          achievement_id: item.source_id,
          title: item.title,
          as_biography_trace: item.factual_summary,
        })),
      possible_turning_points: materials
        .filter((item) => item.can_be_turning_point)
        .slice(0, 3)
        .map((item) => ({
          material_id: item.id,
          title: item.title,
          before: item.possible_effects[0] ?? '未命名状态',
          after: item.possible_effects[1] ?? item.possible_effects[0] ?? '未命名状态',
        })),
    }
  }

  private async planAndPersistChapters(input: {
    agent_id: string
    materials: BiographyMaterial[]
    digest: BiographyMaterialDigest
    worldview: WorldviewCompile
    narrative: PersonalityNarrative | null
    state: AgentBiographyCompileState
    now: Date
  }): Promise<AgentBiographyChapter[]> {
    const existing = await this.deps.repo.listChapters(input.agent_id)
    const sortedAsc = input.materials
      .slice()
      .sort((left, right) => Date.parse(left.occurred_at) - Date.parse(right.occurred_at))

    const plannedGroups =
      existing.length === 0
        ? this.partitionMaterials(sortedAsc)
        : (() => {
            const closed = existing.filter((item) => item.status !== 'ACTIVE')
            const active = existing.find((item) => item.status === 'ACTIVE') ?? existing[existing.length - 1]
            const relevant = sortedAsc.filter((item) => Date.parse(item.occurred_at) >= Date.parse(active.start_at))
            const nextGroups = this.partitionMaterials(relevant)
            return [
              ...(closed.map((item) =>
                sortedAsc.filter((material) =>
                  Date.parse(material.occurred_at) >= Date.parse(item.start_at)
                  && Date.parse(material.occurred_at) <= (parseDate(item.end_at) || Number.MAX_SAFE_INTEGER),
                ))),
              ...nextGroups,
            ].filter((group) => group.length > 0)
          })()

    const nextChapters: AgentBiographyChapter[] = []
    const previousByNumber = new Map(existing.map((item) => [item.chapter_no, item]))

    for (const [index, group] of plannedGroups.entries()) {
      const chapterNo = index + 1
      const previous = previousByNumber.get(chapterNo)
      const status =
        index === plannedGroups.length - 1
          ? 'ACTIVE'
          : previous?.status === 'REVISED'
            ? 'REVISED'
            : 'CLOSED'
      const skeleton = this.buildChapterSkeleton({
        agent_id: input.agent_id,
        chapter_no: chapterNo,
        status,
        materials: group,
        digest: input.digest,
        worldview: input.worldview,
        narrative: input.narrative,
        tone_profile_id: 'default',
        now: input.now,
      })
      const chapter: AgentBiographyChapter = await this.deps.repo.saveChapter({
        id: previous?.id ?? '',
        agent_id: input.agent_id,
        chapter_no: chapterNo,
        status,
        title: skeleton.book_position.chapter_title,
        subtitle: skeleton.book_position.chapter_subtitle ?? null,
        start_at: group[0]?.occurred_at ?? input.now.toISOString(),
        end_at: status === 'ACTIVE' ? null : group[group.length - 1]?.occurred_at ?? null,
        skeleton,
        current_revision_id: previous?.current_revision_id ?? null,
        material_count: group.length,
        chapter_digest: this.buildChapterDigest(skeleton, chapterNo, previous?.id ?? `${input.agent_id}:chapter:${chapterNo}`),
        created_at: previous?.created_at ?? input.now.toISOString(),
        updated_at: input.now.toISOString(),
      })
      await this.deps.repo.replaceMaterialRefs(
        chapter.id,
        group.map((item, refIndex) => ({
          id: `${chapter.id}:ref:${refIndex}`,
          chapter_id: chapter.id,
          agent_id: input.agent_id,
          material_id: item.id,
          source_type: item.source_type,
          source_id: item.source_id,
          material_role:
            refIndex === 0
              ? 'TRIGGER'
              : item.can_be_turning_point
                ? 'TURNING_POINT'
                : 'SUPPORT',
          importance_score: item.importance_score,
          contribution_summary: item.factual_summary,
          occurred_at: item.occurred_at,
          created_at: input.now.toISOString(),
        })),
      )
      nextChapters.push(chapter)
    }

    for (const chapter of nextChapters) {
      await this.ensureChapterRevisionPublished({
        chapter,
        digest: input.digest,
        chapters: nextChapters,
      })
    }

    return await this.deps.repo.listChapters(input.agent_id)
  }

  private partitionMaterials(materials: BiographyMaterial[]): BiographyMaterial[][] {
    if (materials.length === 0) return []
    const groups: BiographyMaterial[][] = []
    let current: BiographyMaterial[] = []
    let currentAxis: string | null = null

    for (const material of materials) {
      const axis = materialDominantAxis(material)
      const boundary =
        current.length >= 4
        || (
          current.length >= 2
          && material.can_be_turning_point
          && material.importance_score >= 0.78
        )
        || (
          current.length >= 3
          && currentAxis !== null
          && axis !== currentAxis
          && material.importance_score >= 0.68
        )

      if (boundary && current.length > 0) {
        groups.push(current)
        current = []
      }
      current.push(material)
      currentAxis = axis
    }

    if (current.length > 0) {
      groups.push(current)
    }

    return groups
  }

  private buildChapterSkeleton(input: {
    agent_id: string
    chapter_no: number
    status: AgentBiographyChapter['status']
    materials: BiographyMaterial[]
    digest: BiographyMaterialDigest
    worldview: WorldviewCompile
    narrative: PersonalityNarrative | null
    tone_profile_id: string
    now: Date
  }): AgentBiographyChapterSkeletonV1 {
    const first = input.materials[0]
    const last = input.materials[input.materials.length - 1]
    const dominantAxis = materialDominantAxis(input.materials[0] ?? first)
    const title =
      input.materials.find((item) => item.can_be_turning_point)?.title
      ?? input.materials[0]?.title
      ?? `第 ${input.chapter_no} 章`
    const role: BiographyChapterRole =
      input.chapter_no === 1
        ? 'OPENING'
        : input.chapter_no === 2
          ? 'FORMATION'
          : input.materials.some((item) => item.can_be_turning_point)
            ? 'TURNING_POINT'
            : 'CONSOLIDATION'

    const stableTraits = unique(
      input.materials.flatMap((item) =>
        item.possible_effects
          .filter((effect) => effect === 'STABLE_TRAIT' || effect === 'SELF_EXPRESSION')
          .map(() => item.title),
      ),
    ).slice(0, 3)

    const unresolvedHooks = unique(
      [
        ...input.digest.possible_turning_points.map((item) => item.title),
        ...(input.narrative?.bullets ?? []),
      ],
    ).slice(0, 3)

    return {
      version: 1,
      agent_id: input.agent_id,
      chapter_id: `${input.agent_id}:chapter:${input.chapter_no}`,
      chapter_no: input.chapter_no,
      status: input.status,
      created_at: input.now.toISOString(),
      updated_at: input.now.toISOString(),
      time_range: {
        from: first?.occurred_at ?? input.now.toISOString(),
        to: last?.occurred_at ?? null,
      },
      book_position: {
        volume_title: `${this.readCurrentLifePhase(input.worldview, input.narrative)} 卷`,
        chapter_title: clip(title, 28),
        chapter_subtitle: clip(input.narrative?.growthNote ?? input.digest.repeated_patterns[0] ?? '', 40) || undefined,
        chapter_role: role,
      },
      mainline: {
        thesis:
          dominantAxis === 'RELATIONSHIP_PATTERN'
            ? '她开始把关系视为真正会改变自己的力量'
            : dominantAxis === 'PUBLIC_PERSONA'
              ? '她在公开场里第一次显露出可被记住的轮廓'
              : dominantAxis === 'INNER_TENDENCY'
                ? '更内里的波动开始反过来改变她的表达'
                : '她在反复经历里慢慢换了一种活法',
        question: unresolvedHooks[0],
        emotional_direction: input.narrative?.stageNote ?? input.narrative?.growthNote ?? undefined,
        narrative_mode:
          input.digest.private_influence_signals.length > 0 ? 'QUIET_REFLECTION' : 'SCENE_DRIVEN',
      },
      start_state: {
        self_expression: ensureSentence(first?.factual_summary ?? input.worldview?.worldview.identity.visible_style ?? '她仍旧维持着原来的表达方式'),
        social_position: relationSignalText(input.worldview?.worldview.relations.mutual_effective ?? 0, '公开场里'),
        relationship_pattern: relationSignalText(input.worldview?.worldview.relations.following_effective ?? 0, '她'),
        inner_tendency: input.worldview?.worldview.owner_history.dominant_private_sentiment ?? undefined,
        public_persona: input.worldview?.worldview.public_history.tagline ?? undefined,
      },
      key_experiences: input.materials.slice(0, 3).map((item) => ({
        experience_id: item.id,
        title: item.title,
        scene: renderMaterialScene(item),
        what_happened: item.factual_summary,
        why_it_mattered: item.biography_hint ?? item.factual_summary,
        changed_what: effectToAxis(item.possible_effects[0] ?? 'SELF_EXPRESSION') as
          AgentBiographyChapterSkeletonV1['key_experiences'][number]['changed_what'],
      })),
      turning_points: input.materials
        .filter((item) => item.can_be_turning_point)
        .slice(0, 2)
        .map((item) => ({
          title: item.title,
          before: first?.factual_summary ?? '前一状态',
          moment: item.factual_summary,
          after: last?.factual_summary ?? item.factual_summary,
        })),
      influences: [
        ...input.digest.relationship_signals.slice(0, 2).map((item) => ({
          source_label: item.actor_name ?? '关系线',
          source_type: 'RELATIONSHIP' as const,
          influence_summary: item.signal,
        })),
        ...input.digest.private_influence_signals.slice(0, 1).map((item) => ({
          source_label: item.source_label,
          source_type: 'PRIVATE_CONVERSATION' as const,
          influence_summary: item.biography_safe_summary,
        })),
        ...input.digest.achievement_signals.slice(0, 1).map((item) => ({
          source_label: item.title,
          source_type: 'ACHIEVEMENT' as const,
          influence_summary: item.as_biography_trace,
        })),
      ].slice(0, 3),
      end_state: {
        self_expression: ensureSentence(last?.factual_summary ?? input.narrative?.summary ?? '她的表达方式已经发生了改变'),
        social_position: relationSignalText(input.worldview?.worldview.relations.followers_effective ?? 0, '现在'),
        relationship_pattern: relationSignalText(input.worldview?.worldview.relations.mutual_effective ?? 0, '她'),
        inner_tendency: input.narrative?.growthNote ?? undefined,
        public_persona: input.worldview?.worldview.public_history.tagline ?? undefined,
      },
      sediments: {
        stable_traits: stableTraits.length > 0 ? stableTraits : input.materials.slice(0, 2).map((item) => item.title),
        acquired_habits: input.digest.repeated_patterns.slice(0, 3),
        relationship_marks: input.digest.relationship_signals.map((item) => item.signal).slice(0, 2),
        public_impression: input.digest.achievement_signals.map((item) => item.title).slice(0, 2),
        unresolved_hooks: unresolvedHooks,
      },
      writer_notes: {
        tone_profile_id: input.tone_profile_id,
        style_hints: [
          input.worldview?.worldview.identity.visible_style ?? '保守纸书编辑感',
          input.narrative?.growthNote ?? '保守传记化',
        ].filter((item) => item.length > 0),
        avoid_patterns: ['直接暴露私聊细节', '管理台式枚举', '时间轴流水账'],
      },
      source_digest: {
        material_count: input.materials.length,
        material_summary: input.digest.top_experiences.map((item) => item.title).join('、'),
      },
    }
  }

  private buildChapterDigest(
    skeleton: AgentBiographyChapterSkeletonV1,
    chapterNo: number,
    chapterId: string,
  ): BiographyChapterDigest {
    return {
      chapter_id: chapterId,
      chapter_no: chapterNo,
      title: skeleton.book_position.chapter_title,
      one_line_summary: ensureSentence(skeleton.mainline.thesis),
      start_state: skeleton.start_state.self_expression,
      end_state: skeleton.end_state.self_expression,
      key_turning_points: skeleton.turning_points.map((item) => item.title).slice(0, 3),
      sediments: unique([
        ...skeleton.sediments.stable_traits,
        ...skeleton.sediments.relationship_marks,
      ]).slice(0, 4),
      unresolved_hooks: skeleton.sediments.unresolved_hooks.slice(0, 3),
      style_notes: skeleton.writer_notes.style_hints.slice(0, 3),
      closing_line: skeleton.mainline.question,
    }
  }

  private async ensureChapterRevisionPublished(input: {
    chapter: AgentBiographyChapter
    digest: BiographyMaterialDigest
    chapters: AgentBiographyChapter[]
  }): Promise<void> {
    const existingRevision = input.chapter.current_revision_id
      ? await this.deps.repo.getRevision(input.chapter.current_revision_id)
      : null
    if (existingRevision?.body && existingRevision.generation_status === 'PUBLISHED') {
      return
    }

    const previousChapter = input.chapters.find((item) => item.chapter_no === input.chapter.chapter_no - 1) ?? null
    const previousDigest = previousChapter?.chapter_digest ?? null
    const toneProfile = await this.deps.repo.getToneProfile(input.chapter.agent_id)
    const bookMemory = await this.deps.repo.getBookMemory(input.chapter.agent_id)
    if (!toneProfile || !bookMemory) {
      return
    }

    const writerInput: BiographyWriterInput = {
      writer_config: DEFAULT_WRITER_CONFIG,
      book_memory: bookMemory,
      previous_chapter_digest: previousDigest,
      current_chapter_skeleton: input.chapter.skeleton,
      current_material_digest: input.digest,
      tone_profile: toneProfile,
    }
    const nextRevisionNo = (await this.deps.repo.listRevisions(input.chapter.id)).length + 1
    const revisionId = buildRevisionId(input.chapter.id, nextRevisionNo)
    const primaryRender = await this.deps.writerService.renderChapter(writerInput)
    let attemptedRender = primaryRender
    let audit = this.deps.factualAuditService.auditChapter({
      revision_id: revisionId,
      writer_input: writerInput,
      body: primaryRender.body,
    })
    let auditFailureCategory = primaryAuditFailureCategory(audit)
    let rescueRenderAttempted = false
    let rescueRenderModelId: string | null = null

    if (audit.status !== 'PASS') {
      rescueRenderAttempted = true
      const rescueRender = await this.deps.writerService.renderChapter(writerInput, {
        allowFallbackWithinLine: false,
        debugModelPin: {
          provider_id: 'moonshot-openai',
          model_id: 'kimi-k2.5',
        },
      })
      const rescueAudit = this.deps.factualAuditService.auditChapter({
        revision_id: revisionId,
        writer_input: writerInput,
        body: rescueRender.body,
      })
      attemptedRender = rescueRender
      rescueRenderModelId = rescueRender.model_name
      audit = rescueAudit
      auditFailureCategory = primaryAuditFailureCategory(rescueAudit) ?? auditFailureCategory
    }

    let publishedBody: BiographyChapterBodyV1 | null
    let generationStatus: BiographyChapterRevision['generation_status']
    const previousPublished = (await this.deps.repo.listRevisions(input.chapter.id))
      .slice()
      .reverse()
      .find((item) => item.generation_status === 'PUBLISHED' && item.body)

    if (audit.status === 'PASS') {
      publishedBody = attemptedRender.body
      generationStatus = 'PUBLISHED'
    } else if (previousPublished?.body) {
      publishedBody = previousPublished.body
      generationStatus = previousPublished.generation_status
    } else {
      publishedBody = buildDeterministicChapterBody(writerInput)
      generationStatus = 'PUBLISHED'
    }

    const revision = await this.deps.repo.saveRevision({
      id: revisionId,
      chapter_id: input.chapter.id,
      agent_id: input.chapter.agent_id,
      revision_no: nextRevisionNo,
      skeleton: input.chapter.skeleton,
      body: publishedBody,
      body_kind: 'CHAPTER',
      later_notes: existingRevision?.later_notes ?? [],
      material_digest: input.digest,
      writer_config_id: DEFAULT_WRITER_CONFIG.config_id,
      model_name: attemptedRender.model_name,
      prompt_template_id: attemptedRender.prompt_template_id,
      prompt_version: attemptedRender.prompt_version,
      prompt_hash: attemptedRender.prompt_hash,
      input_hash: attemptedRender.input_hash,
      generation_status: generationStatus,
      factual_audit: audit,
      published_at: generationStatus === 'PUBLISHED' ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
    })
    const revisionToPublish = revision.generation_status === 'PUBLISHED' ? revision : previousPublished ?? null

    await this.deps.repo.recordWriterTelemetry({
      agent_id: input.chapter.agent_id,
      chapter_id: input.chapter.id,
      revision_id: revision.id,
      prompt_template_id: attemptedRender.prompt_template_id,
      prompt_version: attemptedRender.prompt_version,
      model_name: attemptedRender.model_name,
      provider_id: attemptedRender.provider_id,
      input_hash: attemptedRender.input_hash,
      render_fingerprint: attemptedRender.render_fingerprint,
      publish_status: revision.generation_status,
      audit_status: audit.status,
      privacy_blocked: audit.private_overreach_claims.length > 0,
      unsupported_claim_count: audit.unsupported_claims.length,
      invented_entity_count: audit.invented_entities.length,
      invented_relationship_count: audit.invented_relationships.length,
      repair_applied: attemptedRender.repair_applied,
      repair_rule_hits: attemptedRender.repair_rule_hits,
      rescue_render_attempted: rescueRenderAttempted,
      rescue_render_model_id: rescueRenderModelId,
      audit_failure_category: auditFailureCategory,
      later_note_count: revision.later_notes.length,
      created_at: new Date().toISOString(),
    })

    if (revisionToPublish) {
      await this.deps.repo.saveChapter({
        ...input.chapter,
        current_revision_id: revisionToPublish.id,
        updated_at: new Date().toISOString(),
      })
    }
  }

  private async persistToneProfile(
    agentId: string,
    worldview: WorldviewCompile,
    narrative: PersonalityNarrative | null,
    now: Date,
  ): Promise<BiographyToneProfile> {
    const mood = worldview?.worldview.identity.mood ?? ''
    return this.deps.repo.saveToneProfile({
      tone_profile_id: 'default',
      agent_id: agentId,
      updated_at: now.toISOString(),
      narrative_distance: worldview?.worldview.owner_history.private_memory_summaries.length ? 'CLOSE' : 'MEDIUM',
      emotional_temperature:
        /乐观|warm|热/u.test(mood) ? 'WARM' : /critical|sharp|挑剔/i.test(mood) ? 'SHARP' : 'COOL',
      rhythm: worldview?.worldview.relations.mutual_effective ? 'BALANCED' : 'SHORT',
      imagery: (worldview?.worldview.public_history.top_chronicle_summaries?.length ?? 0) > 1 ? 'MEDIUM' : 'LOW',
      humor: worldview?.worldview.projection.banter_style === 'playful' ? 'LIGHT' : 'NONE',
      self_awareness: narrative?.migrationNote ? 'HIGH' : 'MEDIUM',
      metaphor_density: worldview?.worldview.owner_history.private_memory_summaries.length ? 'MEDIUM' : 'LOW',
      preferred_motifs: unique([
        worldview?.worldview.projection.top_scene ?? '',
        'paper',
        'trace',
      ].filter((item) => item.length > 0)),
      avoid_patterns: ['直接复述原始记录', '系统面板语气'],
      sample_voice_notes: ['qwen-director-v1'],
    })
  }

  private async persistBookMemory(
    agentId: string,
    chapters: AgentBiographyChapter[],
    now: Date,
  ): Promise<BiographyBookMemory> {
    const digests = chapters
      .map((item) => item.chapter_digest)
      .filter((item): item is BiographyChapterDigest => Boolean(item))
    return this.deps.repo.saveBookMemory({
      agent_id: agentId,
      updated_at: now.toISOString(),
      stable_traits: unique(digests.flatMap((item) => item.sediments)).slice(0, 5),
      recurring_themes: unique(digests.map((item) => item.one_line_summary)).slice(0, 4),
      expression_patterns: unique(digests.flatMap((item) => item.style_notes)).slice(0, 4),
      relationship_patterns: unique(digests.flatMap((item) => item.key_turning_points)).slice(0, 3).map((pattern) => ({ pattern })),
      public_position: digests[digests.length - 1]?.end_state,
      private_influence_pattern: digests.find((item) => item.style_notes.length > 0)?.style_notes[0],
      current_life_phase: digests[digests.length - 1]?.one_line_summary ?? '仍在成形',
      unresolved_hooks: unique(digests.flatMap((item) => item.unresolved_hooks)).slice(0, 4).map((hook, index) => ({
        hook_id: `${agentId}:memory-hook:${index}`,
        description: hook,
        first_seen_chapter_id: digests[0]?.chapter_id ?? agentId,
        last_seen_chapter_id: digests[digests.length - 1]?.chapter_id ?? agentId,
      })),
      recent_chapter_index: chapters.slice(-4).map((item) => ({
        chapter_id: item.id,
        chapter_no: item.chapter_no,
        title: item.title ?? item.skeleton.book_position.chapter_title,
        thesis: item.skeleton.mainline.thesis,
        end_state: item.skeleton.end_state.self_expression,
      })),
    })
  }

  private async applyLaterNoteIfNeeded(input: {
    chapters: AgentBiographyChapter[]
    digest: BiographyMaterialDigest
    toneProfile: BiographyToneProfile
    bookMemory: BiographyBookMemory
  }): Promise<void> {
    const active = input.chapters.find((item) => item.status === 'ACTIVE')
    const closed = input.chapters
      .filter((item) => item.status !== 'ACTIVE')
      .sort((left, right) => right.chapter_no - left.chapter_no)[0]
    if (!active || !closed || input.digest.private_influence_signals.length === 0) {
      return
    }

    const currentRevision = closed.current_revision_id
      ? await this.deps.repo.getRevision(closed.current_revision_id)
      : null
    if (!currentRevision?.body || (currentRevision.later_notes?.length ?? 0) > 0) {
      return
    }

    const seed = input.digest.private_influence_signals[0]
    const writerInput: BiographyWriterInput = {
      writer_config: DEFAULT_WRITER_CONFIG,
      book_memory: input.bookMemory,
      previous_chapter_digest: closed.chapter_digest,
      current_chapter_skeleton: closed.skeleton,
      current_material_digest: input.digest,
      tone_profile: input.toneProfile,
    }
    const noteId = buildLaterNoteId(closed.id, seed.biography_safe_summary)
    const rendered = await this.deps.writerService.renderLaterNote({
      writer_input: writerInput,
      note_id: noteId,
      reason: '后来再看，这一章里更早埋下的内在变化已经能够被辨认出来',
      factual_summary: seed.biography_safe_summary,
    })
    const nextRevisionNo = (await this.deps.repo.listRevisions(closed.id)).length + 1
    const revision = await this.deps.repo.saveRevision({
      id: buildRevisionId(closed.id, nextRevisionNo),
      chapter_id: closed.id,
      agent_id: closed.agent_id,
      revision_no: nextRevisionNo,
      skeleton: closed.skeleton,
      body: currentRevision.body,
      body_kind: 'LATER_NOTE',
      later_notes: [...(currentRevision.later_notes ?? []), rendered],
      material_digest: input.digest,
      writer_config_id: DEFAULT_WRITER_CONFIG.config_id,
      model_name: DEFAULT_WRITER_CONFIG.model_name,
      prompt_template_id: 'internal-agent-biography-later-note-render',
      prompt_version: 1,
      prompt_hash: createHash('sha256').update(rendered.text).digest('hex'),
      input_hash: createHash('sha256').update(seed.biography_safe_summary).digest('hex'),
      generation_status: 'PUBLISHED',
      factual_audit: buildPassAudit(buildRevisionId(closed.id, nextRevisionNo)),
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    await this.deps.repo.saveChapter({
      ...closed,
      status: 'REVISED',
      current_revision_id: revision.id,
      updated_at: new Date().toISOString(),
    })
  }

  private async buildPublishedBookView(
    agentId: string,
    chapterId: string | null,
    state: AgentBiographyCompileState,
    opts?: {
      persist?: boolean
    },
  ): Promise<AgentBiographyBookViewModel | null> {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) return null
    const chapters = await this.deps.repo.listChapters(agentId)
    if (chapters.length === 0) return null
    const bookMemory = await this.deps.repo.getBookMemory(agentId)
    const toneProfile = await this.deps.repo.getToneProfile(agentId)
    const cover = this.buildBookCover(agent.display_name, bookMemory, toneProfile)
    const selected = chapters.find((item) => item.id === chapterId)
      ?? chapters.find((item) => item.status === 'ACTIVE')
      ?? chapters[chapters.length - 1]

    const revisions = await Promise.all(chapters.map(async (chapter) => {
      const revision = chapter.current_revision_id ? await this.deps.repo.getRevision(chapter.current_revision_id) : null
      return [chapter.id, revision] as const
    }))
    const revisionMap = new Map(revisions)

    const view: AgentBiographyBookViewModel = {
      agent_id: agentId,
      agent_name: agent.display_name,
      book: cover,
      current_chapter: buildDegradedViewFromChapter({
        chapter: selected,
        revision: revisionMap.get(selected.id) ?? null,
        compileStatus: state.compile_status,
      }),
      chapters: chapters.map((chapter) => ({
        chapter_id: chapter.id,
        chapter_no: chapter.chapter_no,
        title: chapter.title ?? chapter.skeleton.book_position.chapter_title,
        one_line_summary: chapter.chapter_digest?.one_line_summary ?? chapter.skeleton.mainline.thesis,
        status_label: statusLabelForChapter(chapter, revisionMap.get(chapter.id) ?? null, state.compile_status),
        is_current: chapter.id === selected.id,
      })),
      footer_meta: {
        source_line: SOURCE_LINE,
        generated_at: state.last_compiled_at ?? new Date().toISOString(),
        degraded:
          state.compile_status === 'FAILED'
          || !selected.current_revision_id
          || !(revisionMap.get(selected.id)?.body),
      },
    }
    if (opts?.persist !== false) {
      await this.deps.repo.savePublishedBookView(view)
    }
    return view
  }

  private buildBookCover(
    agentName: string,
    memory: BiographyBookMemory | null,
    toneProfile: BiographyToneProfile | null,
  ): BiographyBookCoverViewModel {
    return {
      title: `${agentName} 编年史`,
      subtitle: memory?.recent_chapter_index[0]?.title ?? '人物传记',
      agent_name: agentName,
      current_stage: memory?.current_life_phase ?? '仍在成形',
      cover_line: memory?.private_influence_pattern ?? memory?.public_position ?? '她的变化仍在被一点点写成章。',
      visual_motif: {
        motif_type:
          toneProfile?.preferred_motifs.includes('trace')
            ? 'THREAD'
            : toneProfile?.emotional_temperature === 'WARM'
              ? 'LIGHT'
              : 'PAPER',
        intensity: toneProfile?.metaphor_density === 'HIGH' ? 'HIGH' : 'MEDIUM',
        notes: 'paper-book-editorial',
      },
    }
  }

  private readCurrentLifePhase(
    worldview: WorldviewCompile,
    narrative: PersonalityNarrative | null,
  ): string {
    if (narrative?.growthNote) {
      return clip(narrative.growthNote, 18)
    }
    const presence = worldview?.worldview.presence.bucket ?? 'steady'
    switch (presence) {
      case 'emerging':
        return '初醒阶段'
      case 'warming':
        return '热身阶段'
      case 'reflective':
        return '回身阶段'
      case 'quiet':
        return '静置阶段'
      case 'steady':
      default:
        return '成形阶段'
    }
  }

  private async buildTransitionalBookView(
    agentId: string,
    chapterId: string | null,
  ): Promise<AgentBiographyBookViewModel | null> {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) return null

    if (this.ownerLifeOverviewService) {
      const chapterKey = chapterId?.startsWith('legacy:') ? chapterId.slice('legacy:'.length) : undefined
      const [overview, feed] = await Promise.all([
        this.ownerLifeOverviewService.getLifeOverview(agentId).catch(() => null),
        this.ownerLifeOverviewService.getChronicleFeed(agentId, {
          limit: 8,
          chapter_key: chapterKey,
        }).catch(() => null),
      ])

      if (overview && feed) {
        const currentChapterId = `legacy:${feed.chapter?.chapter_key ?? overview.recent_story_beats[0]?.chapter_key ?? 'current'}`
        const currentBeat = feed.items[0]
        return {
          agent_id: agentId,
          agent_name: agent.display_name,
          book: {
            title: `${agent.display_name} 编年史`,
            subtitle: overview.hero.tagline,
            agent_name: agent.display_name,
            current_stage: overview.now.headline,
            cover_line: overview.hero.supporting_line,
            visual_motif: {
              motif_type: 'PAPER',
              intensity: 'MEDIUM',
              notes: 'legacy-owner-life-overview-mapped',
            },
          },
          current_chapter: {
            chapter_id: currentChapterId,
            chapter_no: 1,
            title: sanitizeLegacyChapterTitle(feed.chapter?.title ?? overview.hero.headline),
            subtitle: feed.chapter?.summary ?? overview.hero.tagline,
            status_label: overview.meta.degraded ? '暂存片段' : '正在书写',
            epigraph: overview.owner_projection.carryover_theme,
            opening: feed.chapter?.opening ?? overview.hero.supporting_line,
            body_sections: (feed.items.length > 0 ? feed.items : overview.recent_story_beats.slice(0, 3)).map((item) => ({
              title: item.title,
              text: ensureSentence(item.summary),
              visual_anchor: item.scene_label ?? undefined,
            })),
            turning_point: currentBeat?.outcome_sentence
              ? {
                  title: currentBeat.title,
                  text: ensureSentence(currentBeat.outcome_sentence),
                }
              : undefined,
            afterword: feed.chapter?.current_resting_point ?? overview.now.next_tendency_label,
            closing_line: overview.owner_projection.public_echo_line,
            trace_text: overview.owner_projection.privacy_mode_note,
            margin_notes: overview.recent_achievement_seals.slice(0, 2).map((seal, index) => ({
              anchor_section_index: index,
              text: ensureSentence(seal.reason_line),
            })),
          },
          chapters: unique(overview.recent_story_beats.map((item) => item.chapter_key)).slice(0, 4).map((key, index) => {
            const beat = overview.recent_story_beats.find((item) => item.chapter_key === key)!
            return {
              chapter_id: `legacy:${key}`,
              chapter_no: index + 1,
              title: sanitizeLegacyChapterTitle(beat.chapter_title),
              one_line_summary: beat.summary,
              status_label: '暂存片段',
              is_current: currentChapterId === `legacy:${key}`,
            }
          }),
          footer_meta: {
            source_line: '由 owner-life-overview / chronicle transitional mapping 生成。',
            generated_at: overview.meta.generated_at,
            degraded: true,
          },
        }
      }
    }

    return {
      agent_id: agentId,
      agent_name: agent.display_name,
      book: {
        title: `${agent.display_name} 编年史`,
        subtitle: '编译中',
        agent_name: agent.display_name,
        current_stage: '资料正在整理',
        cover_line: '旧的 chronicle 面板正在被折叠成一本可阅读的传记。',
        visual_motif: {
          motif_type: 'PAPER',
          intensity: 'LOW',
        },
      },
      current_chapter: null,
      chapters: [],
      footer_meta: {
        source_line: '编译尚未完成，当前显示为降级占位。',
        generated_at: new Date().toISOString(),
        degraded: true,
      },
    }
  }

  private async ensureCompileState(agentId: string): Promise<AgentBiographyCompileState> {
    const existing = await this.deps.repo.getCompileState(agentId)
    if (existing) return existing
    return this.deps.repo.saveCompileState({
      agent_id: agentId,
      dirty: true,
      dirty_reasons: ['bootstrap'],
      last_material_id: null,
      last_compiled_material_id: null,
      active_chapter_id: null,
      skeleton_revision: 0,
      published_body_revision: null,
      compile_status: 'DIRTY',
      latest_material_digest: null,
      stale_since: todayStart().toISOString(),
      last_compiled_at: null,
      last_error: null,
    })
  }
}
