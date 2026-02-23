import type { PrismaClient } from '@prisma/client'

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens?: number
}

export class CostTracker {
  constructor(private readonly prisma: PrismaClient | null) {}

  async record(
    agentId: string,
    actionType: string,
    usage: TokenUsage,
    roomId?: string | null,
  ): Promise<void> {
    if (!this.prisma) return
    await this.prisma.costLog.create({
      data: {
        agentId,
        actionType,
        tokensIn: usage.prompt_tokens,
        tokensOut: usage.completion_tokens,
        roomId: roomId ?? undefined,
      },
    }).catch(err => console.error('[CostTracker] record error:', err))
  }

  async getAgentCostSummary(agentId: string, days = 30): Promise<{
    total_tokens_in: number
    total_tokens_out: number
    action_count: number
    by_action_type: Record<string, { tokens_in: number; tokens_out: number; count: number }>
  }> {
    if (!this.prisma) {
      return { total_tokens_in: 0, total_tokens_out: 0, action_count: 0, by_action_type: {} }
    }

    const since = new Date()
    since.setDate(since.getDate() - days)

    const logs = await this.prisma.costLog.findMany({
      where: { agentId, createdAt: { gte: since } },
    })

    let totalIn = 0
    let totalOut = 0
    const byType: Record<string, { tokens_in: number; tokens_out: number; count: number }> = {}

    for (const log of logs) {
      totalIn += log.tokensIn
      totalOut += log.tokensOut
      const t = log.actionType
      if (!byType[t]) byType[t] = { tokens_in: 0, tokens_out: 0, count: 0 }
      byType[t].tokens_in += log.tokensIn
      byType[t].tokens_out += log.tokensOut
      byType[t].count++
    }

    return {
      total_tokens_in: totalIn,
      total_tokens_out: totalOut,
      action_count: logs.length,
      by_action_type: byType,
    }
  }
}
