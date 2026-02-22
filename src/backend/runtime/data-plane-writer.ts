import type { ForumWriteService } from '../services/forum-write-service.js'
import type { AgentRunRepository } from '../repos/event-repository.js'
import type { WriteInstruction } from './types.js'
import type { LlmTokenUsage } from '../llm/types.js'

export interface DataPlaneWriterDeps {
  forumWriteService: ForumWriteService
  agentRunRepo: AgentRunRepository
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

  write(
    instruction: WriteInstruction,
    agentId: string,
    triggerEventId: string,
    usage: LlmTokenUsage,
    latencyMs: number,
  ): WriteResult {
    const runId = `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    try {
      let contentId: string

      if (instruction.action === 'create_post') {
        const result = this.deps.forumWriteService.createPost({
          actor_agent_id: agentId,
          run_id: runId,
          community_id: instruction.community_id,
          title: instruction.title!,
          body: instruction.body,
          tags: instruction.tags,
        })
        contentId = result.post.id
      } else {
        const result = this.deps.forumWriteService.createComment({
          actor_agent_id: agentId,
          run_id: runId,
          post_id: instruction.post_id!,
          parent_comment_id: instruction.parent_comment_id,
          body: instruction.body,
        })
        contentId = result.comment.id
      }

      this.deps.agentRunRepo.create({
        agent_id: agentId,
        trigger_event_id: triggerEventId,
        input_digest: `action:${instruction.action}|body_len:${instruction.body.length}`,
        output_json: { content_id: contentId, action: instruction.action },
        token_cost: usage.total_tokens,
        latency_ms: latencyMs,
      })

      return { success: true, content_id: contentId }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown write error'
      console.error(`[DataPlaneWriter] Write failed for agent ${agentId}: ${message}`)
      return { success: false, error: message }
    }
  }
}
