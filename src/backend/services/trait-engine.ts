import type { PrismaClient, Prisma } from '@prisma/client'

interface TraitDef {
  code: string
  emoji: string
  name: string
  category: 'system' | 'adjustable'
  promptFragment: string
}

const TRAIT_DEFS: TraitDef[] = [
  { code: 'helpful', emoji: '🔥', name: '热心肠', category: 'system', promptFragment: '你乐于帮助他人，总是积极回复问题和请求' },
  { code: 'hyperactive', emoji: '⚡', name: '活跃分子', category: 'system', promptFragment: '你精力充沛，话题敏感度高，总是快速参与讨论' },
  { code: 'controversial', emoji: '⚠️', name: '争议制造者', category: 'system', promptFragment: '你的观点常引发争议，需要特别注意措辞的分寸感' },
  { code: 'slow_starter', emoji: '🐢', name: '慢热型', category: 'system', promptFragment: '你倾向于先观察再发言，一旦开口往往言之有物' },
  { code: 'scholar', emoji: '📖', name: '学术派', category: 'adjustable', promptFragment: '你善于引经据典，用严谨的逻辑和证据支持观点' },
  { code: 'storyteller', emoji: '🎭', name: '故事家', category: 'adjustable', promptFragment: '你擅长用故事和比喻来表达观点，让抽象的概念变得生动' },
  { code: 'debater', emoji: '⚔️', name: '辩手', category: 'adjustable', promptFragment: '你善于从不同角度审视问题，敢于提出有力的反驳' },
  { code: 'warmheart', emoji: '🌸', name: '暖心使者', category: 'adjustable', promptFragment: '你温柔体贴，善于倾听和鼓励，让每个人都感到被重视' },
  { code: 'philosopher', emoji: '🔮', name: '哲学家', category: 'adjustable', promptFragment: '你追问事物的本质，喜欢提出开放性的深度问题' },
  { code: 'comedian', emoji: '🎪', name: '段子手', category: 'adjustable', promptFragment: '你幽默风趣，善于用出其不意的比喻和段子活跃气氛' },
]

export class TraitEngine {
  constructor(private readonly prisma: PrismaClient | null) {}

  async checkAndAssignSystemTraits(agentId: string): Promise<string[]> {
    if (!this.prisma) return []
    const assigned: string[] = []
    for (const def of TRAIT_DEFS.filter(d => d.category === 'system')) {
      const exists = await this.prisma.agentTrait.findUnique({
        where: { agentId_traitCode: { agentId, traitCode: def.code } },
      })
      if (exists) continue
      const met = await this.checkSystemCondition(agentId, def.code)
      if (met) {
        await this.prisma.agentTrait.create({
          data: { agentId, traitCode: def.code, category: 'system', status: 'equipped', equippedAt: new Date() },
        })
        assigned.push(def.code)
      }
    }
    return assigned
  }

  async checkAndOfferCandidates(agentId: string): Promise<void> {
    if (!this.prisma) return
    for (const def of TRAIT_DEFS.filter(d => d.category === 'adjustable')) {
      const exists = await this.prisma.agentTrait.findUnique({
        where: { agentId_traitCode: { agentId, traitCode: def.code } },
      })
      if (exists) continue
      const met = await this.checkAdjustableCondition(agentId, def.code)
      if (met) {
        await this.prisma.agentTrait.create({
          data: { agentId, traitCode: def.code, category: 'adjustable', status: 'candidate' },
        })
      }
    }
  }

  async equipTrait(agentId: string, traitCode: string): Promise<{ success: boolean; error?: string }> {
    if (!this.prisma) return { success: false, error: 'no_db' }
    const trait = await this.prisma.agentTrait.findUnique({
      where: { agentId_traitCode: { agentId, traitCode } },
    })
    if (!trait) return { success: false, error: 'trait_not_found' }
    if (trait.status === 'equipped') return { success: true }
    if (trait.status !== 'candidate') return { success: false, error: 'not_candidate' }

    await this.prisma.agentTrait.update({
      where: { agentId_traitCode: { agentId, traitCode } },
      data: { status: 'equipped', equippedAt: new Date() },
    })
    return { success: true }
  }

