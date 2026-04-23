import type { ForumWriteService } from '../services/forum-write-service.js'
import type { ChatService } from '../services/chat-service.js'
import type { AgentRunRepository } from '../repos/event-repository.js'
import type { NurtureOrchestrator } from '../services/nurture-orchestrator.js'
import type { WriteInstruction } from './types.js'
import type { LlmTokenUsage } from '../llm/types.js'
import type { ChatMessageKind } from '../repos/types.js'
import type { PersonaObservationV1 } from './persona-observation.js'
import type { MediaWriteBridge } from '../media/media-write-bridge.js'
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
  mediaWriteBridge?: Pick<MediaWriteBridge, 'applyImagePlanAfterPersist'>
}

export interface WriteResult {
  success: boolean
  content_id?: string
  event_id?: string
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
      let contentId: string | undefined
      let eventId: string | undefined
      let imagePlanApplyError: string | null = null

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
          room_id: instruction.room_id,
          author_id: agentId,
          body: instruction.body,
          message_kind: (instruction.message_kind as ChatMessageKind) ?? 'normal',
          ...(instruction.image_plan_id
            ? {
                image_plan_id: instruction.image_plan_id,
                display_attachment_refs: instruction.display_attachment_refs ?? [],
              }
            : {}),
        })
        contentId = msg.id
      } else if (instruction.action === 'vote') {
        const result = await this.deps.forumWriteService.upsertVote({
          actor_agent_id: agentId,
          run_id: runId,
          target_type: instruction.target_type,
          target_id: instruction.target_id,
          direction: instruction.direction,
          is_autonomous: instruction.is_autonomous,
          chain_depth: nextChainDepth,
          governance_context: instruction.governance_context,
          source_event_id: instruction.source_event_id,
          idempotency_key: instruction.idempotency_key,
        })
        eventId = result.event?.id ?? undefined
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
          governance_context: instruction.governance_context,
        })
        contentId = result.post.id

        if (instruction.image_plan_id) {
          if (!this.deps.mediaWriteBridge) {
            imagePlanApplyError = 'MediaWriteBridge not configured'
          } else {
            try {
              await this.deps.mediaWriteBridge.applyImagePlanAfterPersist({
                image_plan_id: instruction.image_plan_id,
                scene_type: 'forum_post',
                scene_id: contentId,
                created_by_id: agentId,
                governance_context: instruction.governance_context,
              })
            } catch (err) {
              imagePlanApplyError = err instanceof Error ? err.message : 'apply_image_plan_failed'
              console.error(
                `[DataPlaneWriter] applyImagePlanAfterPersist failed for post ${contentId}: ${imagePlanApplyError}`,
              )
            }
          }
        }
      } else if (instruction.action === 'open_thread') {
        const result = await this.deps.forumWriteService.createThread({
          actor_agent_id: agentId,
          run_id: runId,
          post_id: instruction.post_id,
          body: instruction.body,
          chain_depth: nextChainDepth,
          route_handoff: instruction.route_handoff ?? undefined,
          scene: instruction.public_scene,
          governance_context: instruction.governance_context,
        })
        contentId = result.entry.id
        if (instruction.image_plan_id) {
          if (!this.deps.mediaWriteBridge) {
            imagePlanApplyError = 'MediaWriteBridge not configured'
          } else {
            try {
              await this.deps.mediaWriteBridge.applyImagePlanAfterPersist({
                image_plan_id: instruction.image_plan_id,
                scene_type: 'forum_thread',
                scene_id: contentId,
                created_by_id: agentId,
                governance_context: instruction.governance_context,
              })
            } catch (err) {
              imagePlanApplyError = err instanceof Error ? err.message : 'apply_image_plan_failed'
              console.error(
                `[DataPlaneWriter] applyImagePlanAfterPersist failed for thread ${contentId}: ${imagePlanApplyError}`,
              )
            }
          }
        }
      } else if (instruction.action === 'add_thread_turn') {
        const result = await this.deps.forumWriteService.addThreadTurn({
          actor_agent_id: agentId,
          run_id: runId,
          thread_id: instruction.thread_id,
          anchor_turn_id: instruction.anchor_turn_id,
          body: instruction.body,
          chain_depth: nextChainDepth,
          route_handoff: instruction.route_handoff ?? undefined,
          scene: instruction.public_scene,
          governance_context: instruction.governance_context,
        })
        contentId = result.entry.id
        if (instruction.image_plan_id) {
          if (!this.deps.mediaWriteBridge) {
            imagePlanApplyError = 'MediaWriteBridge not configured'
          } else {
            try {
              await this.deps.mediaWriteBridge.applyImagePlanAfterPersist({
                image_plan_id: instruction.image_plan_id,
                scene_type: 'forum_turn',
                scene_id: contentId,
                created_by_id: agentId,
                governance_context: instruction.governance_context,
              })
            } catch (err) {
              imagePlanApplyError = err instanceof Error ? err.message : 'apply_image_plan_failed'
              console.error(
                `[DataPlaneWriter] applyImagePlanAfterPersist failed for turn ${contentId}: ${imagePlanApplyError}`,
              )
            }
          }
        }
      } else {
        return this.recordFailedWrite({
          instruction,
          agentId,
          triggerEventId,
          usage,
          latencyMs,
          observation,
          error: `Unsupported write action: ${instruction.action}`,
        })
      }

      this.deps.agentRunRepo.create({
        agent_id: agentId,
        trigger_event_id: triggerEventId,
        input_digest: buildInstructionInputDigest(instruction),
        output_json: buildRunOutput({
          instruction,
          contentId,
          eventId,
          imagePlanApplyError,
          observation,
        }),
        token_cost: usage.total_tokens,
        latency_ms: latencyMs,
      })
      if (observation) {
        recordPersonaObservation(observation)
      }

      if (
        instruction.action !== 'create_message'
        && instruction.action !== 'vote'
        && contentId
      ) {
        const xpSource = instruction.action === 'create_post'
          ? 'forum_post'
          : instruction.action === 'open_thread'
            ? 'forum_thread'
            : 'forum_turn'

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

      return {
        success: true,
        ...(contentId ? { content_id: contentId } : {}),
        ...(eventId ? { event_id: eventId } : {}),
      }
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
        input_digest: `write_failed|${buildInstructionInputDigest(input.instruction)}`,
        output_json: attachPersonaObservation(
          {
            action: input.instruction.action,
            error: input.error,
            ...(input.instruction.action === 'vote'
              ? buildVoteRunOutput(input.instruction)
              : {}),
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
            ...('image_plan_id' in input.instruction && input.instruction.image_plan_id
              ? {
                  image_plan: {
                    image_plan_id: input.instruction.image_plan_id,
                    display_attachment_refs: input.instruction.display_attachment_refs ?? [],
                  },
                }
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

function buildInstructionInputDigest(instruction: WriteInstruction): string {
  if (instruction.action === 'vote') {
    return [
      `action:${instruction.action}`,
      `target:${instruction.target_type}:${instruction.target_id}`,
      `direction:${instruction.direction}`,
      `source_event:${instruction.source_event_id}`,
    ].join('|')
  }

  return `action:${instruction.action}|body_len:${instruction.body.length}`
}

function buildRunOutput(input: {
  instruction: WriteInstruction
  contentId?: string
  eventId?: string
  imagePlanApplyError: string | null
  observation?: PersonaObservationV1 | null
}): Record<string, unknown> | null {
  const base = {
    ...(input.contentId ? { content_id: input.contentId } : {}),
    ...(input.eventId ? { event_id: input.eventId } : {}),
    action: input.instruction.action,
    ...(input.instruction.action === 'vote'
      ? buildVoteRunOutput(input.instruction)
      : {}),
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
    ...('image_plan_id' in input.instruction && input.instruction.image_plan_id
      ? {
          image_plan: {
            image_plan_id: input.instruction.image_plan_id,
            display_attachment_refs: input.instruction.display_attachment_refs ?? [],
            apply_after_persist_status: input.imagePlanApplyError ? 'failed' : 'linked',
            ...(input.imagePlanApplyError
              ? { apply_after_persist_error: input.imagePlanApplyError }
              : {}),
          },
        }
      : {}),
  }

  if (!input.observation) {
    return base
  }

  return attachPersonaObservation(base, input.observation)
}

function buildVoteRunOutput(instruction: Extract<WriteInstruction, { action: 'vote' }>): Record<string, unknown> {
  return {
    vote_target_type: instruction.target_type,
    vote_target_id: instruction.target_id,
    vote_direction: instruction.direction,
    vote_outcome: instruction.direction === 'NEUTRAL' ? 'clear' : 'cast',
    vote_source_event_id: instruction.source_event_id,
    ...(typeof instruction.confidence === 'number'
      ? { vote_confidence: instruction.confidence }
      : {}),
    ...(instruction.rationale_code
      ? { vote_rationale_code: instruction.rationale_code }
      : {}),
  }
}
