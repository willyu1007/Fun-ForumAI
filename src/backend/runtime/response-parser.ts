import type { ExecutionContext, WriteInstruction } from './types.js'
import { sanitizeChatOutput } from './chat-output-sanitizer.js'

interface CommunityCandidate {
  id: string
  slug?: string
  name?: string
}

interface ScheduledPostDraft {
  community_id: string | null
  title: string
  body: string
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
      case 'ThreadOpened':
      case 'ThreadTurnAdded':
        return this.parseReplyToThreadTurn(trimmed, ctx)
      case 'NewMessageCreated':
        return this.parseChatReply(trimmed, ctx)
      default:
        return null
    }
  }

  private parseReplyToPost(text: string, ctx: ExecutionContext): WriteInstruction | null {
    if (!ctx.post) return null

    return {
      action: 'open_thread',
      community_id: ctx.community.id,
      post_id: ctx.post.id,
      body: text,
    }
  }

  private parseReplyToThreadTurn(text: string, ctx: ExecutionContext): WriteInstruction | null {
    if (!ctx.post) return null
    const replyThreadId = ctx.forum_targeting?.reply_thread_id ?? null
    if (!replyThreadId) return null

    return {
      action: 'add_thread_turn',
      community_id: ctx.community.id,
      post_id: ctx.post.id,
      thread_id: replyThreadId,
      ...(ctx.forum_targeting?.final_write_anchor_turn_id
        ? { anchor_turn_id: ctx.forum_targeting.final_write_anchor_turn_id }
        : {}),
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
    const normalized = normalizeScheduledPostText(input.text)
    const parsed = this.tryParseScheduledJson(normalized, input.communities)
      ?? this.tryParseScheduledLabeledPost(normalized, input.communities)
      ?? this.tryParseScheduledPlainPost(normalized, input.communities)

    if (!parsed) return null
    if (input.lockedCommunityId && parsed.community_id && parsed.community_id !== input.lockedCommunityId) {
      return null
    }
    return {
      action: 'create_post',
      community_id: input.lockedCommunityId
        ?? parsed.community_id
        ?? input.fallbackCommunityId,
      title: parsed.title,
      body: parsed.body,
    }
  }

  private tryParseScheduledJson(
    text: string,
    communities: CommunityCandidate[],
  ): ScheduledPostDraft | null {
    const first = text.indexOf('{')
    const last = text.lastIndexOf('}')
    if (first < 0 || last <= first) return null

    try {
      const parsed = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>
      for (const payload of candidatePayloads(parsed)) {
        const title = firstString(payload, ['title', 'post_title', 'headline', 'subject', '标题'])
        const body = firstString(payload, ['body', 'post_body', 'content', 'text', '正文', '内容'])
        if (!title || !body) continue

        const communityRef = firstString(payload, [
          'community_id_or_slug',
          'community_id',
          'community_slug',
          'target_community',
          'community',
          'community_name',
          '社区',
        ]) ?? ''

        return {
          community_id: this.resolveCommunityId(communityRef, communities),
          title: cleanupScheduledTitle(title),
          body: cleanupScheduledBody(body),
        }
      }
      return null
    } catch {
      return null
    }
  }

  private tryParseScheduledLabeledPost(
    text: string,
    communities: CommunityCandidate[],
  ): ScheduledPostDraft | null {
    const lines = text.split('\n')
    let title = ''
    let communityRef = ''
    const bodyLines: string[] = []
    let inBody = false

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index].trim()
      if (!line) {
        if (inBody) bodyLines.push('')
        continue
      }
      const label = parseLabeledLine(line)
      if (!label) {
        if (inBody) {
          bodyLines.push(lines[index])
        }
        continue
      }

      if (!title && isTitleLabel(label.key)) {
        title = label.value
        const trailingBody = collectTrailingInlineBody(label.rest)
        if (trailingBody) {
          bodyLines.push(trailingBody)
          inBody = true
        }
        continue
      }

      if (!communityRef && isCommunityLabel(label.key)) {
        communityRef = label.value
        continue
      }

      if (isBodyLabel(label.key)) {
        inBody = true
        if (label.value) bodyLines.push(label.value)
        continue
      }

      if (inBody) {
        bodyLines.push(lines[index])
      }
    }

    const cleanedTitle = cleanupScheduledTitle(title)
    const cleanedBody = cleanupScheduledBody(bodyLines.join('\n'))
    if (!cleanedTitle || !cleanedBody) return null

    return {
      community_id: this.resolveCommunityId(communityRef, communities),
      title: cleanedTitle,
      body: cleanedBody,
    }
  }

  private tryParseScheduledPlainPost(
    text: string,
    communities: CommunityCandidate[],
  ): ScheduledPostDraft | null {
    const lines = text.split('\n')
    const firstLine = cleanupScheduledTitle(lines[0] ?? '')
    if (!firstLine) return null

    let bodyStart = 1
    while (bodyStart < lines.length && lines[bodyStart].trim() === '') {
      bodyStart++
    }

    const body = cleanupScheduledBody(lines.slice(bodyStart).join('\n'))
    if (body) {
      return {
        community_id: this.resolveCommunityId('', communities),
        title: firstLine,
        body,
      }
    }

    if (!canSynthesizeScheduledBody(text, firstLine)) return null
    const fallbackBody = buildScheduledBodyFromTitle(firstLine)
    if (!fallbackBody) return null

    return {
      community_id: this.resolveCommunityId('', communities),
      title: firstLine,
      body: fallbackBody,
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

function normalizeScheduledPostText(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json|markdown|md|text|txt)?\s*\n([\s\S]*?)\n```$/i)
  return (fenced?.[1] ?? trimmed).trim()
}

function candidatePayloads(value: Record<string, unknown>): Record<string, unknown>[] {
  const nested = ['post', 'data', 'result']
    .map((key) => value[key])
    .filter((item): item is Record<string, unknown> => isPlainRecord(item))
  return [value, ...nested]
}

function firstString(value: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  return null
}

function cleanupScheduledTitle(value: string): string {
  return value
    .replace(/^#{1,6}\s*/, '')
    .replace(/^(?:标题|title|headline|subject)\s*[:：]\s*/i, '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .trim()
}

function cleanupScheduledBody(value: string): string {
  return value
    .replace(/^(?:正文|内容|body|content)\s*[:：]\s*/i, '')
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .trim()
}

function parseLabeledLine(line: string): {
  key: string
  value: string
  rest: string
} | null {
  const match = line.match(/^([A-Za-z\u4e00-\u9fff_ ]{2,32})\s*[:：]\s*(.*)$/)
  if (!match) return null
  return {
    key: match[1].trim().toLowerCase(),
    value: match[2].trim(),
    rest: match[2].trim(),
  }
}

function isTitleLabel(key: string): boolean {
  return key === '标题' || key === 'title' || key === 'headline' || key === 'subject'
}

function isBodyLabel(key: string): boolean {
  return key === '正文' || key === '内容' || key === 'body' || key === 'content'
}

function isCommunityLabel(key: string): boolean {
  return key === 'community'
    || key === 'community_id'
    || key === 'community_slug'
    || key === 'community_name'
    || key === 'target_community'
    || key === '社区'
}

function collectTrailingInlineBody(value: string): string {
  const inlineMatch = value.match(/(?:正文|内容|body|content)\s*[:：]\s*(.+)$/i)
  return inlineMatch?.[1]?.trim() ?? ''
}

function canSynthesizeScheduledBody(rawText: string, title: string): boolean {
  if (!title) return false
  if (title.length < 6 || title.length > 120) return false
  if (/^[{[]/.test(rawText.trim())) return false
  if (/[{}[\]]/.test(title)) return false
  return true
}

function buildScheduledBodyFromTitle(title: string): string | null {
  const cjkCount = Array.from(title).filter((char) => /[\u4e00-\u9fff]/.test(char)).length
  const isCjkHeavy = cjkCount >= Math.max(2, Math.floor(title.length / 3))
  const looksQuestion = /[?？]$/.test(title)

  if (isCjkHeavy) {
    return looksQuestion
      ? '先把这个问题抛出来，想听听大家会怎么拆。\n\n你会先看表层反应，还是背后的动机和语境？'
      : '我先把这个点摆出来，想看看大家会从哪个角度继续展开。\n\n你更在意它背后的原因、影响，还是更具体的例子？'
  }

  return looksQuestion
    ? 'I want to put this question on the table first and hear how others would unpack it.\n\nWould you start from the surface reaction, the motive underneath, or the larger context?'
    : 'I want to put this point on the table first and see which angle others would push further.\n\nAre you more interested in the cause behind it, the impact it creates, or a sharper concrete example?'
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
