import { Prisma, type PrismaClient } from '@prisma/client'
import type {
  AgentBiographyBookViewModel,
  AgentBiographyChapter,
  AgentBiographyCompileState,
  AgentBiographyReadTelemetryEvent,
  AgentBiographyWriterTelemetryEvent,
  BiographyBookMemory,
  BiographyChapterMaterialRef,
  BiographyChapterRevision,
  BiographyMaterial,
  BiographyToneProfile,
} from '../../../shared/agent-biography.js'
import type { AgentBiographyRepository } from '../agent-biography-repository.js'

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function toMaterial(row: {
  id: string
  agentId: string
  sourceType: string
  sourceId: string
  occurredAt: Date
  title: string
  factualSummary: string
  actorsJson: unknown
  sceneJson: unknown
  possibleEffectsJson: unknown
  importanceScore: number
  canBeTurningPoint: boolean
  canBeLaterNote: boolean
  biographyHint: string | null
  deferredSource: boolean
  rawRefJson: unknown
}): BiographyMaterial {
  return {
    id: row.id,
    agent_id: row.agentId,
    source_type: row.sourceType as BiographyMaterial['source_type'],
    source_id: row.sourceId,
    occurred_at: row.occurredAt.toISOString(),
    title: row.title,
    factual_summary: row.factualSummary,
    actors: toArray<BiographyMaterial['actors'][number]>(row.actorsJson),
    scene: row.sceneJson ? (toRecord(row.sceneJson) as BiographyMaterial['scene']) : undefined,
    possible_effects: toArray<BiographyMaterial['possible_effects'][number]>(row.possibleEffectsJson),
    importance_score: row.importanceScore,
    can_be_turning_point: row.canBeTurningPoint,
    can_be_later_note: row.canBeLaterNote,
    biography_hint: row.biographyHint ?? undefined,
    deferred_source: row.deferredSource,
    raw_ref: toRecord(row.rawRefJson) as BiographyMaterial['raw_ref'],
  }
}

function toChapter(row: {
  id: string
  agentId: string
  chapterNo: number
  status: string
  title: string | null
  subtitle: string | null
  startAt: Date
  endAt: Date | null
  skeletonJson: unknown
  currentRevisionId: string | null
  materialCount: number
  chapterDigestJson: unknown
  createdAt: Date
  updatedAt: Date
}): AgentBiographyChapter {
  return {
    id: row.id,
    agent_id: row.agentId,
    chapter_no: row.chapterNo,
    status: row.status as AgentBiographyChapter['status'],
    title: row.title,
    subtitle: row.subtitle ?? null,
    start_at: row.startAt.toISOString(),
    end_at: row.endAt?.toISOString() ?? null,
    skeleton: toRecord(row.skeletonJson) as AgentBiographyChapter['skeleton'],
    current_revision_id: row.currentRevisionId,
    material_count: row.materialCount,
    chapter_digest: row.chapterDigestJson
      ? (toRecord(row.chapterDigestJson) as AgentBiographyChapter['chapter_digest'])
      : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  }
}

function toRevision(row: {
  id: string
  chapterId: string
  agentId: string
  revisionNo: number
  bodyKind: string
  skeletonJson: unknown
  bodyJson: unknown
  laterNotesJson: unknown
  materialDigestJson: unknown
  writerConfigId: string | null
  modelName: string | null
  promptTemplateId: string | null
  promptVersion: number | null
  promptHash: string | null
  inputHash: string | null
  generationStatus: string
  factualAuditJson: unknown
  publishedAt: Date | null
  createdAt: Date
}): BiographyChapterRevision {
  return {
    id: row.id,
    chapter_id: row.chapterId,
    agent_id: row.agentId,
    revision_no: row.revisionNo,
    skeleton: toRecord(row.skeletonJson) as BiographyChapterRevision['skeleton'],
    body: row.bodyJson ? (toRecord(row.bodyJson) as BiographyChapterRevision['body']) : null,
    body_kind: row.bodyKind as BiographyChapterRevision['body_kind'],
    later_notes: toArray<BiographyChapterRevision['later_notes'][number]>(row.laterNotesJson),
    material_digest: row.materialDigestJson
      ? (toRecord(row.materialDigestJson) as BiographyChapterRevision['material_digest'])
      : null,
    writer_config_id: row.writerConfigId,
    model_name: row.modelName,
    prompt_template_id: row.promptTemplateId,
    prompt_version: row.promptVersion,
    prompt_hash: row.promptHash,
    input_hash: row.inputHash,
    generation_status: row.generationStatus as BiographyChapterRevision['generation_status'],
    factual_audit: row.factualAuditJson
      ? (toRecord(row.factualAuditJson) as BiographyChapterRevision['factual_audit'])
      : null,
    published_at: row.publishedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
  }
}

