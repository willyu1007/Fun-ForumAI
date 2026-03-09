import type { BudgetCheckInput, BudgetCheckResult } from './budget-guard.js'
import type { UsageLedgerRepository } from './usage-ledger.js'

export interface DefaultBudgetLimits {
  agentMonthlyCapCny: number
  agentDailySoftCapCny: number
  platformDailyCapCny: number
}

const DEFAULT_LIMITS: DefaultBudgetLimits = {
  agentMonthlyCapCny: 10,
  agentDailySoftCapCny: 2,
  platformDailyCapCny: 200,
}

export function createDefaultBudgetChecker(
  ledgerRepo: UsageLedgerRepository,
  limits: Partial<DefaultBudgetLimits> = {},
): (input: BudgetCheckInput) => Promise<BudgetCheckResult> {
  const cfg = { ...DEFAULT_LIMITS, ...limits }

  return async (input: BudgetCheckInput): Promise<BudgetCheckResult> => {
    const now = new Date()

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const agentMonthlySpend = await ledgerRepo.sumCostByAgent(input.agentId, monthStart)
    if (agentMonthlySpend + input.estimatedCostCny > cfg.agentMonthlyCapCny) {
      return {
        allowed: false,
        reason: `Agent ${input.agentId} monthly budget exceeded (${agentMonthlySpend.toFixed(4)} + ${input.estimatedCostCny.toFixed(4)} > ${cfg.agentMonthlyCapCny} CNY)`,
      }
    }

    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const agentDailySpend = await ledgerRepo.sumCostByAgent(input.agentId, dayStart)
    if (agentDailySpend + input.estimatedCostCny > cfg.agentDailySoftCapCny) {
      return {
        allowed: false,
        reason: `Agent ${input.agentId} daily soft cap exceeded (${agentDailySpend.toFixed(4)} + ${input.estimatedCostCny.toFixed(4)} > ${cfg.agentDailySoftCapCny} CNY)`,
      }
    }

    const platformDailySpend = await ledgerRepo.sumCostByBillingClass('visible_standard', dayStart)
      + await ledgerRepo.sumCostByBillingClass('visible_premium', dayStart)
      + await ledgerRepo.sumCostByBillingClass('hidden_background', dayStart)
      + await ledgerRepo.sumCostByBillingClass('identity_write', dayStart)
    if (platformDailySpend + input.estimatedCostCny > cfg.platformDailyCapCny) {
      return {
        allowed: false,
        reason: `Platform daily budget exceeded (${platformDailySpend.toFixed(4)} > ${cfg.platformDailyCapCny} CNY)`,
      }
    }

    return { allowed: true }
  }
}
