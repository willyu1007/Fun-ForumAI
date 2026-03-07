import type { PrismaClient } from '@prisma/client'

export const XP_PER_GROWTH_POINT = 50

export type XpSource =
  | 'chat_message'
  | 'forum_post'
  | 'forum_comment'
  | 'vote_received'
  | 'room_created'
  | 'private_chat_digest'
  | 'legacy_migrated'

interface XpAwardOptions {
  dedup_key?: string
}

const PRIVATE_CHAT_XP_CONFIG = {
  base_xp: 3,
  daily_cap: 5,
  min_messages_for_xp: 6,
} as const

export class XpService {
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

    const todayDigestCount = await this.prisma.xpEvent.count({
      where: {
        agentId,
        source: 'private_chat_digest',
        createdAt: { gte: todayStart },
      },
    })

    if (todayDigestCount >= PRIVATE_CHAT_XP_CONFIG.daily_cap) {
      return { awarded: false, xp: 0, reason: 'daily_cap_reached' }
    }

    await this.awardXP(agentId, 'private_chat_digest', PRIVATE_CHAT_XP_CONFIG.base_xp, opts)
    return { awarded: true, xp: PRIVATE_CHAT_XP_CONFIG.base_xp }
  }

  async awardXP(
    agentId: string,
    source: XpSource,
    amount: number,
    opts: XpAwardOptions = {},
  ): Promise<{ xp: number }> {
    if (!this.prisma) return { xp: 0 }

    const xp = await this.prisma.agentXp.upsert({
      where: { agentId },
      create: { agentId, xp: amount },
      update: { xp: { increment: amount } },
    })

    await this.prisma.xpEvent.create({
      data: {
        agentId,
        source,
        title: this.sourceTitle(source),
        description: this.buildXpDescription(source, amount, opts.dedup_key),
        xpDelta: amount,
        dedupKey: this.normalizeDedupKey(opts.dedup_key) ?? null,
      },
    })

    return { xp: xp.xp }
  }

  async hasRecentXpDedupKey(agentId: string, dedupKey: string, windowMs: number): Promise<boolean> {
    if (!this.prisma) return false

    const normalizedKey = this.normalizeDedupKey(dedupKey)
    if (!normalizedKey) return false

    const since = new Date(Date.now() - Math.max(windowMs, 0))
    const existing = await this.prisma.xpEvent.findFirst({
      where: {
        agentId,
        dedupKey: normalizedKey,
        createdAt: { gte: since },
      },
      select: { id: true },
    })

    return Boolean(existing)
  }

  async getXp(agentId: string): Promise<{ xp: number }> {
    if (!this.prisma) return { xp: 0 }
    const xp = await this.prisma.agentXp.findUnique({ where: { agentId } })
    return { xp: xp?.xp ?? 0 }
  }

  async getXpSummary(agentId: string): Promise<{
    xp: number
    xp_per_growth_point: number
    growth_points_total: number
  }> {
    const { xp } = await this.getXp(agentId)
    return {
      xp,
      xp_per_growth_point: XP_PER_GROWTH_POINT,
      growth_points_total: Math.floor(xp / XP_PER_GROWTH_POINT),
    }
  }

  async getXpEvents(agentId: string, limit = 50): Promise<Array<{
    id: string
    source: string
    title: string
    description: string
    xp_delta: number
    created_at: Date
  }>> {
    if (!this.prisma) return []

    const events = await this.prisma.xpEvent.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return events.map((event) => ({
      id: event.id,
      source: event.source,
      title: event.title,
      description: event.description,
      xp_delta: event.xpDelta,
      created_at: event.createdAt,
    }))
  }

  private sourceTitle(source: XpSource): string {
    switch (source) {
      case 'chat_message':
        return '聊天发言'
      case 'forum_post':
        return '论坛发帖'
      case 'forum_comment':
        return '论坛评论'
      case 'vote_received':
        return '收到赞同'
      case 'room_created':
        return '创建房间'
      case 'private_chat_digest':
        return '私聊记忆沉淀'
      case 'legacy_migrated':
        return '历史 XP 迁移'
    }
  }

  private buildXpDescription(source: XpSource, amount: number, dedupKey?: string): string {
    const normalizedKey = this.normalizeDedupKey(dedupKey)
    if (!normalizedKey) return `${source} -> +${amount} XP`
    return `${source} -> +${amount} XP | dedup_key=${normalizedKey}`
  }

  private normalizeDedupKey(raw?: string): string | undefined {
    const normalized = raw?.trim()
    return normalized ? normalized : undefined
  }
}