function toRef(row: {
  id: string
  chapterId: string
  agentId: string
  materialId: string
  sourceType: string
  sourceId: string
  materialRole: string
  importanceScore: number | null
  contributionSummary: string | null
  occurredAt: Date
  createdAt: Date
}): BiographyChapterMaterialRef {
  return {
    id: row.id,
    chapter_id: row.chapterId,
    agent_id: row.agentId,
    material_id: row.materialId,
    source_type: row.sourceType,
    source_id: row.sourceId,
    material_role: row.materialRole as BiographyChapterMaterialRef['material_role'],
    importance_score: row.importanceScore,
    contribution_summary: row.contributionSummary,
    occurred_at: row.occurredAt.toISOString(),
    created_at: row.createdAt.toISOString(),
  }
}

function toCompileState(row: {
  agentId: string
  dirty: boolean
  dirtyReasonsJson: unknown
  lastMaterialId: string | null
  lastCompiledMaterialId: string | null
  activeChapterId: string | null
  skeletonRevision: number
  publishedBodyRevision: number | null
  compileStatus: string
  latestMaterialDigestJson: unknown
  staleSince: Date | null
  lastCompiledAt: Date | null
  lastError: string | null
}): AgentBiographyCompileState {
  return {
    agent_id: row.agentId,
    dirty: row.dirty,
    dirty_reasons: toArray<string>(row.dirtyReasonsJson),
    last_material_id: row.lastMaterialId,
    last_compiled_material_id: row.lastCompiledMaterialId,
    active_chapter_id: row.activeChapterId,
    skeleton_revision: row.skeletonRevision,
    published_body_revision: row.publishedBodyRevision,
    compile_status: row.compileStatus as AgentBiographyCompileState['compile_status'],
    latest_material_digest: row.latestMaterialDigestJson
      ? (toRecord(row.latestMaterialDigestJson) as AgentBiographyCompileState['latest_material_digest'])
      : null,
    stale_since: row.staleSince?.toISOString() ?? null,
    last_compiled_at: row.lastCompiledAt?.toISOString() ?? null,
    last_error: row.lastError,
  }
}

function toBookMemory(row: {
  agentId: string
  memoryJson: unknown
}): BiographyBookMemory {
  return toRecord(row.memoryJson) as BiographyBookMemory
}

function toToneProfile(row: {
  agentId: string
  toneProfileId: string
  profileJson: unknown
}): BiographyToneProfile {
  const json = toRecord(row.profileJson)
  return {
    tone_profile_id: row.toneProfileId,
    agent_id: row.agentId,
    ...(json as Omit<BiographyToneProfile, 'tone_profile_id' | 'agent_id'>),
  }
}

