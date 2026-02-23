import type { PrismaClient } from '@prisma/client'

export interface BudgetTierConfig {
  daily_action_limit: number
  monthly_action_limit: number
}

const BUDGET_TIERS: Record<string, BudgetTierConfig> = {
  conservative: { daily_action_limit: 30, monthly_action_limit: 800 },
  balanced: { daily_action_limit: 60, monthly_action_limit: 1500 },
  active: { daily_action_limit: 120, monthly_action_limit: 3000 },
}

export interface BudgetCheckResult {
  allowed: boolean
  reason?: string
  daily_remaining: number
  monthly_remaining: number
}

export class BudgetService {
  constructor(private readonly prisma: PrismaClient | null) {}

  async ensureBudget(agentId: string, tier = 'balanced'): Promise<void> {
    if (!this.prisma) return
    const existing = await this.prisma.agentBudget.findUnique({ where: { agentId } })
    if (existing) return

    const tierConfig = BUDGET_TIERS[tier] ?? BUDGET_TIERS.balanced
    const now = new Date()
    const dailyReset = new Date(now)
    dailyReset.setUTCHours(24, 0, 0, 0)
    const monthlyReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    await this.prisma.agentBudget.create({
      data: {
        agentId,
        tier,
        dailyActionLimit: tierConfig.daily_action_limit,
        monthlyActionLimit: tierConfig.monthly_action_limit,
        dailyActionsUsed: 0,
        monthlyActionsUsed: 0,
        dailyResetAt: dailyReset,
        monthlyResetAt: monthlyReset,
      },
    })
  }

  async checkBudget(agentId: string): Promise<BudgetCheckResult> {
    if (!this.prisma) {
      return { allowed: true, daily_remaining: 999, monthly_remaining: 999 }
    }

    const budget = await this.prisma.agentBudget.findUnique({ where: { agentId } })
    if (!budget) {
      return { allowed: true, daily_remaining: 999, monthly_remaining: 999 }
    }

    const now = new Date()

    if (now >= budget.dailyResetAt) {
      const nextReset = new Date(now)
      nextReset.setUTCHours(24, 0, 0, 0)
      await this.prisma.agentBudget.update({
        where: { agentId },
        data: { dailyActionsUsed: 0, dailyResetAt: nextReset },
      })
      budget.dailyActionsUsed = 0
    }

    if (now >= budget.monthlyResetAt) {
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      await this.prisma.agentBudget.update({
        where: { agentId },
        data: { monthlyActionsUsed: 0, monthlyResetAt: nextReset },
      })
      budget.monthlyActionsUsed = 0
    }

    const dailyRemaining = budget.dailyActionLimit - budget.dailyActionsUsed
    const monthlyRemaining = budget.monthlyActionLimit - budget.monthlyActionsUsed

    if (dailyRemaining <= 0) {
      return { allowed: false, reason: 'daily_limit_reached', daily_remaining: 0, monthly_remaining: monthlyRemaining }
    }
    if (monthlyRemaining <= 0) {
      return { allowed: false, reason: 'monthly_limit_reached', daily_remaining: dailyRemaining, monthly_remaining: 0 }
    }

    return { allowed: true, daily_remaining: dailyRemaining, monthly_remaining: monthlyRemaining }
  }

  async recordAction(agentId: string): Promise<void> {
    if (!this.prisma) return
    await this.prisma.agentBudget.updateMany({
      where: { agentId },
      data: {
        dailyActionsUsed: { increment: 1 },
        monthlyActionsUsed: { increment: 1 },
      },
    })
  }

  async changeTier(agentId: string, tier: string): Promise<void> {
    if (!this.prisma) return
    const tierConfig = BUDGET_TIERS[tier]
    if (!tierConfig) throw new Error(`Unknown budget tier: ${tier}`)

    await this.prisma.agentBudget.update({
      where: { agentId },
      data: {
        tier,
        dailyActionLimit: tierConfig.daily_action_limit,
        monthlyActionLimit: tierConfig.monthly_action_limit,
      },
    })
  }

  getTiers(): Record<string, BudgetTierConfig> {
    return { ...BUDGET_TIERS }
  }
}
