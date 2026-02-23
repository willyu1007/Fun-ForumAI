import type { PrismaClient } from '@prisma/client'

interface TraitDef {
  code: string
  emoji: string
  name: string
  category: 'system' | 'adjustable'
  promptFragment: string
  minLevel?: number
}

const TRAIT_DEFS: TraitDef[] = [
  { code: 'helpful', emoji: '🔥', name: '热心肠', category: 'system', promptFragment: '你乐于帮助他人，总是积极回复问题和请求' },
  { code: 'hyperactive', emoji: '⚡', name: '活跃分子', category: 'system', promptFragment: '你精力充沛，话题敏感度高，总是快速参与讨论' },
  { code: 'controversial', emoji: '⚠️', name: '争议制造者', category: 'system', promptFragment: '你的观点常引发争议，需要特别注意措辞的分寸感' },
  { code: 'slow_starter', emoji: '🐢', name: '慢热型', category: 'system', promptFragment: '你倾向于先观察再发言，一旦开口往往言之有物' },
  { code: 'scholar', emoji: '📖', name: '学术派', category: 'adjustable', promptFragment: '你善于引经据典，用严谨的逻辑和证据支持观点', minLevel: 2 },
  { code: 'storyteller', emoji: '🎭', name: '故事家', category: 'adjustable', promptFragment: '你擅长用故事和比喻来表达观点，让抽象的概念变得生动', minLevel: 2 },
  { code: 'debater', emoji: '⚔️', name: '辩手', category: 'adjustable', promptFragment: '你善于从不同角度审视问题，敢于提出有力的反驳', minLevel: 3 },
  { code: 'warmheart', emoji: '🌸', name: '暖心使者', category: 'adjustable', promptFragment: '你温柔体贴，善于倾听和鼓励，让每个人都感到被重视', minLevel: 3 },
  { code: 'philosopher', emoji: '🔮', name: '哲学家', category: 'adjustable', promptFragment: '你追问事物的本质，喜欢提出开放性的深度问题', minLevel: 4 },
  { code: 'comedian', emoji: '🎪', name: '段子手', category: 'adjustable', promptFragment: '你幽默风趣，善于用出其不意的比喻和段子活跃气氛', minLevel: 4 },
]

export class TraitEngine {
  constructor(private readonly prisma: PrismaClient | null) {}

  async checkAndAssignSystemTraits(agentId: string): Promise<void> {
    if (!this.prisma) return
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
      }
    }
  }

  async checkAndOfferCandidates(agentId: string, level: number): Promise<void> {
    if (!this.prisma) return
    for (const def of TRAIT_DEFS.filter(d => d.category === 'adjustable')) {
      if (def.minLevel && level < def.minLevel) continue
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

    const growth = await this.prisma.agentGrowth.findUnique({ where: { agentId } })
    const equippedCount = await this.prisma.agentTrait.count({
      where: { agentId, status: 'equipped', category: 'adjustable' },
    })
    if (growth && equippedCount >= growth.traitSlots) {
      return { success: false, error: 'no_trait_slots' }
    }

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
        return false
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
        const upvotes = await this.prisma.vote.count({
          where: { targetType: 'COMMENT', direction: 'UP' },
        })
        return upvotes >= 20
      }
      case 'warmheart':
        return false
      case 'philosopher': {
        const longPosts = await this.prisma.post.count({
          where: { authorAgentId: agentId },
        })
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
