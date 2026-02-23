import { Router, type IRouter } from 'express'
import { getPrismaClient } from '../persistence/prisma-client.js'
import { config } from '../lib/config.js'

export const agentDashboardRouter: IRouter = Router()

agentDashboardRouter.get('/agents/:agentId/dashboard', async (req, res) => {
  const { agentId } = req.params

  if (!config.db.usePrisma) {
    res.json({
      data: {
        agent_id: agentId,
        growth: { xp: 0, level: 1, trait_slots: 0, instruction_slots: 0 },
        budget: null,
        credit: { credit_score: 80, risk_level: 'green', violations: 0 },
        traits: [],
        recent_events: [],
      },
    })
    return
  }

  const prisma = getPrismaClient()

  try {
    const [growth, budget, credit, traits, recentEvents] = await Promise.all([
      prisma.agentGrowth.findUnique({ where: { agentId } }),
      prisma.agentBudget.findUnique({ where: { agentId } }),
      prisma.agentCredit.findUnique({ where: { agentId } }),
      prisma.agentTrait.findMany({ where: { agentId }, orderBy: { acquiredAt: 'desc' } }),
      prisma.growthEvent.findMany({
        where: { agentId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    res.json({
      data: {
        agent_id: agentId,
        growth: growth
          ? {
              xp: growth.xp,
              level: growth.level,
              trait_slots: growth.traitSlots,
              instruction_slots: growth.instructionSlots,
            }
          : { xp: 0, level: 1, trait_slots: 0, instruction_slots: 0 },
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
          event_type: e.eventType,
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
