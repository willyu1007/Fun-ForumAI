import type { EventPayload } from '../allocator/types.js'
import type { ForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import type { EventRepository } from '../repos/event-repository.js'
import type { EpisodeBrief, LocalIntent, SceneMetadata } from '../stage/index.js'
import {
  buildLocalIntentBlock,
  generateSceneId,
  parsePublicScenePayload,
  type PublicSceneWritePayload,
} from './public-scene-runtime.js'
import type { PublicSceneSelectorService } from './public-scene-selector-service.js'

export type ForumSceneContinuityResolution =
  | {
      kind: 'continue'
      source: 'comment_sidecar' | 'post_sidecar' | 'event_replay'
      payload: PublicSceneWritePayload
    }
  | {
      kind: 'skip'
      reason: string
    }

export class ForumSceneContinuityService {
  constructor(
    private readonly deps: {
      sceneMetadataRepo: ForumSceneMetadataRepository
      eventRepo: EventRepository
      sceneSelectorService?: PublicSceneSelectorService
    },
  ) {}

  async resolve(input: {
    event: EventPayload
    post_author_agent_id?: string
    target_comment_author_agent_id?: string
  }): Promise<ForumSceneContinuityResolution | null> {
    if (!input.event.post_id) return null
    if (input.event.event_type !== 'NewPostCreated' && input.event.event_type !== 'NewCommentCreated') {
      return null
    }

    let skipReason: string | null = null

    const commentSidecar = input.event.comment_id
      ? await this.deps.sceneMetadataRepo.findByCommentId(input.event.comment_id)
      : null
    if (commentSidecar) {
      const payload = parsePublicScenePayload(commentSidecar.payload_json)
      if (payload) {
        return {
          kind: 'continue',
          source: 'comment_sidecar',
          payload: this.buildFollowupPayload(payload, input),
        }
      }
      const rebuilt = await this.rebuildFromMetadata(commentSidecar, input)
      if (rebuilt) {
        return {
          kind: 'continue',
          source: 'comment_sidecar',
          payload: rebuilt,
        }
      }
      skipReason = 'scene_tagged_comment_missing_payload'
    }

    const postSidecar = await this.deps.sceneMetadataRepo.findByPostId(input.event.post_id)
    if (postSidecar) {
      const payload = parsePublicScenePayload(postSidecar.payload_json)
      if (payload) {
        return {
          kind: 'continue',
          source: 'post_sidecar',
          payload: this.buildFollowupPayload(payload, input),
        }
      }
      const rebuilt = await this.rebuildFromMetadata(postSidecar, input)
      if (rebuilt) {
        return {
          kind: 'continue',
          source: 'post_sidecar',
          payload: rebuilt,
        }
      }
      skipReason ??= 'scene_tagged_post_missing_payload'
    }

    const replayResult = this.replayFromEvents(input.event.post_id, input.event.comment_id)
    if (replayResult.payload) {
      return {
        kind: 'continue',
        source: 'event_replay',
        payload: this.buildFollowupPayload(replayResult.payload, input),
      }
    }
    if (replayResult.foundSceneTag) {
      skipReason ??= replayResult.reason
    }

    if (skipReason) {
      return { kind: 'skip', reason: skipReason }
    }

    return null
  }

  private replayFromEvents(postId: string, commentId?: string): {
    payload: PublicSceneWritePayload | null
    foundSceneTag: boolean
    reason: string
  } {
    const events = this.deps.eventRepo.findByPostId(postId)
    let foundSceneTag = false

    if (commentId) {
      const matchedCommentEvent = events.find((event) =>
        String((event.payload_json as Record<string, unknown>).comment_id ?? '') === commentId)
      const publicScene = (matchedCommentEvent?.payload_json as Record<string, unknown> | undefined)?.public_scene
      if (publicScene) {
        foundSceneTag = true
        const commentPayload = parsePublicScenePayload(publicScene)
        if (commentPayload) {
          return {
            payload: commentPayload,
            foundSceneTag: true,
            reason: 'scene_tagged_comment_event_missing_payload',
          }
        }
      }
    }

    const postEvent = [...events].reverse().find((event) =>
      String((event.payload_json as Record<string, unknown>).post_id ?? '') === postId
      && !('comment_id' in (event.payload_json as Record<string, unknown>))
      && (event.payload_json as Record<string, unknown>).public_scene)
    const publicScene = (postEvent?.payload_json as Record<string, unknown> | undefined)?.public_scene
    if (publicScene) {
      foundSceneTag = true
      const payload = parsePublicScenePayload(publicScene)
      if (payload) {
        return {
          payload,
          foundSceneTag: true,
          reason: 'scene_tagged_post_event_missing_payload',
        }
      }
    }

    return {
      payload: null,
      foundSceneTag,
      reason: commentId
        ? 'scene_tagged_comment_event_missing_payload'
        : 'scene_tagged_post_event_missing_payload',
    }
  }

  private buildFollowupPayload(
    base: PublicSceneWritePayload,
    input: {
      event: EventPayload
      post_author_agent_id?: string
      target_comment_author_agent_id?: string
    },
  ): PublicSceneWritePayload {
    const episodeBrief: EpisodeBrief = {
      ...base.episode_brief,
      actor_surface: 'forum_comment',
    }

    const localIntent: LocalIntent = {
      ...base.local_intent,
      intent_id: generateSceneId('local_intent'),
      delivery_surface: 'forum_comment',
      initiative: 'reply',
      memory_scope: 'public_episode_continuity',
      reference_scope: 'thread_only',
      target_ref: input.event.comment_id
        ? {
            kind: 'comment',
            post_id: input.event.post_id!,
            comment_id: input.event.comment_id,
            ...(input.target_comment_author_agent_id
              ? { agent_id: input.target_comment_author_agent_id }
              : {}),
          }
        : input.post_author_agent_id
          ? { kind: 'agent', agent_id: input.post_author_agent_id }
          : { kind: 'none' },
      hard_constraints: uniqueStrings([
        ...base.local_intent.hard_constraints,
        '延续当前 episode，不重选场景',
        '只依据公开线程内容继续推进',
      ]),
      soft_constraints: uniqueStrings([
        ...base.local_intent.soft_constraints,
        `保持 episode phase=${base.scene_metadata.phase}`,
      ]),
    }

    const sceneMetadata: SceneMetadata = {
      ...base.scene_metadata,
      actor_surface: 'forum_comment',
      local_intent_id: localIntent.intent_id,
    }

    return {
      scene_metadata: sceneMetadata,
      episode_brief: episodeBrief,
      local_intent: localIntent,
      local_intent_block: buildLocalIntentBlock(localIntent, episodeBrief),
      selection_audit: base.selection_audit ?? null,
      planning_audit: base.planning_audit ?? null,
      fallback_reason: base.fallback_reason ?? null,
    }
  }

  private async rebuildFromMetadata(
    metadata: Awaited<ReturnType<ForumSceneMetadataRepository['findByPostId']>> extends infer T ? T : never,
    input: {
      event: EventPayload
      post_author_agent_id?: string
      target_comment_author_agent_id?: string
    },
  ): Promise<PublicSceneWritePayload | null> {
    if (!metadata || !this.deps.sceneSelectorService) return null
    const rebuilt = await this.deps.sceneSelectorService.selectForumCommentFollowup({
      community_id: metadata.community_id,
      post_id: metadata.post_id ?? input.event.post_id!,
      comment_id: input.event.comment_id,
      post_author_agent_id: input.post_author_agent_id,
      target_comment_author_agent_id: input.target_comment_author_agent_id,
      existing_scene_metadata: {
        episode_id: metadata.episode_id,
        director_surface: metadata.director_surface as SceneMetadata['director_surface'],
        actor_surface: metadata.actor_surface as SceneMetadata['actor_surface'],
        scene_template_id: metadata.scene_template_id,
        scene_template_version: metadata.scene_template_version,
        scene_binding_id: metadata.scene_binding_id,
        overlay_id: metadata.overlay_id,
        phase: metadata.phase,
        selection_mode: metadata.selection_mode,
        expires_at: metadata.expires_at?.toISOString() ?? null,
      },
    })
    return rebuilt.kind === 'scene' ? rebuilt.payload : null
  }
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const normalized = value.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    output.push(normalized)
  }
  return output
}