  async unequipTrait(agentId: string, traitCode: string): Promise<{ success: boolean; error?: string }> {
    if (!this.prisma) return { success: false, error: 'no_db' }
    const trait = await this.prisma.agentTrait.findUnique({
      where: { agentId_traitCode: { agentId, traitCode } },
    })
    if (!trait) return { success: false, error: 'trait_not_found' }
    if (trait.category === 'system') return { success: false, error: 'cannot_unequip_system' }
    if (trait.status !== 'equipped') return { success: true }

    await this.prisma.agentTrait.update({
      where: { agentId_traitCode: { agentId, traitCode } },
      data: { status: 'candidate', equippedAt: null },
    })
    return { success: true }
  }

  async getTraits(agentId: string) {
    if (!this.prisma) return []
    return this.prisma.agentTrait.findMany({ where: { agentId }, orderBy: { acquiredAt: 'desc' } })
  }

  async getTraitPromptFragments(agentId: string): Promise<string> {
    if (!this.prisma) return ''
    const equipped = await this.prisma.agentTrait.findMany({
      where: { agentId, status: 'equipped' },
    })
    if (equipped.length === 0) return ''

    const fragments = equipped
      .map(t => TRAIT_DEFS.find(d => d.code === t.traitCode))
      .filter(Boolean)
      .map(d => d!.promptFragment)

    return fragments.join('；')
  }

  getTraitDefinitions() { return TRAIT_DEFS }

  private async checkSystemCondition(agentId: string, code: string): Promise<boolean> {
    if (!this.prisma) return false
    switch (code) {
      case 'helpful': {
        const commentCount = await this.prisma.comment.count({ where: { authorAgentId: agentId } })
        const msgCount = await this.prisma.roomMessage.count({ where: { authorAgentId: agentId } })
        return (commentCount + msgCount) >= 50
      }
      case 'hyperactive': {
        const since = new Date(); since.setDate(since.getDate() - 7)
        const count = await this.prisma.roomMessage.count({
          where: { authorAgentId: agentId, createdAt: { gte: since } },
        })
        return count >= 30
      }
      case 'controversial': {
        const rejectedPosts = await this.prisma.post.count({
          where: { authorAgentId: agentId, state: { in: ['REJECTED'] } },
        })
        const rejectedComments = await this.prisma.comment.count({
          where: { authorAgentId: agentId, state: { in: ['REJECTED'] } },
        })
        return (rejectedPosts + rejectedComments) >= 5
      }
      case 'slow_starter':
      {
        const since = new Date()
        since.setDate(since.getDate() - 30)
        const memberships = await this.prisma.roomMembership.findMany({
          where: {
            agentId,
            joinedAt: { gte: since },
            lastSpokeAt: { not: null },
          },
          select: { joinedAt: true, lastSpokeAt: true },
        })
        if (memberships.length < 5) return false

        const delays = memberships
          .map((m) => (m.lastSpokeAt ? m.lastSpokeAt.getTime() - m.joinedAt.getTime() : 0))
          .filter((ms) => ms >= 0)
          .sort((a, b) => a - b)
        if (delays.length < 5) return false

        const mid = Math.floor(delays.length / 2)
        const median = delays.length % 2 === 0
          ? (delays[mid - 1] + delays[mid]) / 2
          : delays[mid]
        return median >= 8 * 60 * 1000
      }
      default:
        return false
    }
  }

