import { LLMGatewayContractError, type LLMBudgetClass } from './gateway-contract.js'

export interface BudgetCheckInput {
  agentId: string
  budgetClass: LLMBudgetClass
  traceId: string
  estimatedCostCny: number
}

export interface BudgetCheckResult {
  allowed: boolean
  reason?: string
}

type BudgetChecker = (input: BudgetCheckInput) => Promise<BudgetCheckResult>

export class BudgetGuard {
  constructor(private checker?: BudgetChecker | null) {}

  setChecker(checker: BudgetChecker | null): void {
    this.checker = checker
  }

  async assertAllowed(input: BudgetCheckInput): Promise<void> {
    if (!this.checker) return
    const result = await this.checker(input)
    if (result.allowed) return
    throw new LLMGatewayContractError(
      'BudgetExceededError',
      result.reason || `Budget denied for ${input.agentId}`,
      input,
    )
  }
}
