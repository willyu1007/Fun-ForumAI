import type { ExecutionContext, WriteInstruction } from './types.js'
import { sanitizeChatOutput } from './chat-output-sanitizer.js'

interface CommunityCandidate {
  id: string
  slug?: string
  name?: string
}

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
      case 'NewMessageCreated':
        return this.parseChatReply(trimmed, ctx)
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

  private parseChatReply(text: string, ctx: ExecutionContext): WriteInstruction | null {
    if (!ctx.event.room_id) return null
    const sanitized = sanitizeChatOutput(text)
    if (!sanitized.text || sanitized.looks_meta) return null

    const skipMatch = sanitized.text.match(/^\[SKIP(?::(.+?))?\]/)
    if (skipMatch) {
      const feedback = skipMatch[1]?.trim() || ''
      return {
        action: 'create_message',
        community_id: ctx.community.id,
        room_id: ctx.event.room_id,
        body: feedback,
        message_kind: feedback ? 'skip_feedback' : 'skip_feedback',
      }
    }

    return {
      action: 'create_message',
      community_id: ctx.community.id,
      room_id: ctx.event.room_id,
      body: sanitized.text,
      message_kind: 'normal',
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

  parseAsScheduledPost(input: {
    text: string
    fallbackCommunityId: string
    communities: CommunityCandidate[]
    lockedCommunityId?: string
  }): WriteInstruction | null {
    const jsonResult = this.tryParseScheduledJson(input.text, input.communities)
    if (jsonResult) {
      if (input.lockedCommunityId && jsonResult.community_id && jsonResult.community_id !== input.lockedCommunityId) {
        return null
      }
      return {
        action: 'create_post',
        community_id: input.lockedCommunityId
          ?? jsonResult.community_id
          ?? input.fallbackCommunityId,
        title: jsonResult.title,
        body: jsonResult.body,
      }
    }
    return this.parseAsNewPost(input.text, input.lockedCommunityId ?? input.fallbackCommunityId)
  }

  private tryParseScheduledJson(
    text: string,
    communities: CommunityCandidate[],
  ): { community_id: string | null; title: string; body: string } | null {
    const first = text.indexOf('{')
    const last = text.lastIndexOf('}')
    if (first < 0 || last <= first) return null

    try {
      const payload = JSON.parse(text.slice(first, last + 1)) as {
        community_id_or_slug?: string
        community_id?: string
        community_slug?: string
        community?: string
        target_community?: string
        title?: string
        body?: string
      }

      const title = String(payload.title ?? '').trim()
      const body = String(payload.body ?? '').trim()
      if (!title || !body) return null

      const communityRef = String(
        payload.community_id_or_slug
          ?? payload.community_id
          ?? payload.community_slug
          ?? payload.target_community
          ?? payload.community
          ?? '',
      ).trim()

      return {
        community_id: this.resolveCommunityId(communityRef, communities),
        title,
        body,
      }
    } catch {
      return null
    }
  }

  private resolveCommunityId(reference: string, communities: CommunityCandidate[]): string | null {
    if (!reference) return null
    const normalized = reference.trim().toLowerCase()
    const match = communities.find((item) => {
      if (item.id.toLowerCase() === normalized) return true
      if (item.slug && item.slug.toLowerCase() === normalized) return true
      if (item.name && item.name.toLowerCase() === normalized) return true
      return false
    })
    return match?.id ?? null
  }
}
