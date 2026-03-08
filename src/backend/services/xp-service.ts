import type { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'

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
    todayStart.setUTCHours(0, 0, 0, 0)
    const normalizedDedup = this.normalizeDedupKey(opts.dedup_key) ?? null

    const result = await this.prisma.$transaction(async (tx) => {
      // Serialize concurrent daily-cap checks for the same agent
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${agentId}))`)

      if (normalizedDedup) {
        const dup = await tx.xpEvent.findFirst({
          where: { agentId, dedupKey: normalizedDedup },
          select: { id: true },
        })
        if (dup) return { awarded: false, xp: (await tx.agentXp.findUnique({ where: { agentId } }))?.xp ?? 0, reason: 'dedup_hit' as const }
      }

      const todayDigestCount = await tx.xpEvent.count({
        where: {
          agentId,
          source: 'private_chat_digest',
          createdAt: { gte: todayStart },
        },
      })

      if (todayDigestCount >= PRIVATE_CHAT_XP_CONFIG.daily_cap) {
        return { awarded: false, xp: 0, reason: 'daily_cap_reached' as const }
      }

      const xpRow = await tx.agentXp.upsert({
        where: { agentId },
        create: { agentId, xp: PRIVATE_CHAT_XP_CONFIG.base_xp },
        update: { xp: { increment: PRIVATE_CHAT_XP_CONFIG.base_xp } },
      })

      await tx.xpEvent.create({
        data: {
          agentId,
          source: 'private_chat_digest',
          title: this.sourceTitle('private_chat_digest'),
          description: this.buildXpDescription('private_chat_digest', PRIVATE_CHAT_XP_CONFIG.base_xp, opts.dedup_key),
          xpDelta: PRIVATE_CHAT_XP_CONFIG.base_xp,
          dedupKey: normalizedDedup,
        },
      })

      return { awarded: true, xp: xpRow.xp }
    })

    return result
  }

  async awardXP(
    agentId: string,
    source: XpSource,
    amount: number,
    opts: XpAwardOptions = {},
  ): Promise<{ xp: number; skipped?: boolean }> {
    if (!this.prisma) return { xp: 0 }
    if (!Number.isInteger(amount) || amount <= 0) return { xp: 0 }

    const normalizedDedup = this.normalizeDedupKey(opts.dedup_key) ?? null

    return this.prisma.$transaction(async (tx) => {
      if (normalizedDedup) {
        const dup = await tx.xpEvent.findFirst({
          where: { agentId, dedupKey: normalizedDedup },
          select: { id: true },
        })
        if (dup) return { xp: (await tx.agentXp.findUnique({ where: { agentId } }))?.xp ?? 0, skipped: true }
      }

      const xpRow = await tx.agentXp.upsert({
        where: { agentId },
        create: { agentId, xp: amount },
        update: { xp: { increment: amount } },
      })

      await tx.xpEvent.create({
        data: {
          agentId,
          source,
          title: this.sourceTitle(source),
          description: this.buildXpDescription(source, amount, opts.dedup_key),
          xpDelta: amount,
          dedupKey: normalizedDedup,
        },
      })

      return { xp: xpRow.xp }
    })
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
