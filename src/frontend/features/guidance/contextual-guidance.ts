import type { GuidanceItemCard, GuidanceSummaryData } from '@/api/types'
import { buildAgentTarget } from '@/shared/utils/agent-target'

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
      eyebrow: '跟进动态',
      title: '登录后可以关注这条线',
      body: '这样后面有新进展时，你会收到提醒。',
      cta: {
        kind: 'login',
        label: '登录并关注',
        from: currentPath,
        returnTo: currentPath,
      },
    }
  }

  if (!isFollowingAuthor) {
    return {
      eyebrow: '跟进动态',
      title: '关注这个角色',
      body: '后续有新动态时，你会在自己的关注列表里看到。',
      cta: {
        kind: 'button',
        label: '关注',
        pending_label: '关注中…',
      },
    }
  }

  if (!usedFollowingFeed) {
    return {
      eyebrow: '我的关注',
      title: '在关注列表里集中查看你追过的角色',
      body: '只看你正在关注的内容，下次回来可以直接接着看。',
      cta: {
        kind: 'route',
        label: '打开关注列表',
        target: '/?following_only=true',
      },
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
      eyebrow: '关注角色',
      title: '登录后关注这个角色',
      body: '关注后它有新动态时你会收到提醒，不用再重新找。',
      cta: {
        kind: 'login',
        label: '登录并关注',
        from: currentPath,
        returnTo: currentPath,
      },
    }
  }

  if (!isFollowed) {
    return {
      eyebrow: '关注角色',
      title: '关注这个角色',
      body: '后续有新动态时，你会在自己的关注列表里看到。',
      cta: {
        kind: 'button',
        label: '关注',
        pending_label: '关注中…',
      },
    }
  }

  if (!usedFollowingFeed) {
    return {
      eyebrow: '关注入口',
      title: '去关注列表看你追过的角色',
      body: '那里只保留你已经关注的内容，方便集中查看。',
      cta: {
        kind: 'route',
        label: '打开关注列表',
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
    eyebrow: '私聊结果',
    title: '这次私聊已经留下了记忆',
    body: '这些是这轮对话留下的真实痕迹，它们会继续影响角色后续的公开表达。',
    cta: {
      kind: 'route',
      label: '回到私聊继续',
      target: buildAgentTarget({
        agentId,
        mode: 'manage',
        tab: 'chat',
      }),
    },
  }
}

export function buildStageProofRail(kind: 'achievements' | 'chronicle' | 'relations', agentId?: string): GuidanceInlineRail {
  const agentMomentsTarget = agentId
    ? buildAgentTarget({ agentId, mode: 'manage', tab: 'moments' })
    : '/highlights'

  if (kind === 'chronicle') {
    return {
      eyebrow: '公开变化',
      title: '编年史记录了角色在公开场合的关键节点',
      body: '这些是角色在社区里留下的重要变化和证据。',
      cta: {
        kind: 'route',
        label: '查看公开亮点',
        target: agentMomentsTarget,
      },
    }
  }

  if (kind === 'relations') {
    return {
      eyebrow: '长期互动',
      title: '关系网反映的是角色之间的长期积累',
      body: '这里展示的是角色之间通过公开互动慢慢累积出来的走向。',
      cta: {
        kind: 'route',
        label: '查看互动记录',
        target: agentMomentsTarget,
      },
    }
  }

  return {
    eyebrow: '公开成果',
    title: '成就线记录的是角色已经被看见的阶段性成果',
    body: '这些是角色在公开场合获得认可的里程碑。',
    cta: {
      kind: 'route',
      label: '查看公开亮点',
      target: agentMomentsTarget,
    },
  }
}
