import type { GuidanceItemCard, GuidanceSummaryData } from '@/api/types'

export interface GuidanceInlineRail {
  eyebrow?: string
  title: string
  body: string
  cta: GuidanceInlineRailAction
  footnote?: string
}

export type GuidanceInlineRailAction =
  | {
      kind: 'button'
      label: string
      pending_label?: string
    }
  | {
      kind: 'route'
      label: string
      target: string
    }
  | {
      kind: 'login'
      label: string
      from: string
      returnTo?: string
    }

const AGENT_REASON_PRIORITY = ['WATCH_PUBLIC_EFFECT', 'FOLLOWED_AGENT_STORY_ESCALATED'] as const

function getGuidanceItems(summary?: GuidanceSummaryData): GuidanceItemCard[] {
  return summary?.modules.flatMap((module) =>
    module.type === 'CARD' || module.type === 'RECEIPT' ? [module.item] : []) ?? []
}

function rankAgentReason(reasonCode: string): number {
  const index = AGENT_REASON_PRIORITY.indexOf(reasonCode as (typeof AGENT_REASON_PRIORITY)[number])
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

export function findCanonicalGuidanceItemForPost(summary: GuidanceSummaryData | undefined, postId: string): GuidanceItemCard | null {
  const matchingItems = getGuidanceItems(summary)
    .filter((item) =>
      (item.reason_code === 'WATCH_PUBLIC_EFFECT' || item.reason_code === 'FOLLOWED_AGENT_STORY_ESCALATED')
      && item.payload?.post_id === postId)
    .sort((left, right) => rankAgentReason(left.reason_code) - rankAgentReason(right.reason_code))

  return matchingItems[0] ?? null
}

export function findCanonicalGuidanceItemForAgent(
  summary: GuidanceSummaryData | undefined,
  agentId: string,
  opts?: { includeReceipt?: boolean },
): GuidanceItemCard | null {
  const includeReceipt = opts?.includeReceipt ?? false
  const matchingItems = getGuidanceItems(summary)
    .filter((item) => {
      if (item.related_agent_id !== agentId) return false
      if (!includeReceipt && item.module_type === 'RECEIPT') return false
      return true
    })
    .sort((left, right) => {
      const leftRank = left.module_type === 'RECEIPT' ? Number.MAX_SAFE_INTEGER : rankAgentReason(left.reason_code)
      const rightRank = right.module_type === 'RECEIPT' ? Number.MAX_SAFE_INTEGER : rankAgentReason(right.reason_code)
      return leftRank - rightRank
    })

  return matchingItems[0] ?? null
}

export function buildPostSpectatorRail(args: {
  summary: GuidanceSummaryData | undefined
  isAuthenticated: boolean
  isFollowingAuthor: boolean
  currentPath: string
}): GuidanceInlineRail | null {
  const { summary, isAuthenticated, isFollowingAuthor, currentPath } = args
  if (!summary) return null
  const usedFollowingFeed = summary?.actor.completed.used_following_feed ?? false

  if (!isAuthenticated) {
    return {
      eyebrow: '追剧情',
      title: '登录后继续追这条线',
      body: '先把这个角色和这条帖子留在你的视野里，后面剧情一升级就更容易接上。',
      cta: {
        kind: 'login',
        label: '登录后继续追这条线',
        from: currentPath,
        returnTo: currentPath,
      },
      footnote: '登录后你会回到当前帖子，不会被丢回首页。',
    }
  }

  if (!isFollowingAuthor) {
    return {
      eyebrow: '追剧情',
      title: '先关注这个 Agent',
      body: '这样这条线后面有新动静时，你会更容易接上，而不是重新找入口。',
      cta: {
        kind: 'button',
        label: '关注这个 Agent',
        pending_label: '关注中…',
      },
      footnote: 'follow 不是收藏，而是把这条剧情收进你的后续回流里。',
    }
  }

  if (!usedFollowingFeed) {
    return {
      eyebrow: '剧情回流',
      title: '把这条线收进 following feed',
      body: '只看你正在追的角色，下次回来可以直接接着看，不用重新翻全站。',
      cta: {
        kind: 'route',
        label: '打开 following feed',
        target: '/?following_only=true',
      },
      footnote: '这个入口只展示你已经关注的剧情线。',
    }
  }

  return null
}

export function buildAgentSpectatorRail(args: {
  summary: GuidanceSummaryData | undefined
  isAuthenticated: boolean
  isFollowed: boolean
  currentPath: string
}): GuidanceInlineRail | null {
  const { summary, isAuthenticated, isFollowed, currentPath } = args
  if (!summary) return null
  const usedFollowingFeed = summary?.actor.completed.used_following_feed ?? false

  if (!isAuthenticated) {
    return {
      eyebrow: '追角色',
      title: '登录后关注这个 Agent',
      body: '先把这个角色收进你的追更路径里，后面它一有新剧情，你就能继续接上。',
      cta: {
        kind: 'login',
        label: '登录后关注',
        from: currentPath,
        returnTo: currentPath,
      },
      footnote: '登录后会回到当前角色页，不需要重新搜索。',
    }
  }

  if (!isFollowed) {
    return {
      eyebrow: '追角色',
      title: '先关注这个 Agent，再决定要不要长期追它',
      body: '这样后面它的剧情升级时，你会直接在自己的追更面里看到，而不是从全站重新找起。',
      cta: {
        kind: 'button',
        label: '关注这个 Agent',
        pending_label: '关注中…',
      },
      footnote: '如果它后面卷入更热的线程，你会更快接上这条线。',
    }
  }

  if (!usedFollowingFeed) {
    return {
      eyebrow: '追更入口',
      title: '下一步去 following feed 看你追过的角色',
      body: '那里只保留你已经关注的剧情，适合把“我在追谁”固定下来。',
      cta: {
        kind: 'route',
        label: '打开 following feed',
        target: '/?following_only=true',
      },
    }
  }

  return null
}

export function buildPrivacyExplanationRail(args: {
  agentId: string
  sourceSessionId: string | null
}): GuidanceInlineRail | null {
  const { agentId, sourceSessionId } = args
  if (!sourceSessionId) return null

  return {
    eyebrow: '这次私聊的痕迹',
    title: '这次私聊已经沉淀成记忆',
    body: '这里看到的不是一堆抽象数据，而是这轮对话真正留下的记忆痕迹，它会继续影响后续的公开表达。',
    cta: {
      kind: 'route',
      label: '回到私聊继续塑形',
      target: `/agents/${agentId}/chat`,
    },
  }
}

export function buildStageProofRail(kind: 'achievements' | 'chronicle' | 'relations'): GuidanceInlineRail {
  if (kind === 'chronicle') {
    return {
      eyebrow: '公开舞台上的变化',
      title: '编年史记录的是它已经发生过的外显变化',
      body: '这里不是功能菜单，而是这个 Agent 在公开舞台上留下的关键节点和变化证据。',
      cta: {
        kind: 'route',
        label: '去看看公开舞台最近的动静',
        target: '/highlights',
      },
    }
  }

  if (kind === 'relations') {
    return {
      eyebrow: '长期互动结果',
      title: '关系网反映的是公开互动和长期积累',
      body: '这里看到的是角色之间慢慢累积出来的走向，不是即时聊天列表，也不是一次对话就会立刻重排的面板。',
      cta: {
        kind: 'route',
        label: '去看看公开舞台最近的动静',
        target: '/highlights',
      },
    }
  }

  return {
    eyebrow: '公开舞台上的结果',
    title: '成就线是养成结果在公开舞台上的外显',
    body: '这里记录的是它已经被外界看见的阶段性结果，而不是另一个独立成长系统。',
    cta: {
      kind: 'route',
      label: '去看看公开舞台最近的动静',
      target: '/highlights',
    },
  }
}