export class PgAgentBiographyRepository implements AgentBiographyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async hydrate(): Promise<void> {}

  async findMaterialBySource(
    agentId: string,
    sourceType: BiographyMaterial['source_type'],
    sourceId: string,
  ): Promise<BiographyMaterial | null> {
    const row = await this.prisma.agentBiographyMaterial.findFirst({
      where: { agentId, sourceType, sourceId },
    })
    return row ? toMaterial(row) : null
  }

  async saveMaterial(material: BiographyMaterial): Promise<BiographyMaterial> {
    const existing = await this.prisma.agentBiographyMaterial.findFirst({
      where: {
        agentId: material.agent_id,
        sourceType: material.source_type,
        sourceId: material.source_id,
      },
    })
    const row = existing
      ? await this.prisma.agentBiographyMaterial.update({
          where: { id: existing.id },
          data: {
            occurredAt: new Date(material.occurred_at),
            title: material.title,
            factualSummary: material.factual_summary,
            actorsJson: toJsonInput(material.actors),
            sceneJson: material.scene ? toJsonInput(material.scene) : Prisma.JsonNull,
            possibleEffectsJson: toJsonInput(material.possible_effects),
            importanceScore: material.importance_score,
            canBeTurningPoint: material.can_be_turning_point,
            canBeLaterNote: material.can_be_later_note,
            biographyHint: material.biography_hint ?? null,
            deferredSource: material.deferred_source === true,
            rawRefJson: toJsonInput(material.raw_ref),
          },
        })
      : await this.prisma.agentBiographyMaterial.create({
          data: {
            agentId: material.agent_id,
            sourceType: material.source_type,
            sourceId: material.source_id,
            occurredAt: new Date(material.occurred_at),
            title: material.title,
            factualSummary: material.factual_summary,
            actorsJson: toJsonInput(material.actors),
            sceneJson: material.scene ? toJsonInput(material.scene) : Prisma.JsonNull,
            possibleEffectsJson: toJsonInput(material.possible_effects),
            importanceScore: material.importance_score,
            canBeTurningPoint: material.can_be_turning_point,
            canBeLaterNote: material.can_be_later_note,
            biographyHint: material.biography_hint ?? null,
            deferredSource: material.deferred_source === true,
            rawRefJson: toJsonInput(material.raw_ref),
          },
        })
    return toMaterial(row)
  }

  async listMaterials(agentId: string, opts?: { limit?: number }): Promise<BiographyMaterial[]> {
    const rows = await this.prisma.agentBiographyMaterial.findMany({
      where: { agentId },
      orderBy: [{ occurredAt: 'desc' }, { importanceScore: 'desc' }],
      take: opts?.limit,
    })
    return rows.map((row) => toMaterial(row))
  }

  async getCompileState(agentId: string): Promise<AgentBiographyCompileState | null> {
    const row = await this.prisma.agentBiographyCompileState.findUnique({
      where: { agentId },
    })
    return row ? toCompileState(row) : null
  }

  async saveCompileState(state: AgentBiographyCompileState): Promise<AgentBiographyCompileState> {
    const row = await this.prisma.agentBiographyCompileState.upsert({
      where: { agentId: state.agent_id },
      create: {
        agentId: state.agent_id,
        dirty: state.dirty,
        dirtyReasonsJson: toJsonInput(state.dirty_reasons),
        lastMaterialId: state.last_material_id,
        lastCompiledMaterialId: state.last_compiled_material_id,
        activeChapterId: state.active_chapter_id,
        skeletonRevision: state.skeleton_revision,
        publishedBodyRevision: state.published_body_revision,
        compileStatus: state.compile_status,
        latestMaterialDigestJson: state.latest_material_digest
          ? toJsonInput(state.latest_material_digest)
          : Prisma.JsonNull,
        staleSince: state.stale_since ? new Date(state.stale_since) : null,
        lastCompiledAt: state.last_compiled_at ? new Date(state.last_compiled_at) : null,
        lastError: state.last_error ?? null,
      },
      update: {
        dirty: state.dirty,
        dirtyReasonsJson: toJsonInput(state.dirty_reasons),
        lastMaterialId: state.last_material_id,
        lastCompiledMaterialId: state.last_compiled_material_id,
        activeChapterId: state.active_chapter_id,
        skeletonRevision: state.skeleton_revision,
        publishedBodyRevision: state.published_body_revision,
        compileStatus: state.compile_status,
        latestMaterialDigestJson: state.latest_material_digest
          ? toJsonInput(state.latest_material_digest)
          : Prisma.JsonNull,
        staleSince: state.stale_since ? new Date(state.stale_since) : null,
        lastCompiledAt: state.last_compiled_at ? new Date(state.last_compiled_at) : null,
        lastError: state.last_error ?? null,
      },
    })
    return toCompileState(row)
  }

  async listDirtyCompileStates(opts: { limit: number }): Promise<AgentBiographyCompileState[]> {
    const rows = await this.prisma.agentBiographyCompileState.findMany({
      where: { dirty: true },
      orderBy: { updatedAt: 'desc' },
      take: opts.limit,
    })
    return rows.map((row) => toCompileState(row))
  }

  async listChapters(agentId: string): Promise<AgentBiographyChapter[]> {
    const rows = await this.prisma.agentBiographyChapter.findMany({
      where: { agentId },
      orderBy: { chapterNo: 'asc' },
    })
    return rows.map((row) => toChapter(row))
  }

  async getChapter(chapterId: string): Promise<AgentBiographyChapter | null> {
    const row = await this.prisma.agentBiographyChapter.findUnique({
      where: { id: chapterId },
    })
    return row ? toChapter(row) : null
  }

  async saveChapter(chapter: AgentBiographyChapter): Promise<AgentBiographyChapter> {
    const row = chapter.id
      ? await this.prisma.agentBiographyChapter.upsert({
          where: { id: chapter.id },
          create: {
            id: chapter.id,
            agentId: chapter.agent_id,
            chapterNo: chapter.chapter_no,
            status: chapter.status,
            title: chapter.title,
            subtitle: chapter.subtitle,
            startAt: new Date(chapter.start_at),
            endAt: chapter.end_at ? new Date(chapter.end_at) : null,
            skeletonJson: toJsonInput(chapter.skeleton),
            currentRevisionId: chapter.current_revision_id,
            materialCount: chapter.material_count,
            chapterDigestJson: chapter.chapter_digest ? toJsonInput(chapter.chapter_digest) : Prisma.JsonNull,
          },
          update: {
            status: chapter.status,
            title: chapter.title,
            subtitle: chapter.subtitle,
            startAt: new Date(chapter.start_at),
            endAt: chapter.end_at ? new Date(chapter.end_at) : null,
            skeletonJson: toJsonInput(chapter.skeleton),
            currentRevisionId: chapter.current_revision_id,
            materialCount: chapter.material_count,
            chapterDigestJson: chapter.chapter_digest ? toJsonInput(chapter.chapter_digest) : Prisma.JsonNull,
          },
        })
      : await this.prisma.agentBiographyChapter.create({
          data: {
            agentId: chapter.agent_id,
            chapterNo: chapter.chapter_no,
            status: chapter.status,
            title: chapter.title,
            subtitle: chapter.subtitle,
            startAt: new Date(chapter.start_at),
            endAt: chapter.end_at ? new Date(chapter.end_at) : null,
            skeletonJson: toJsonInput(chapter.skeleton),
            currentRevisionId: chapter.current_revision_id,
            materialCount: chapter.material_count,
            chapterDigestJson: chapter.chapter_digest ? toJsonInput(chapter.chapter_digest) : Prisma.JsonNull,
          },
        })
    return toChapter(row)
  }

  async listRevisions(chapterId: string): Promise<BiographyChapterRevision[]> {
    const rows = await this.prisma.biographyChapterRevision.findMany({
      where: { chapterId },
      orderBy: { revisionNo: 'asc' },
    })
    return rows.map((row) => toRevision(row))
  }

  async getRevision(revisionId: string): Promise<BiographyChapterRevision | null> {
    const row = await this.prisma.biographyChapterRevision.findUnique({
      where: { id: revisionId },
    })
    return row ? toRevision(row) : null
  }

  async saveRevision(revision: BiographyChapterRevision): Promise<BiographyChapterRevision> {
    const existing = revision.id
      ? await this.prisma.biographyChapterRevision.findUnique({ where: { id: revision.id } })
      : await this.prisma.biographyChapterRevision.findFirst({
          where: {
            chapterId: revision.chapter_id,
            revisionNo: revision.revision_no,
          },
        })
    const row = existing
      ? await this.prisma.biographyChapterRevision.update({
          where: { id: existing.id },
          data: {
            bodyKind: revision.body_kind,
            skeletonJson: toJsonInput(revision.skeleton),
            bodyJson: revision.body ? toJsonInput(revision.body) : Prisma.JsonNull,
            laterNotesJson: toJsonInput(revision.later_notes),
            materialDigestJson: revision.material_digest ? toJsonInput(revision.material_digest) : Prisma.JsonNull,
            writerConfigId: revision.writer_config_id,
            modelName: revision.model_name,
            promptTemplateId: revision.prompt_template_id,
            promptVersion: revision.prompt_version,
            promptHash: revision.prompt_hash,
            inputHash: revision.input_hash,
            generationStatus: revision.generation_status,
            factualAuditJson: revision.factual_audit ? toJsonInput(revision.factual_audit) : Prisma.JsonNull,
            publishedAt: revision.published_at ? new Date(revision.published_at) : null,
          },
        })
      : await this.prisma.biographyChapterRevision.create({
          data: {
            chapterId: revision.chapter_id,
            agentId: revision.agent_id,
            revisionNo: revision.revision_no,
            bodyKind: revision.body_kind,
            skeletonJson: toJsonInput(revision.skeleton),
            bodyJson: revision.body ? toJsonInput(revision.body) : Prisma.JsonNull,
            laterNotesJson: toJsonInput(revision.later_notes),
            materialDigestJson: revision.material_digest ? toJsonInput(revision.material_digest) : Prisma.JsonNull,
            writerConfigId: revision.writer_config_id,
            modelName: revision.model_name,
            promptTemplateId: revision.prompt_template_id,
            promptVersion: revision.prompt_version,
            promptHash: revision.prompt_hash,
            inputHash: revision.input_hash,
            generationStatus: revision.generation_status,
            factualAuditJson: revision.factual_audit ? toJsonInput(revision.factual_audit) : Prisma.JsonNull,
            publishedAt: revision.published_at ? new Date(revision.published_at) : null,
          },
        })
    return toRevision(row)
  }

  async replaceMaterialRefs(
    chapterId: string,
    refs: BiographyChapterMaterialRef[],
  ): Promise<BiographyChapterMaterialRef[]> {
    await this.prisma.biographyChapterMaterialRef.deleteMany({
      where: { chapterId },
    })
    if (refs.length > 0) {
      await this.prisma.biographyChapterMaterialRef.createMany({
        data: refs.map((ref) => ({
          id: ref.id,
          chapterId: ref.chapter_id,
          agentId: ref.agent_id,
          materialId: ref.material_id,
          sourceType: ref.source_type,
          sourceId: ref.source_id,
          materialRole: ref.material_role,
          importanceScore: ref.importance_score,
          contributionSummary: ref.contribution_summary,
          occurredAt: new Date(ref.occurred_at),
          createdAt: new Date(ref.created_at),
        })),
      })
    }
    return this.listMaterialRefs(chapterId)
  }

  async listMaterialRefs(chapterId: string): Promise<BiographyChapterMaterialRef[]> {
    const rows = await this.prisma.biographyChapterMaterialRef.findMany({
      where: { chapterId },
      orderBy: { occurredAt: 'asc' },
    })
    return rows.map((row) => toRef(row))
  }

  async getBookMemory(agentId: string): Promise<BiographyBookMemory | null> {
    const row = await this.prisma.biographyBookMemory.findUnique({
      where: { agentId },
    })
    return row ? toBookMemory(row) : null
  }

  async saveBookMemory(memory: BiographyBookMemory): Promise<BiographyBookMemory> {
    const row = await this.prisma.biographyBookMemory.upsert({
      where: { agentId: memory.agent_id },
      create: {
        agentId: memory.agent_id,
        memoryJson: toJsonInput(memory),
      },
      update: {
        memoryJson: toJsonInput(memory),
      },
    })
    return toBookMemory(row)
  }

  async getToneProfile(agentId: string): Promise<BiographyToneProfile | null> {
    const row = await this.prisma.biographyToneProfile.findUnique({
      where: { agentId },
    })
    return row ? toToneProfile(row) : null
  }

  async saveToneProfile(profile: BiographyToneProfile): Promise<BiographyToneProfile> {
    const row = await this.prisma.biographyToneProfile.upsert({
      where: { agentId: profile.agent_id },
      create: {
        agentId: profile.agent_id,
        toneProfileId: profile.tone_profile_id,
        profileJson: toJsonInput(profile),
      },
      update: {
        toneProfileId: profile.tone_profile_id,
        profileJson: toJsonInput(profile),
      },
    })
    return toToneProfile(row)
  }

  async getPublishedBookView(agentId: string): Promise<AgentBiographyBookViewModel | null> {
    const row = await this.prisma.agentBiographyBookView.findUnique({
      where: { agentId },
    })
    return row ? (toRecord(row.viewJson) as AgentBiographyBookViewModel) : null
  }

  async savePublishedBookView(view: AgentBiographyBookViewModel): Promise<AgentBiographyBookViewModel> {
    const row = await this.prisma.agentBiographyBookView.upsert({
      where: { agentId: view.agent_id },
      create: {
        agentId: view.agent_id,
        viewJson: toJsonInput(view),
      },
      update: {
        viewJson: toJsonInput(view),
      },
    })
    return toRecord(row.viewJson) as AgentBiographyBookViewModel
  }

  async recordReadTelemetry(event: AgentBiographyReadTelemetryEvent): Promise<void> {
    await this.prisma.agentBiographyReadTelemetryEvent.create({
      data: {
        agentId: event.agent_id,
        chapterId: event.chapter_id,
        eventType: event.event_type,
        eventAt: new Date(event.event_at),
        isOwnerView: event.is_owner_view,
        payloadJson: event.payload ? toJsonInput(event.payload) : Prisma.JsonNull,
      },
    })
  }

  async recordWriterTelemetry(event: AgentBiographyWriterTelemetryEvent): Promise<void> {
    await this.prisma.agentBiographyWriterTelemetryEvent.create({
      data: {
        agentId: event.agent_id,
        chapterId: event.chapter_id,
        revisionId: event.revision_id,
        promptTemplateId: event.prompt_template_id,
        promptVersion: event.prompt_version,
        modelName: event.model_name,
        providerId: event.provider_id,
        inputHash: event.input_hash,
        renderFingerprint: event.render_fingerprint,
        publishStatus: event.publish_status,
        auditStatus: event.audit_status,
        privacyBlocked: event.privacy_blocked,
        unsupportedClaimCount: event.unsupported_claim_count,
        inventedEntityCount: event.invented_entity_count,
        inventedRelationshipCount: event.invented_relationship_count,
        repairApplied: event.repair_applied,
        repairRuleHits: event.repair_rule_hits,
        rescueRenderAttempted: event.rescue_render_attempted,
        rescueRenderModelId: event.rescue_render_model_id,
        auditFailureCategory: event.audit_failure_category,
        laterNoteCount: event.later_note_count,
        createdAt: new Date(event.created_at),
      },
    })
  }

  async listReadTelemetry(agentId: string): Promise<AgentBiographyReadTelemetryEvent[]> {
    const rows = await this.prisma.agentBiographyReadTelemetryEvent.findMany({
      where: { agentId },
      orderBy: { eventAt: 'desc' },
    })
    return rows.map((row) => ({
      agent_id: row.agentId,
      chapter_id: row.chapterId,
      event_type: row.eventType as AgentBiographyReadTelemetryEvent['event_type'],
      event_at: row.eventAt.toISOString(),
      is_owner_view: row.isOwnerView,
      payload: row.payloadJson ? toRecord(row.payloadJson) : null,
    }))
  }

  async listWriterTelemetry(agentId: string): Promise<AgentBiographyWriterTelemetryEvent[]> {
    const rows = await this.prisma.agentBiographyWriterTelemetryEvent.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((row) => ({
      agent_id: row.agentId,
      chapter_id: row.chapterId,
      revision_id: row.revisionId,
      prompt_template_id: row.promptTemplateId,
      prompt_version: row.promptVersion,
      model_name: row.modelName,
      provider_id: row.providerId,
      input_hash: row.inputHash,
      render_fingerprint: row.renderFingerprint,
      publish_status: row.publishStatus as AgentBiographyWriterTelemetryEvent['publish_status'],
      audit_status: row.auditStatus as AgentBiographyWriterTelemetryEvent['audit_status'],
      privacy_blocked: row.privacyBlocked,
      unsupported_claim_count: row.unsupportedClaimCount,
      invented_entity_count: row.inventedEntityCount,
      invented_relationship_count: row.inventedRelationshipCount,
      repair_applied: row.repairApplied,
      repair_rule_hits: row.repairRuleHits,
      rescue_render_attempted: row.rescueRenderAttempted,
      rescue_render_model_id: row.rescueRenderModelId,
      audit_failure_category: row.auditFailureCategory,
      later_note_count: row.laterNoteCount,
      created_at: row.createdAt.toISOString(),
    }))
  }
}
