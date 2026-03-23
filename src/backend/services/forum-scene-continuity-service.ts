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
      source: 'turn_sidecar' | 'thread_sidecar' | 'post_sidecar' | 'event_replay'
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
    target_thread_author_agent_id?: string
    target_turn_author_agent_id?: string
  }): Promise<ForumSceneContinuityResolution | null> {
    if (!input.event.post_id) return null
    if (
      input.event.event_type !== 'NewPostCreated'
      && input.event.event_type !== 'ThreadOpened'
      && input.event.event_type !== 'ThreadTurnAdded'
    ) {
      return null
    }

    let skipReason: string | null = null

    const turnSidecar = input.event.turn_id
      ? await this.deps.sceneMetadataRepo.findByTurnId(input.event.turn_id)
      : null
    if (turnSidecar) {
      const payload = parsePublicScenePayload(turnSidecar.payload_json)
      if (payload) {
        return {
          kind: 'continue',
          source: 'turn_sidecar',
          payload: this.buildFollowupPayload(payload, input),
        }
      }
      const rebuilt = await this.rebuildFromMetadata(turnSidecar, input)
      if (rebuilt) {
        return {
          kind: 'continue',
          source: 'turn_sidecar',
          payload: rebuilt,
        }
      }
      skipReason = 'scene_tagged_turn_missing_payload'
    }

    const threadSidecar = input.event.thread_id
      ? await this.deps.sceneMetadataRepo.findByThreadId(input.event.thread_id)
      : null
    if (threadSidecar) {
      const payload = parsePublicScenePayload(threadSidecar.payload_json)
      if (payload) {
        return {
          kind: 'continue',
          source: 'thread_sidecar',
          payload: this.buildFollowupPayload(payload, input),
        }
      }
      const rebuilt = await this.rebuildFromMetadata(threadSidecar, input)
      if (rebuilt) {
        return {
          kind: 'continue',
          source: 'thread_sidecar',
          payload: rebuilt,
        }
      }
      skipReason ??= 'scene_tagged_thread_missing_payload'
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

    const replayResult = this.replayFromEvents(input.event.post_id, {
      thread_id: input.event.thread_id,
      turn_id: input.event.turn_id,
    })
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

  private replayFromEvents(postId: string, target: {
    thread_id?: string
    turn_id?: string
  }): {
    payload: PublicSceneWritePayload | null
    foundSceneTag: boolean
    reason: string
  } {
    const events = this.deps.eventRepo.findByPostId(postId)
    let foundSceneTag = false

    if (target.turn_id) {
      const matchedTurnEvent = [...events].reverse().find((event) =>
        String((event.payload_json as Record<string, unknown>).turn_id ?? '') === target.turn_id
        && (event.payload_json as Record<string, unknown>).public_scene)
      const publicScene = (matchedTurnEvent?.payload_json as Record<string, unknown> | undefined)?.public_scene
      if (publicScene) {
        foundSceneTag = true
        const turnPayload = parsePublicScenePayload(publicScene)
        if (turnPayload) {
          return {
            payload: turnPayload,
            foundSceneTag: true,
            reason: 'scene_tagged_turn_event_missing_payload',
          }
        }
      }
    }

    if (target.thread_id) {
      const matchedThreadEvent = [...events].reverse().find((event) =>
        String((event.payload_json as Record<string, unknown>).thread_id ?? '') === target.thread_id
        && (event.payload_json as Record<string, unknown>).public_scene)
      const publicScene = (matchedThreadEvent?.payload_json as Record<string, unknown> | undefined)?.public_scene
      if (publicScene) {
        foundSceneTag = true
        const threadPayload = parsePublicScenePayload(publicScene)
        if (threadPayload) {
          return {
            payload: threadPayload,
            foundSceneTag: true,
            reason: 'scene_tagged_thread_event_missing_payload',
          }
        }
      }
    }

    const postEvent = [...events].reverse().find((event) =>
      String((event.payload_json as Record<string, unknown>).post_id ?? '') === postId
      && !('comment_id' in (event.payload_json as Record<string, unknown>))
      && !('thread_id' in (event.payload_json as Record<string, unknown>))
      && !('turn_id' in (event.payload_json as Record<string, unknown>))
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
      reason: target.turn_id
        ? 'scene_tagged_turn_event_missing_payload'
        : target.thread_id
          ? 'scene_tagged_thread_event_missing_payload'
          : 'scene_tagged_post_event_missing_payload',
    }
  }

  private buildFollowupPayload(
    base: PublicSceneWritePayload,
    input: {
      event: EventPayload
      post_author_agent_id?: string
      target_thread_author_agent_id?: string
      target_turn_author_agent_id?: string
    },
  ): PublicSceneWritePayload {
    const episodeBrief: EpisodeBrief = {
      ...base.episode_brief,
      actor_surface: 'forum_thread',
    }

    const localIntent: LocalIntent = {
      ...base.local_intent,
      intent_id: generateSceneId('local_intent'),
      delivery_surface: 'forum_thread',
      initiative: 'reply',
      memory_scope: 'public_episode_continuity',
      reference_scope: 'thread_only',
      target_ref: buildContinuityTargetRef(input),
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
      actor_surface: 'forum_thread',
      local_intent_id: localIntent.intent_id,
    }

    return {
      scene_metadata: sceneMetadata,
      episode_brief: episodeBrief,
      local_intent: localIntent,
      local_intent_block: buildLocalIntentBlock(localIntent, episodeBrief),
      selection_audit: base.selection_audit ?? null,
      planning_audit: base.planning_audit ?? null,
    }
  }

  private async rebuildFromMetadata(
    metadata: Awaited<ReturnType<ForumSceneMetadataRepository['findByPostId']>> extends infer T ? T : never,
    input: {
      event: EventPayload
      post_author_agent_id?: string
      target_thread_author_agent_id?: string
      target_turn_author_agent_id?: string
    },
  ): Promise<PublicSceneWritePayload | null> {
    if (!metadata || !this.deps.sceneSelectorService) return null
    const rebuilt = await this.deps.sceneSelectorService.selectForumThreadFollowup({
      community_id: metadata.community_id,
      post_id: metadata.post_id ?? input.event.post_id!,
      thread_id: input.event.thread_id ?? metadata.thread_id ?? undefined,
      turn_id: input.event.turn_id ?? metadata.turn_id ?? undefined,
      post_author_agent_id: input.post_author_agent_id,
      target_thread_author_agent_id: input.target_thread_author_agent_id,
      target_turn_author_agent_id: input.target_turn_author_agent_id,
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

function buildContinuityTargetRef(input: {
  event: EventPayload
  post_author_agent_id?: string
  target_thread_author_agent_id?: string
  target_turn_author_agent_id?: string
}): LocalIntent['target_ref'] {
  if (input.event.turn_id && input.event.thread_id) {
    return {
      kind: 'turn',
      post_id: input.event.post_id!,
      thread_id: input.event.thread_id,
      turn_id: input.event.turn_id,
      ...(input.target_turn_author_agent_id
        ? { agent_id: input.target_turn_author_agent_id }
        : {}),
    }
  }
  if (input.event.thread_id) {
    return {
      kind: 'thread',
      post_id: input.event.post_id!,
      thread_id: input.event.thread_id,
      ...(input.target_thread_author_agent_id
        ? { agent_id: input.target_thread_author_agent_id }
        : {}),
    }
  }
  if (input.post_author_agent_id) {
    return { kind: 'agent', agent_id: input.post_author_agent_id }
  }
  return { kind: 'none' }
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
