import { Router, type IRouter } from 'express'
import type { PrismaClient } from '@prisma/client'
import { requireHumanAuth } from '../middleware/human-auth.js'

function getPrismaOrNull(): PrismaClient | null {
  return ((globalThis as Record<string, unknown>).__forumPrisma as PrismaClient) ?? null
}
import { CostTracker } from '../services/cost-tracker.js'
import { BudgetService } from '../services/budget-service.js'

export const agentDashboardRouter: IRouter = Router()
const XP_PER_GROWTH_POINT = 50

function asParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function getLazySingletons() {
  const prisma = getPrismaOrNull()
  return {
    costTracker: new CostTracker(prisma),
    budgetService: new BudgetService(prisma),
  }
}

let _singletons: ReturnType<typeof getLazySingletons> | null = null
function singletons() {
  if (!_singletons) _singletons = getLazySingletons()
  return _singletons
}

agentDashboardRouter.get('/agents/:agentId/dashboard', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)

  if (!getPrismaOrNull()) {
    res.json({
      data: {
        agent_id: agentId,
        xp: {
          xp: 0,
          xp_per_growth_point: XP_PER_GROWTH_POINT,
          growth_points_total: 0,
          growth_points_spent: 0,
          growth_points_available: 0,
        },
        budget: null,
        credit: { credit_score: 80, risk_level: 'green', violations: 0 },
        traits: [],
        recent_events: [],
      },
    })
    return
  }

  const prisma = getPrismaOrNull()!

  try {
    const [xp, stats, budget, credit, traits, recentEvents] = await Promise.all([
      prisma.agentXp.findUnique({ where: { agentId } }),
      prisma.agentStats.findUnique({ where: { agentId } }),
      prisma.agentBudget.findUnique({ where: { agentId } }),
      prisma.agentCredit.findUnique({ where: { agentId } }),
      prisma.agentTrait.findMany({ where: { agentId }, orderBy: { acquiredAt: 'desc' } }),
      prisma.xpEvent.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    const xpTotal = xp?.xp ?? 0
    const growthPointsTotal = Math.floor(xpTotal / XP_PER_GROWTH_POINT)
    const growthPointsAvailable = stats?.unspentPoints ?? growthPointsTotal
    const growthPointsSpent = Math.max(growthPointsTotal - growthPointsAvailable, 0)

    res.json({
      data: {
        agent_id: agentId,
        xp: {
          xp: xpTotal,
          xp_per_growth_point: XP_PER_GROWTH_POINT,
          growth_points_total: growthPointsTotal,
          growth_points_spent: growthPointsSpent,
          growth_points_available: growthPointsAvailable,
        },
        budget: budget
          ? {
              tier: budget.tier,
              daily_action_limit: budget.dailyActionLimit,
              monthly_action_limit: budget.monthlyActionLimit,
              daily_actions_used: budget.dailyActionsUsed,
              monthly_actions_used: budget.monthlyActionsUsed,
              daily_reset_at: budget.dailyResetAt.toISOString(),
              monthly_reset_at: budget.monthlyResetAt.toISOString(),
            }
          : null,
        credit: credit
          ? {
              credit_score: credit.creditScore,
              risk_level: credit.riskLevel,
              violations: credit.violations,
              last_violation_at: credit.lastViolationAt?.toISOString() ?? null,
            }
          : { credit_score: 80, risk_level: 'green', violations: 0, last_violation_at: null },
        traits: traits.map((t) => ({
          id: t.id,
          trait_code: t.traitCode,
          category: t.category,
          status: t.status,
          acquired_at: t.acquiredAt.toISOString(),
          equipped_at: t.equippedAt?.toISOString() ?? null,
          evidence: t.evidence,
        })),
        recent_events: recentEvents.map((e) => ({
          id: e.id,
          source: e.source,
          title: e.title,
          description: e.description,
          xp_delta: e.xpDelta,
          created_at: e.createdAt.toISOString(),
        })),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: { code: 'DASHBOARD_ERROR', message } })
  }
})

agentDashboardRouter.get('/agents/:agentId/cost-review', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  const days = parseInt(String(req.query.days ?? '30'), 10)

  try {
    const summary = await singletons().costTracker.getAgentCostSummary(agentId, days)
    res.json({ data: summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: { code: 'COST_REVIEW_ERROR', message } })
  }
})

agentDashboardRouter.post('/agents/:agentId/budget/init', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  const tier = typeof req.body?.tier === 'string' ? req.body.tier : 'balanced'

  try {
    await singletons().budgetService.ensureBudget(agentId, tier)
    res.json({ data: { message: 'budget_initialized', tier } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: { code: 'BUDGET_INIT_ERROR', message } })
  }
})

agentDashboardRouter.patch('/agents/:agentId/budget/tier', requireHumanAuth, async (req, res) => {
  const agentId = asParam(req.params.agentId)
  const tier = req.body?.tier
  if (typeof tier !== 'string') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'tier is required' } })
    return
  }

  try {
    await singletons().budgetService.changeTier(agentId, tier)
    res.json({ data: { message: 'tier_updated', tier } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: { code: 'BUDGET_TIER_ERROR', message } })
  }
})

agentDashboardRouter.get('/budget/tiers', (_req, res) => {
  res.json({ data: singletons().budgetService.getTiers() })
})
