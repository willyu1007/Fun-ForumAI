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
} from '../../shared/agent-biography.js'

export interface AgentBiographyRepository {
  hydrate?(): Promise<void>
  findMaterialBySource(
    agentId: string,
    sourceType: BiographyMaterial['source_type'],
    sourceId: string,
  ): Promise<BiographyMaterial | null>
  saveMaterial(material: BiographyMaterial): Promise<BiographyMaterial>
  listMaterials(agentId: string, opts?: { limit?: number }): Promise<BiographyMaterial[]>
  getCompileState(agentId: string): Promise<AgentBiographyCompileState | null>
  saveCompileState(state: AgentBiographyCompileState): Promise<AgentBiographyCompileState>
  listDirtyCompileStates(opts: { limit: number }): Promise<AgentBiographyCompileState[]>
  listChapters(agentId: string): Promise<AgentBiographyChapter[]>
  getChapter(chapterId: string): Promise<AgentBiographyChapter | null>
  saveChapter(chapter: AgentBiographyChapter): Promise<AgentBiographyChapter>
  listRevisions(chapterId: string): Promise<BiographyChapterRevision[]>
  getRevision(revisionId: string): Promise<BiographyChapterRevision | null>
  saveRevision(revision: BiographyChapterRevision): Promise<BiographyChapterRevision>
  replaceMaterialRefs(
    chapterId: string,
    refs: BiographyChapterMaterialRef[],
  ): Promise<BiographyChapterMaterialRef[]>
  listMaterialRefs(chapterId: string): Promise<BiographyChapterMaterialRef[]>
  getBookMemory(agentId: string): Promise<BiographyBookMemory | null>
  saveBookMemory(memory: BiographyBookMemory): Promise<BiographyBookMemory>
  getToneProfile(agentId: string): Promise<BiographyToneProfile | null>
  saveToneProfile(profile: BiographyToneProfile): Promise<BiographyToneProfile>
  getPublishedBookView(agentId: string): Promise<AgentBiographyBookViewModel | null>
  savePublishedBookView(view: AgentBiographyBookViewModel): Promise<AgentBiographyBookViewModel>
  recordReadTelemetry(event: AgentBiographyReadTelemetryEvent): Promise<void>
  recordWriterTelemetry(event: AgentBiographyWriterTelemetryEvent): Promise<void>
  listReadTelemetry(agentId: string): Promise<AgentBiographyReadTelemetryEvent[]>
  listWriterTelemetry(agentId: string): Promise<AgentBiographyWriterTelemetryEvent[]>
}

let counter = 0

