import type {
  CreateForumSceneMetadataInput,
  ForumSceneMetadata,
} from './types.js'

export interface ForumSceneMetadataRepository {
  create(input: CreateForumSceneMetadataInput): Promise<ForumSceneMetadata>
  findByPostId(postId: string): Promise<ForumSceneMetadata | null>
  findByThreadId(threadId: string): Promise<ForumSceneMetadata | null>
  findByTurnId(turnId: string): Promise<ForumSceneMetadata | null>
  findLatestByCommunityId(communityId: string): Promise<ForumSceneMetadata | null>
  listByEpisodeId(episodeId: string): Promise<ForumSceneMetadata[]>
  listByCommunityIdSince(communityId: string, since: Date): Promise<ForumSceneMetadata[]>
  deleteByTarget(input: {
    post_id?: string | null
    thread_id?: string | null
    turn_id?: string | null
  }): Promise<void>
}

let counter = 0
function cuid(): string {
  return `fsm_${Date.now()}_${++counter}`
}

export class InMemoryForumSceneMetadataRepository implements ForumSceneMetadataRepository {
  private readonly store = new Map<string, ForumSceneMetadata>()
  private readonly byPostId = new Map<string, string>()
  private readonly byThreadId = new Map<string, string>()
  private readonly byTurnId = new Map<string, string>()

  async create(input: CreateForumSceneMetadataInput): Promise<ForumSceneMetadata> {
    const now = new Date()
    const normalizedThreadId = input.target_type === 'THREAD' ? input.thread_id ?? null : null
    const normalizedTurnId = input.target_type === 'TURN' ? input.turn_id ?? null : null
    const entity: ForumSceneMetadata = {
      id: cuid(),
      target_type: input.target_type,
      community_id: input.community_id,
      post_id: input.post_id ?? null,
      thread_id: normalizedThreadId,
      turn_id: normalizedTurnId,
      episode_id: input.episode_id,
      selection_id: input.selection_id,
      episode_plan_id: input.episode_plan_id,
      local_intent_id: input.local_intent_id,
      director_surface: input.director_surface,
      actor_surface: input.actor_surface,
      scene_template_id: input.scene_template_id,
      scene_template_version: input.scene_template_version,
      scene_binding_id: input.scene_binding_id ?? null,
      overlay_id: input.overlay_id ?? null,
      beat_id: input.beat_id ?? null,
      phase: input.phase,
      selection_mode: input.selection_mode,
      expires_at: input.expires_at ?? null,
      payload_json: input.payload_json,
      created_at: now,
      updated_at: now,
    }

    if (entity.target_type === 'POST' && entity.post_id) {
      if (this.byPostId.has(entity.post_id)) {
        throw new Error(`ForumSceneMetadata already exists for post ${entity.post_id}`)
      }
      this.byPostId.set(entity.post_id, entity.id)
    }
    if (entity.target_type === 'THREAD' && entity.thread_id) {
      if (this.byThreadId.has(entity.thread_id)) {
        throw new Error(`ForumSceneMetadata already exists for thread ${entity.thread_id}`)
      }
      this.byThreadId.set(entity.thread_id, entity.id)
    }
    if (entity.target_type === 'TURN' && entity.turn_id) {
      if (this.byTurnId.has(entity.turn_id)) {
        throw new Error(`ForumSceneMetadata already exists for turn ${entity.turn_id}`)
      }
      this.byTurnId.set(entity.turn_id, entity.id)
    }

    this.store.set(entity.id, entity)
    return entity
  }

  async findByPostId(postId: string): Promise<ForumSceneMetadata | null> {
    const id = this.byPostId.get(postId)
    return id ? this.store.get(id) ?? null : null
  }

  async findByThreadId(threadId: string): Promise<ForumSceneMetadata | null> {
    const id = this.byThreadId.get(threadId)
    return id ? this.store.get(id) ?? null : null
  }

  async findByTurnId(turnId: string): Promise<ForumSceneMetadata | null> {
    const id = this.byTurnId.get(turnId)
    return id ? this.store.get(id) ?? null : null
  }

  async findLatestByCommunityId(communityId: string): Promise<ForumSceneMetadata | null> {
    const items = Array.from(this.store.values())
      .filter((item) => item.community_id === communityId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return items[0] ?? null
  }

  async listByEpisodeId(episodeId: string): Promise<ForumSceneMetadata[]> {
    return Array.from(this.store.values())
      .filter((item) => item.episode_id === episodeId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async listByCommunityIdSince(communityId: string, since: Date): Promise<ForumSceneMetadata[]> {
    return Array.from(this.store.values())
      .filter((item) => item.community_id === communityId && item.created_at.getTime() >= since.getTime())
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async deleteByTarget(input: {
    post_id?: string | null
    thread_id?: string | null
    turn_id?: string | null
  }): Promise<void> {
    if (input.post_id) {
      const id = this.byPostId.get(input.post_id)
      if (!id) return
      this.byPostId.delete(input.post_id)
      this.store.delete(id)
      return
    }

    if (input.thread_id) {
      const id = this.byThreadId.get(input.thread_id)
      if (!id) return
      this.byThreadId.delete(input.thread_id)
      this.store.delete(id)
      return
    }

    if (input.turn_id) {
      const id = this.byTurnId.get(input.turn_id)
      if (!id) return
      this.byTurnId.delete(input.turn_id)
      this.store.delete(id)
      return
    }
  }
}
