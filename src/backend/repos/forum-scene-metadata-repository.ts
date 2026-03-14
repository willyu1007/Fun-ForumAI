import type {
  CreateForumSceneMetadataInput,
  ForumSceneMetadata,
} from './types.js'

export interface ForumSceneMetadataRepository {
  create(input: CreateForumSceneMetadataInput): Promise<ForumSceneMetadata>
  findByPostId(postId: string): Promise<ForumSceneMetadata | null>
  findByCommentId(commentId: string): Promise<ForumSceneMetadata | null>
  findLatestByCommunityId(communityId: string): Promise<ForumSceneMetadata | null>
  listByCommunityIdSince(communityId: string, since: Date): Promise<ForumSceneMetadata[]>
  deleteByTarget(input: { post_id?: string | null; comment_id?: string | null }): Promise<void>
}

let counter = 0
function cuid(): string {
  return `fsm_${Date.now()}_${++counter}`
}

export class InMemoryForumSceneMetadataRepository implements ForumSceneMetadataRepository {
  private readonly store = new Map<string, ForumSceneMetadata>()
  private readonly byPostId = new Map<string, string>()
  private readonly byCommentId = new Map<string, string>()

  async create(input: CreateForumSceneMetadataInput): Promise<ForumSceneMetadata> {
    const now = new Date()
    const entity: ForumSceneMetadata = {
      id: cuid(),
      target_type: input.target_type,
      community_id: input.community_id,
      post_id: input.post_id ?? null,
      comment_id: input.comment_id ?? null,
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
    if (entity.comment_id) {
      if (this.byCommentId.has(entity.comment_id)) {
        throw new Error(`ForumSceneMetadata already exists for comment ${entity.comment_id}`)
      }
      this.byCommentId.set(entity.comment_id, entity.id)
    }

    this.store.set(entity.id, entity)
    return entity
  }

  async findByPostId(postId: string): Promise<ForumSceneMetadata | null> {
    const id = this.byPostId.get(postId)
    return id ? this.store.get(id) ?? null : null
  }

  async findByCommentId(commentId: string): Promise<ForumSceneMetadata | null> {
    const id = this.byCommentId.get(commentId)
    return id ? this.store.get(id) ?? null : null
  }

  async findLatestByCommunityId(communityId: string): Promise<ForumSceneMetadata | null> {
    const items = Array.from(this.store.values())
      .filter((item) => item.community_id === communityId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return items[0] ?? null
  }

  async listByCommunityIdSince(communityId: string, since: Date): Promise<ForumSceneMetadata[]> {
    return Array.from(this.store.values())
      .filter((item) => item.community_id === communityId && item.created_at.getTime() >= since.getTime())
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async deleteByTarget(input: { post_id?: string | null; comment_id?: string | null }): Promise<void> {
    if (input.post_id) {
      const id = this.byPostId.get(input.post_id)
      if (!id) return
      this.byPostId.delete(input.post_id)
      this.store.delete(id)
      return
    }

    if (input.comment_id) {
      const id = this.byCommentId.get(input.comment_id)
      if (!id) return
      this.byCommentId.delete(input.comment_id)
      this.store.delete(id)
    }
  }
}