function cuid(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now()}_${counter}`
}

function sortCompileStatesByRecency(items: AgentBiographyCompileState[]): AgentBiographyCompileState[] {
  return items
    .slice()
    .sort((left, right) => {
      const leftTime = Date.parse(left.stale_since ?? left.last_compiled_at ?? '') || 0
      const rightTime = Date.parse(right.stale_since ?? right.last_compiled_at ?? '') || 0
      return rightTime - leftTime
    })
}

export class InMemoryAgentBiographyRepository implements AgentBiographyRepository {
  private readonly materials = new Map<string, BiographyMaterial>()
  private readonly materialIndex = new Map<string, string>()
  private readonly compileStates = new Map<string, AgentBiographyCompileState>()
  private readonly chapters = new Map<string, AgentBiographyChapter>()
  private readonly revisions = new Map<string, BiographyChapterRevision>()
  private readonly chapterRefs = new Map<string, BiographyChapterMaterialRef[]>()
  private readonly memories = new Map<string, BiographyBookMemory>()
  private readonly toneProfiles = new Map<string, BiographyToneProfile>()
  private readonly bookViews = new Map<string, AgentBiographyBookViewModel>()
  private readonly readTelemetry = new Map<string, AgentBiographyReadTelemetryEvent[]>()
  private readonly writerTelemetry = new Map<string, AgentBiographyWriterTelemetryEvent[]>()

  async findMaterialBySource(
    agentId: string,
    sourceType: BiographyMaterial['source_type'],
    sourceId: string,
  ): Promise<BiographyMaterial | null> {
    const id = this.materialIndex.get(`${agentId}:${sourceType}:${sourceId}`)
    if (!id) return null
    return this.materials.get(id) ?? null
  }

  async saveMaterial(material: BiographyMaterial): Promise<BiographyMaterial> {
    const id = material.id || cuid('bio_material')
    const next = { ...material, id }
    this.materials.set(id, next)
    this.materialIndex.set(`${material.agent_id}:${material.source_type}:${material.source_id}`, id)
    return next
  }

  async listMaterials(agentId: string, opts?: { limit?: number }): Promise<BiographyMaterial[]> {
    const rows = Array.from(this.materials.values())
      .filter((item) => item.agent_id === agentId)
      .sort((left, right) => {
        const diff = Date.parse(right.occurred_at) - Date.parse(left.occurred_at)
        return diff !== 0 ? diff : right.importance_score - left.importance_score
      })
    return typeof opts?.limit === 'number' ? rows.slice(0, opts.limit) : rows
  }

  async getCompileState(agentId: string): Promise<AgentBiographyCompileState | null> {
    return this.compileStates.get(agentId) ?? null
  }

  async saveCompileState(state: AgentBiographyCompileState): Promise<AgentBiographyCompileState> {
    this.compileStates.set(state.agent_id, state)
    return state
  }

  async listDirtyCompileStates(opts: { limit: number }): Promise<AgentBiographyCompileState[]> {
    return sortCompileStatesByRecency(
      Array.from(this.compileStates.values()).filter((item) => item.dirty),
    ).slice(0, opts.limit)
  }

  async listChapters(agentId: string): Promise<AgentBiographyChapter[]> {
    return Array.from(this.chapters.values())
      .filter((item) => item.agent_id === agentId)
      .sort((left, right) => left.chapter_no - right.chapter_no)
  }

  async getChapter(chapterId: string): Promise<AgentBiographyChapter | null> {
    return this.chapters.get(chapterId) ?? null
  }

  async saveChapter(chapter: AgentBiographyChapter): Promise<AgentBiographyChapter> {
    const id = chapter.id || cuid('bio_chapter')
    const next = { ...chapter, id }
    this.chapters.set(id, next)
    return next
  }

  async listRevisions(chapterId: string): Promise<BiographyChapterRevision[]> {
    return Array.from(this.revisions.values())
      .filter((item) => item.chapter_id === chapterId)
      .sort((left, right) => left.revision_no - right.revision_no)
  }

  async getRevision(revisionId: string): Promise<BiographyChapterRevision | null> {
    return this.revisions.get(revisionId) ?? null
  }

  async saveRevision(revision: BiographyChapterRevision): Promise<BiographyChapterRevision> {
    const id = revision.id || cuid('bio_revision')
    const next = { ...revision, id }
    this.revisions.set(id, next)
    return next
  }

  async replaceMaterialRefs(
    chapterId: string,
    refs: BiographyChapterMaterialRef[],
  ): Promise<BiographyChapterMaterialRef[]> {
    this.chapterRefs.set(
      chapterId,
      refs.map((item) => ({ ...item, id: item.id || cuid('bio_ref') })),
    )
    return this.chapterRefs.get(chapterId) ?? []
  }

  async listMaterialRefs(chapterId: string): Promise<BiographyChapterMaterialRef[]> {
    return this.chapterRefs.get(chapterId) ?? []
  }

  async getBookMemory(agentId: string): Promise<BiographyBookMemory | null> {
    return this.memories.get(agentId) ?? null
  }

  async saveBookMemory(memory: BiographyBookMemory): Promise<BiographyBookMemory> {
    this.memories.set(memory.agent_id, memory)
    return memory
  }

  async getToneProfile(agentId: string): Promise<BiographyToneProfile | null> {
    return this.toneProfiles.get(agentId) ?? null
  }

  async saveToneProfile(profile: BiographyToneProfile): Promise<BiographyToneProfile> {
    this.toneProfiles.set(profile.agent_id, profile)
    return profile
  }

  async getPublishedBookView(agentId: string): Promise<AgentBiographyBookViewModel | null> {
    return this.bookViews.get(agentId) ?? null
  }

  async savePublishedBookView(view: AgentBiographyBookViewModel): Promise<AgentBiographyBookViewModel> {
    this.bookViews.set(view.agent_id, view)
    return view
  }

  async recordReadTelemetry(event: AgentBiographyReadTelemetryEvent): Promise<void> {
    const current = this.readTelemetry.get(event.agent_id) ?? []
    current.push(event)
    this.readTelemetry.set(event.agent_id, current)
  }

  async recordWriterTelemetry(event: AgentBiographyWriterTelemetryEvent): Promise<void> {
    const current = this.writerTelemetry.get(event.agent_id) ?? []
    current.push(event)
    this.writerTelemetry.set(event.agent_id, current)
  }

  async listReadTelemetry(agentId: string): Promise<AgentBiographyReadTelemetryEvent[]> {
    return this.readTelemetry.get(agentId) ?? []
  }

  async listWriterTelemetry(agentId: string): Promise<AgentBiographyWriterTelemetryEvent[]> {
    return this.writerTelemetry.get(agentId) ?? []
  }
}
