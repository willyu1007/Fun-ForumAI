import type { ForumWriteService } from '../services/forum-write-service.js'
import type { ChatService } from '../services/chat-service.js'
import type { AgentRunRepository } from '../repos/event-repository.js'
import type { NurtureOrchestrator } from '../services/nurture-orchestrator.js'
import type { InclinationAssetService } from '../services/inclination-asset-service.js'
import type { WriteInstruction } from './types.js'
import type { LlmTokenUsage } from '../llm/types.js'
import type { ChatMessageKind } from '../repos/types.js'
import type { PersonaObservationV1 } from './persona-observation.js'
import {
  attachPersonaObservation,
  recordPersonaObservation,
} from './persona-observation.js'

export interface DataPlaneWriterDeps {
  forumWriteService: ForumWriteService
  agentRunRepo: AgentRunRepository
  chatService?: ChatService
  xpService?: { awardXP(agentId: string, source: string, amount: number): Promise<unknown> } | null
  nurtureOrchestrator?: NurtureOrchestrator | null
  inclinationAssetService?: Pick<InclinationAssetService, 'attachPostMediaAndConsume'>
}

export interface WriteResult {
  success: boolean
  content_id?: string
  error?: string
}

/**
 * Writes agent-generated content via the ForumWriteService (in-process).
 * Also records the AgentRun with token cost and latency.
 */
export class DataPlaneWriter {
  constructor(private readonly deps: DataPlaneWriterDeps) {}

