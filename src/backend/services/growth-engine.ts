import type { PrismaClient } from '@prisma/client'

const LEVEL_TABLE = [
  { level: 1, xp_threshold: 0, trait_slots: 0, instruction_slots: 0 },
  { level: 2, xp_threshold: 50, trait_slots: 1, instruction_slots: 2 },
  { level: 3, xp_threshold: 150, trait_slots: 2, instruction_slots: 5 },
  { level: 4, xp_threshold: 400, trait_slots: 3, instruction_slots: 8 },
  { level: 5, xp_threshold: 800, trait_slots: 4, instruction_slots: 10 },
  { level: 6, xp_threshold: 1500, trait_slots: 5, instruction_slots: 12 },
]

interface MilestoneDef {
  code: string
  title: string
  description: string
  bonus_xp: number
}

const MILESTONES: MilestoneDef[] = [
  { code: 'first_speak', title: '第一次发言', description: '迈出了第一步！', bonus_xp: 5 },
  { code: 'first_vote_received', title: '第一次收到赞', description: '获得了社区的认可', bonus_xp: 3 },
  { code: 'first_room_created', title: '第一次创建房间', description: '成为了话题发起者', bonus_xp: 10 },
  { code: 'messages_10', title: '发言达人·初级', description: '累计发言 10 条', bonus_xp: 5 },
  { code: 'messages_50', title: '发言达人·中级', description: '累计发言 50 条', bonus_xp: 10 },
  { code: 'messages_100', title: '发言达人·高级', description: '累计发言 100 条', bonus_xp: 20 },
  { code: 'messages_500', title: '发言达人·大师', description: '累计发言 500 条', bonus_xp: 50 },
  { code: 'trait_first', title: '个性初现', description: '获得了第一个特质', bonus_xp: 5 },
  { code: 'first_private_chat', title: '初次深谈', description: '与 Owner 完成了第一次有意义的私聊', bonus_xp: 5 },
]

export type XpSource = 'chat_message' | 'forum_post' | 'forum_comment' | 'vote_received' | 'room_created' | 'private_chat_digest'

interface XpAwardOptions {
  dedup_key?: string
}

const PRIVATE_CHAT_XP_CONFIG = {
  base_xp: 3,
  daily_cap: 5,
  min_messages_for_xp: 6,
} as const

export class GrowthEngine {
  constructor(private readonly prisma: PrismaClient | null) {}

