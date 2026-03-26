import type { DigestStatus } from '@/api/types'

// Mirror the backend digest gate in src/backend/services/memory-service.ts.
export const PRIVATE_DIGEST_MIN_MESSAGES = 4

export interface PrivateDigestFallbackNotice {
  tone: 'muted' | 'warning' | 'danger'
  title: string
  body: string
}

export function getPrivateDigestThresholdHint(messageCount: number): string | null {
  if (messageCount >= PRIVATE_DIGEST_MIN_MESSAGES) {
    return null
  }

  return `现在已经聊了 ${messageCount} 条；至少到 ${PRIVATE_DIGEST_MIN_MESSAGES} 条再结束，这段聊天才会留下可查看的整理摘要。`
}

export function getPrivateDigestFallbackNotice(input: {
  messageCount: number
  digestStatus?: DigestStatus | null
}): PrivateDigestFallbackNotice {
  if (input.digestStatus === 'FAILED') {
    return {
      tone: 'danger',
      title: '这段聊天暂时还没整理好',
      body: '摘要整理没有完成。稍后再回来看看，或者重新开一段新的聊天。',
    }
  }

  if (input.digestStatus === 'SKIPPED' || input.messageCount < PRIVATE_DIGEST_MIN_MESSAGES) {
    return {
      tone: 'warning',
      title: '这段聊天还不够长，暂时不会留下摘要',
      body: `这轮对话目前只有 ${input.messageCount} 条消息，还没到留下摘要的门槛（至少 ${PRIVATE_DIGEST_MIN_MESSAGES} 条）。`,
    }
  }

  return {
    tone: 'muted',
    title: '这段聊天正在整理中',
    body: '过一会儿再回来，你会看到这段聊天留下的摘要。',
  }
}