  async write(
    instruction: WriteInstruction,
    agentId: string,
    triggerEventId: string,
    usage: LlmTokenUsage,
    latencyMs: number,
    sourceChainDepth = 0,
    observation?: PersonaObservationV1 | null,
  ): Promise<WriteResult> {
    const runId = `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const nextChainDepth = Math.max(0, Math.floor(sourceChainDepth)) + 1

    try {
      let contentId: string

      if (instruction.action === 'create_message') {
        if (!this.deps.chatService) {
          return this.recordFailedWrite({
            instruction,
            agentId,
            triggerEventId,
            usage,
            latencyMs,
            observation,
            error: 'ChatService not configured',
          })
        }
        const msg = await this.deps.chatService.sendMessage({
          room_id: instruction.room_id!,
          author_id: agentId,
          body: instruction.body,
          message_kind: (instruction.message_kind as ChatMessageKind) ?? 'normal',
        })
        contentId = msg.id
      } else if (instruction.action === 'create_post') {
        const result = await this.deps.forumWriteService.createPost({
          actor_agent_id: agentId,
          run_id: runId,
          community_id: instruction.community_id,
          title: instruction.title!,
          body: instruction.body,
          tags: instruction.tags,
          chain_depth: nextChainDepth,
          trust_context: instruction.trust_context,
          scene: instruction.public_scene,
        })
        contentId = result.post.id

        if (instruction.media_asset_id && this.deps.inclinationAssetService) {
          try {
            await this.deps.inclinationAssetService.attachPostMediaAndConsume({
              asset_id: instruction.media_asset_id,
              post_id: contentId,
            })
          } catch (mediaErr) {
            console.error('[DataPlaneWriter] failed to attach post media:', mediaErr)
          }
        }
      } else {
        const result = await this.deps.forumWriteService.createComment({
          actor_agent_id: agentId,
          run_id: runId,
          post_id: instruction.post_id!,
          parent_comment_id: instruction.parent_comment_id,
          body: instruction.body,
          chain_depth: nextChainDepth,
          scene: instruction.public_scene,
        })
        contentId = result.comment.id
      }

      this.deps.agentRunRepo.create({
        agent_id: agentId,
        trigger_event_id: triggerEventId,
        input_digest: `action:${instruction.action}|body_len:${instruction.body.length}`,
        output_json: observation
          ? attachPersonaObservation({
              content_id: contentId,
              action: instruction.action,
              ...(instruction.public_scene
                ? {
                    public_scene: {
                      episode_id: instruction.public_scene.scene_metadata.episode_id,
                      selection_id: instruction.public_scene.scene_metadata.selection_id,
                      episode_plan_id: instruction.public_scene.scene_metadata.episode_plan_id,
                      local_intent_id: instruction.public_scene.scene_metadata.local_intent_id,
                    },
                  }
                : {}),
              ...(instruction.audit_metadata
                ? { audit_metadata: instruction.audit_metadata }
                : {}),
            }, observation)
          : {
              content_id: contentId,
              action: instruction.action,
              ...(instruction.public_scene
                ? {
                    public_scene: {
                      episode_id: instruction.public_scene.scene_metadata.episode_id,
                      selection_id: instruction.public_scene.scene_metadata.selection_id,
                      episode_plan_id: instruction.public_scene.scene_metadata.episode_plan_id,
                      local_intent_id: instruction.public_scene.scene_metadata.local_intent_id,
                    },
                  }
                : {}),
              ...(instruction.audit_metadata
                ? { audit_metadata: instruction.audit_metadata }
                : {}),
            },
        token_cost: usage.total_tokens,
        latency_ms: latencyMs,
      })
      if (observation) {
        recordPersonaObservation(observation)
      }

      if (instruction.action !== 'create_message') {
        const xpSource = instruction.action === 'create_post' ? 'forum_post' : 'forum_comment'

        if (this.deps.nurtureOrchestrator) {
          this.deps.nurtureOrchestrator.onContentProduced(agentId, xpSource, 1, {
            dedup_key: `content:${contentId}`,
          }).catch((err) => {
            console.error('[DataPlaneWriter] nurture onContentProduced failed:', err)
          })
        } else {
          this.deps.xpService?.awardXP(agentId, xpSource, 1).catch((err) => {
            console.error('[DataPlaneWriter] XP award failed:', err)
          })
        }
      }

      return { success: true, content_id: contentId }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown write error'
      console.error(`[DataPlaneWriter] Write failed for agent ${agentId}: ${message}`)
      return this.recordFailedWrite({
        instruction,
        agentId,
        triggerEventId,
        usage,
        latencyMs,
        observation,
        error: message,
      })
    }
  }

  private recordFailedWrite(input: {
    instruction: WriteInstruction
    agentId: string
    triggerEventId: string
    usage: LlmTokenUsage
    latencyMs: number
    observation?: PersonaObservationV1 | null
    error: string
  }): WriteResult {
    if (!input.observation) {
      return { success: false, error: input.error }
    }

    const failedObservation: PersonaObservationV1 = {
      ...input.observation,
      error: input.error,
    }

    try {
      this.deps.agentRunRepo.create({
        agent_id: input.agentId,
        trigger_event_id: input.triggerEventId,
        input_digest: `write_failed|action:${input.instruction.action}|body_len:${input.instruction.body.length}`,
        output_json: attachPersonaObservation(
          {
            action: input.instruction.action,
            error: input.error,
            ...(input.instruction.public_scene
              ? {
                  public_scene: {
                    episode_id: input.instruction.public_scene.scene_metadata.episode_id,
                    selection_id: input.instruction.public_scene.scene_metadata.selection_id,
                    episode_plan_id: input.instruction.public_scene.scene_metadata.episode_plan_id,
                    local_intent_id: input.instruction.public_scene.scene_metadata.local_intent_id,
                  },
                }
              : {}),
            ...(input.instruction.audit_metadata
              ? { audit_metadata: input.instruction.audit_metadata }
              : {}),
          },
          failedObservation,
        ),
        token_cost: input.usage.total_tokens,
        latency_ms: input.latencyMs,
      })
      recordPersonaObservation(failedObservation)
    } catch (runErr) {
      console.error('[DataPlaneWriter] Failed to persist failed-write AgentRun:', runErr)
    }

    return { success: false, error: input.error }
  }
}
