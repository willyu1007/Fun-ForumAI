import type {
  CreateRuntimeSceneStateInput,
  RuntimeSceneState,
  SaveRuntimeSceneStatePatch,
} from './types.js'

export interface RuntimeSceneStateRepository {
  create(input: CreateRuntimeSceneStateInput): Promise<RuntimeSceneState>
  findByRuntimeSceneId(runtimeSceneId: string): Promise<RuntimeSceneState | null>
  findActiveByRoom(roomId: string): Promise<RuntimeSceneState | null>
  findByEpisodeId(episodeId: string): Promise<RuntimeSceneState | null>
  update(runtimeSceneId: string, patch: SaveRuntimeSceneStatePatch): Promise<RuntimeSceneState | null>
  listBySurface(input: {
    director_surface: RuntimeSceneState['director_surface']
    status?: RuntimeSceneState['status']
  }): Promise<RuntimeSceneState[]>
}

let counter = 0
function cuid(): string {
  return `rss_${Date.now()}_${++counter}`
}

function cloneState(entity: RuntimeSceneState): RuntimeSceneState {
  return {
    ...entity,
    cooldown_until: entity.cooldown_until ? new Date(entity.cooldown_until) : null,
    state_json: structuredClone(entity.state_json),
    created_at: new Date(entity.created_at),
    updated_at: new Date(entity.updated_at),
  }
}

export class InMemoryRuntimeSceneStateRepository implements RuntimeSceneStateRepository {
  private readonly store = new Map<string, RuntimeSceneState>()
  private readonly byRuntimeSceneId = new Map<string, string>()
  private readonly byEpisodeId = new Map<string, string>()

  async create(input: CreateRuntimeSceneStateInput): Promise<RuntimeSceneState> {
    if (this.byRuntimeSceneId.has(input.runtime_scene_id)) {
      throw new Error(`RuntimeSceneState already exists for runtime scene ${input.runtime_scene_id}`)
    }
    if (this.byEpisodeId.has(input.episode_id)) {
      throw new Error(`RuntimeSceneState already exists for episode ${input.episode_id}`)
    }
    const now = new Date()
    const entity: RuntimeSceneState = {
      id: cuid(),
      runtime_scene_id: input.runtime_scene_id,
      director_surface: input.director_surface,
      actor_surface: input.actor_surface,
      community_id: input.community_id ?? null,
      room_id: input.room_id ?? null,
      episode_id: input.episode_id,
      scene_template_id: input.scene_template_id,
      scene_template_version: input.scene_template_version,
      scene_binding_id: input.scene_binding_id ?? null,
      overlay_id: input.overlay_id ?? null,
      phase: input.initial_state.phase,
      status: input.initial_state.status,
      fatigue_score: input.initial_state.dynamics.fatigue_score,
      repetition_score: input.initial_state.dynamics.repetition_score,
      cooldown_until: input.initial_state.cooldown_until ? new Date(input.initial_state.cooldown_until) : null,
      experiment_bucket: input.experiment_bucket,
      state_version: input.initial_state.audit.state_version,
      state_json: structuredClone(input.initial_state),
      created_at: now,
      updated_at: now,
    }
    this.store.set(entity.id, entity)
    this.byRuntimeSceneId.set(entity.runtime_scene_id, entity.id)
    this.byEpisodeId.set(entity.episode_id, entity.id)
    return cloneState(entity)
  }

  async findByRuntimeSceneId(runtimeSceneId: string): Promise<RuntimeSceneState | null> {
    const id = this.byRuntimeSceneId.get(runtimeSceneId)
    if (!id) return null
    const entity = this.store.get(id)
    return entity ? cloneState(entity) : null
  }

  async findActiveByRoom(roomId: string): Promise<RuntimeSceneState | null> {
    const entity = Array.from(this.store.values())
      .filter((item) => item.room_id === roomId)
      .filter((item) => item.status === 'active' || item.status === 'closing' || item.status === 'cooldown')
      .sort((left, right) => right.updated_at.getTime() - left.updated_at.getTime())[0]
    return entity ? cloneState(entity) : null
  }

  async findByEpisodeId(episodeId: string): Promise<RuntimeSceneState | null> {
    const id = this.byEpisodeId.get(episodeId)
    if (!id) return null
    const entity = this.store.get(id)
    return entity ? cloneState(entity) : null
  }

  async update(runtimeSceneId: string, patch: SaveRuntimeSceneStatePatch): Promise<RuntimeSceneState | null> {
    const id = this.byRuntimeSceneId.get(runtimeSceneId)
    if (!id) return null
    const current = this.store.get(id)
    if (!current) return null
    if (current.state_version !== patch.expected_state_version) {
      return null
    }
    const next: RuntimeSceneState = {
      ...current,
      phase: patch.phase ?? patch.state_json.phase,
      status: patch.status ?? patch.state_json.status,
      fatigue_score: patch.fatigue_score ?? patch.state_json.dynamics.fatigue_score,
      repetition_score: patch.repetition_score ?? patch.state_json.dynamics.repetition_score,
      cooldown_until: patch.cooldown_until ?? (patch.state_json.cooldown_until ? new Date(patch.state_json.cooldown_until) : null),
      experiment_bucket: patch.state_json.experiment.bucket,
      state_version: patch.state_json.audit.state_version,
      state_json: structuredClone(patch.state_json),
      updated_at: new Date(),
    }
    this.store.set(id, next)
    return cloneState(next)
  }

  async listBySurface(input: {
    director_surface: RuntimeSceneState['director_surface']
    status?: RuntimeSceneState['status']
  }): Promise<RuntimeSceneState[]> {
    return Array.from(this.store.values())
      .filter((item) => item.director_surface === input.director_surface)
      .filter((item) => !input.status || item.status === input.status)
      .sort((left, right) => right.updated_at.getTime() - left.updated_at.getTime())
      .map((item) => cloneState(item))
  }
}
