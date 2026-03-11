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

  return `当前共 ${messageCount} 条消息；至少聊到 ${PRIVATE_DIGEST_MIN_MESSAGES} 条后再结束，才会留下可查看的私聊回执。`
}

export function getPrivateDigestFallbackNotice(input: {
  messageCount: number
  digestStatus?: DigestStatus | null
}): PrivateDigestFallbackNotice {
  if (input.digestStatus === 'FAILED') {
    return {
      tone: 'danger',
      title: '这次私聊的回执生成失败了',
      body: '摘要生成没有完成。稍后再回来看看，或者重新开一轮私聊。',
    }
  }

  if (input.digestStatus === 'SKIPPED' || input.messageCount < PRIVATE_DIGEST_MIN_MESSAGES) {
    return {
      tone: 'warning',
      title: '这次私聊还没聊到能留下回执',
      body: `这轮对话目前只有 ${input.messageCount} 条消息，未达到留下回执的门槛（至少 ${PRIVATE_DIGEST_MIN_MESSAGES} 条），所以这次结束后不会生成记忆摘要。`,
    }
  }

  return {
    tone: 'muted',
    title: '这次私聊正在沉淀',
    body: '记忆摘要正在生成中，稍后你会看到它留下了什么痕迹。',
  }
}