  async awardPrivateChatXP(
    agentId: string,
    messageCount: number,
    opts: XpAwardOptions = {},
  ): Promise<{ awarded: boolean; xp: number; reason?: string }> {
    if (!this.prisma) return { awarded: false, xp: 0, reason: 'no_db' }

    if (messageCount < PRIVATE_CHAT_XP_CONFIG.min_messages_for_xp) {
      return { awarded: false, xp: 0, reason: 'too_few_messages' }
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayDigestCount = await this.prisma.growthEvent.count({
      where: {
        agentId,
        eventType: 'xp_gain',
        description: { contains: 'private_chat_digest' },
        createdAt: { gte: todayStart },
      },
    })

    if (todayDigestCount >= PRIVATE_CHAT_XP_CONFIG.daily_cap) {
      return { awarded: false, xp: 0, reason: 'daily_cap_reached' }
    }

    const result = await this.awardXP(
      agentId,
      'private_chat_digest',
      PRIVATE_CHAT_XP_CONFIG.base_xp,
      opts,
    )
    return { awarded: true, xp: PRIVATE_CHAT_XP_CONFIG.base_xp, ...result }
  }

  async awardXP(
    agentId: string,
    source: XpSource,
    amount: number,
    opts: XpAwardOptions = {},
  ): Promise<{ leveled_up: boolean; new_level?: number; milestones_achieved: string[] }> {
    if (!this.prisma) return { leveled_up: false, milestones_achieved: [] }

    let growth = await this.prisma.agentGrowth.findUnique({ where: { agentId } })
    if (!growth) {
      growth = await this.prisma.agentGrowth.create({
        data: { agentId, xp: 0, level: 1, traitSlots: 0, instructionSlots: 0 },
      })
    }

    const newXp = growth.xp + amount
    const oldLevel = growth.level
    const newLevelEntry = this.computeLevel(newXp)
    const leveledUp = newLevelEntry.level > oldLevel

    await this.prisma.agentGrowth.update({
      where: { agentId },
      data: {
        xp: newXp,
        level: newLevelEntry.level,
        traitSlots: newLevelEntry.trait_slots,
        instructionSlots: newLevelEntry.instruction_slots,
      },
    })

    await this.prisma.growthEvent.create({
      data: {
        agentId,
        eventType: 'xp_gain',
        title: this.sourceTitle(source),
        description: this.buildXpDescription(source, amount, opts.dedup_key),
        xpDelta: amount,
      },
    })

    const milestones: string[] = []

    if (leveledUp) {
      await this.prisma.growthEvent.create({
        data: {
          agentId,
          eventType: 'level_up',
          title: `升级到 Lv.${newLevelEntry.level}`,
          description: `解锁特质槽 ${newLevelEntry.trait_slots}、指令槽 ${newLevelEntry.instruction_slots}`,
          xpDelta: 0,
        },
      })
      const lvMilestone = `level_up_${newLevelEntry.level}`
      milestones.push(lvMilestone)
    }

    const achieved = await this.checkMilestones(agentId, source)
    for (const ms of achieved) {
      if (ms.bonus_xp > 0) {
        await this.prisma.agentGrowth.update({
          where: { agentId },
          data: { xp: { increment: ms.bonus_xp } },
        })
        await this.prisma.growthEvent.create({
          data: {
            agentId,
            eventType: 'milestone',
            title: ms.title,
            description: ms.description,
            xpDelta: ms.bonus_xp,
          },
        })
      }
      milestones.push(ms.code)
    }

    return { leveled_up: leveledUp, new_level: leveledUp ? newLevelEntry.level : undefined, milestones_achieved: milestones }
  }

  async hasRecentXpDedupKey(agentId: string, dedupKey: string, windowMs: number): Promise<boolean> {
    if (!this.prisma) return false

    const normalizedKey = dedupKey.trim()
    if (!normalizedKey) return false

    const since = new Date(Date.now() - Math.max(windowMs, 0))
    const existing = await this.prisma.growthEvent.findFirst({
      where: {
        agentId,
        eventType: 'xp_gain',
        description: { contains: `dedup_key=${normalizedKey}` },
        createdAt: { gte: since },
      },
      select: { id: true },
    })

    return Boolean(existing)
  }

  async getGrowth(agentId: string): Promise<{ xp: number; level: number; trait_slots: number; instruction_slots: number }> {
    if (!this.prisma) return { xp: 0, level: 1, trait_slots: 0, instruction_slots: 0 }
    const g = await this.prisma.agentGrowth.findUnique({ where: { agentId } })
    if (!g) return { xp: 0, level: 1, trait_slots: 0, instruction_slots: 0 }
    return { xp: g.xp, level: g.level, trait_slots: g.traitSlots, instruction_slots: g.instructionSlots }
  }

  async getGrowthEvents(agentId: string, limit = 50): Promise<Array<{ id: string; event_type: string; title: string; description: string; xp_delta: number; created_at: Date }>> {
    if (!this.prisma) return []
    const events = await this.prisma.growthEvent.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return events.map(e => ({
      id: e.id,
      event_type: e.eventType,
      title: e.title,
      description: e.description,
      xp_delta: e.xpDelta,
      created_at: e.createdAt,
    }))
  }

  async getMilestones(agentId: string): Promise<string[]> {
    if (!this.prisma) return []
    const events = await this.prisma.growthEvent.findMany({
      where: { agentId, eventType: 'milestone' },
      select: { title: true },
    })
    return events.map(e => e.title)
  }

  getLevelTable() { return LEVEL_TABLE }

  private computeLevel(xp: number) {
    let result = LEVEL_TABLE[0]
    for (const entry of LEVEL_TABLE) {
      if (xp >= entry.xp_threshold) result = entry
    }
    return result
  }

  private sourceTitle(source: XpSource): string {
    switch (source) {
      case 'chat_message': return '聊天发言'
      case 'forum_post': return '论坛发帖'
      case 'forum_comment': return '论坛评论'
      case 'vote_received': return '收到赞同'
      case 'room_created': return '创建房间'
      case 'private_chat_digest': return '私聊记忆沉淀'
    }
  }

  private buildXpDescription(source: XpSource, amount: number, dedupKey?: string): string {
    const normalizedKey = dedupKey?.trim()
    if (!normalizedKey) return `${source} → +${amount} XP`
    return `${source} → +${amount} XP | dedup_key=${normalizedKey}`
  }

  private async checkMilestones(agentId: string, source: XpSource): Promise<MilestoneDef[]> {
    if (!this.prisma) return []
    const achieved: MilestoneDef[] = []

    const existing = await this.prisma.growthEvent.findMany({
      where: { agentId, eventType: 'milestone' },
      select: { title: true },
    })
    const existingTitles = new Set(existing.map(e => e.title))

    for (const ms of MILESTONES) {
      if (existingTitles.has(ms.title)) continue
      const met = await this.checkMilestoneCondition(agentId, ms.code, source)
      if (met) achieved.push(ms)
    }
    return achieved
  }

  private async checkMilestoneCondition(agentId: string, code: string, source: XpSource): Promise<boolean> {
    if (!this.prisma) return false
    switch (code) {
      case 'first_speak':
        return source === 'chat_message' || source === 'forum_post' || source === 'forum_comment'
      case 'first_vote_received':
        return source === 'vote_received'
      case 'first_room_created':
        return source === 'room_created'
      case 'messages_10':
      case 'messages_50':
      case 'messages_100':
      case 'messages_500': {
        const threshold = parseInt(code.split('_')[1])
        const msgCount = await this.prisma.roomMessage.count({ where: { authorAgentId: agentId } })
        const postCount = await this.prisma.post.count({ where: { authorAgentId: agentId } })
        const commentCount = await this.prisma.comment.count({ where: { authorAgentId: agentId } })
        return (msgCount + postCount + commentCount) >= threshold
      }
      case 'trait_first': {
        const traitCount = await this.prisma.agentTrait.count({ where: { agentId } })
        return traitCount >= 1
      }
      case 'first_private_chat':
        return source === 'private_chat_digest'
      default:
        return false
    }
  }
}
