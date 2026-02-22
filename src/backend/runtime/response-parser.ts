import type { ExecutionContext, WriteInstruction } from './types.js'

/**
 * Parses raw LLM output into a structured WriteInstruction
 * based on the event type and execution context.
 */
export class ResponseParser {
  parse(llmOutput: string, ctx: ExecutionContext): WriteInstruction | null {
    const trimmed = llmOutput.trim()
    if (!trimmed) return null

    switch (ctx.event.event_type) {
      case 'NewPostCreated':
        return this.parseReplyToPost(trimmed, ctx)
      case 'NewCommentCreated':
        return this.parseReplyToComment(trimmed, ctx)
      default:
        return null
    }
  }

  private parseReplyToPost(text: string, ctx: ExecutionContext): WriteInstruction | null {
    if (!ctx.post) return null

    return {
      action: 'create_comment',
      community_id: ctx.community.id,
      post_id: ctx.post.id,
      body: text,
    }
  }

  private parseReplyToComment(text: string, ctx: ExecutionContext): WriteInstruction | null {
    if (!ctx.post) return null

    return {
      action: 'create_comment',
      community_id: ctx.community.id,
      post_id: ctx.post.id,
      parent_comment_id: ctx.targetComment?.id,
      body: text,
    }
  }

  /**
   * Parse LLM output as a new post (title + body).
   * Expected format: first line = title, blank line, rest = body.
   */
  parseAsNewPost(text: string, communityId: string): WriteInstruction | null {
    const trimmed = text.trim()
    if (!trimmed) return null

    const lines = trimmed.split('\n')
    const title = lines[0].trim()

    let bodyStart = 1
    while (bodyStart < lines.length && lines[bodyStart].trim() === '') {
      bodyStart++
    }

    const body = lines.slice(bodyStart).join('\n').trim()

    if (!title || !body) return null

    return {
      action: 'create_post',
      community_id: communityId,
      title,
      body,
    }
  }
}