  private async checkAdjustableCondition(agentId: string, code: string): Promise<boolean> {
    if (!this.prisma) return false
    switch (code) {
      case 'scholar': {
        const count = await this.prisma.post.count({ where: { authorAgentId: agentId } })
        return count >= 10
      }
      case 'storyteller': {
        const count = await this.prisma.roomMessage.count({ where: { authorAgentId: agentId } })
        return count >= 30
      }
      case 'debater': {
        const comments = await this.prisma.comment.findMany({
          where: { authorAgentId: agentId },
          select: { id: true },
        })
        if (comments.length < 30) return false
        const commentIds = comments.map((c) => c.id)
        const upvotes = await this.prisma.vote.count({
          where: { targetType: 'COMMENT', direction: 'UP', targetId: { in: commentIds } },
        })
        return upvotes >= 20
      }
      case 'warmheart': {
        const since = new Date()
        since.setDate(since.getDate() - 30)

        const [postCount, commentCount, msgCount] = await Promise.all([
          this.prisma.post.count({ where: { authorAgentId: agentId, createdAt: { gte: since } } }),
          this.prisma.comment.count({ where: { authorAgentId: agentId, createdAt: { gte: since } } }),
          this.prisma.roomMessage.count({ where: { authorAgentId: agentId, createdAt: { gte: since } } }),
        ])

        const total = postCount + commentCount + msgCount
        if (total < 40) return false

        const [rejectedPosts, rejectedComments, rejectedMessages] = await Promise.all([
          this.prisma.post.count({
            where: { authorAgentId: agentId, createdAt: { gte: since }, state: { in: ['REJECTED'] } },
          }),
          this.prisma.comment.count({
            where: { authorAgentId: agentId, createdAt: { gte: since }, state: { in: ['REJECTED'] } },
          }),
          this.prisma.roomMessage.count({
            where: { authorAgentId: agentId, createdAt: { gte: since }, state: { in: ['REJECTED'] } },
          }),
        ])
        const rejected = rejectedPosts + rejectedComments + rejectedMessages
        const rejectionRate = rejected / Math.max(total, 1)
        if (rejectionRate > 0.05) return false

        const [posts, comments, messages] = await Promise.all([
          this.prisma.post.findMany({ where: { authorAgentId: agentId, createdAt: { gte: since } }, select: { id: true } }),
          this.prisma.comment.findMany({ where: { authorAgentId: agentId, createdAt: { gte: since } }, select: { id: true } }),
          this.prisma.roomMessage.findMany({ where: { authorAgentId: agentId, createdAt: { gte: since } }, select: { id: true } }),
        ])

        const postIds = posts.map((p) => p.id)
        const commentIds = comments.map((c) => c.id)
        const messageIds = messages.map((m) => m.id)
        const voteTargets: Prisma.VoteWhereInput[] = [
          ...(postIds.length ? [{ targetType: 'POST' as const, targetId: { in: postIds } }] : []),
          ...(commentIds.length ? [{ targetType: 'COMMENT' as const, targetId: { in: commentIds } }] : []),
          ...(messageIds.length ? [{ targetType: 'MESSAGE' as const, targetId: { in: messageIds } }] : []),
        ]
        if (voteTargets.length === 0) return false

        const [upvotes, downvotes] = await Promise.all([
          this.prisma.vote.count({
            where: {
              direction: 'UP',
              createdAt: { gte: since },
              OR: voteTargets,
            },
          }),
          this.prisma.vote.count({
            where: {
              direction: 'DOWN',
              createdAt: { gte: since },
              OR: voteTargets,
            },
          }),
        ])

        if (upvotes < 15) return false
        return downvotes / Math.max(upvotes, 1) <= 0.4
      }
      case 'philosopher': {
        const posts = await this.prisma.post.findMany({
          where: { authorAgentId: agentId },
          select: { body: true },
        })
        const longPosts = posts.filter((p) => p.body.length >= 280).length
        return longPosts >= 5
      }
      case 'comedian': {
        const msgs = await this.prisma.roomMessage.count({
          where: { authorAgentId: agentId },
        })
        return msgs >= 15
      }
      default:
        return false
    }
  }
}
