import { ForbiddenError } from '../lib/errors.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'

export type IdentityGateOperation =
  | 'private_session_create'
  | 'private_message_send'
  | 'proactive_receive'

export interface IdentityGateRuntimeState {
  app_env: 'dev' | 'staging' | 'prod'
  effective_mode: 'enforced_prod' | 'disabled_non_prod'
  enforced: boolean
  gated_operations: IdentityGateOperation[]
}

interface IdentityGateServiceDeps {
  riskRepo: RiskGovernanceRepository
  appEnv?: 'dev' | 'staging' | 'prod'
}

const GATED_OPERATIONS: IdentityGateOperation[] = [
  'private_session_create',
  'private_message_send',
  'proactive_receive',
]

export class IdentityGateService {
  constructor(private readonly deps: IdentityGateServiceDeps) {}

  async getStatus(userId: string) {
    return this.deps.riskRepo.getIdentityReviewSummary(userId)
  }

  getRuntimeState(): IdentityGateRuntimeState {
    const appEnv = this.deps.appEnv ?? 'dev'
    const enforced = appEnv === 'prod'

    return {
      app_env: appEnv,
      effective_mode: enforced ? 'enforced_prod' : 'disabled_non_prod',
      enforced,
      gated_operations: GATED_OPERATIONS,
    }
  }

  async assertVerified(
    userId: string,
    operation: IdentityGateOperation,
  ): Promise<void> {
    if (!this.getRuntimeState().enforced) return

    const summary = await this.deps.riskRepo.getIdentityReviewSummary(userId)
    if (summary.effective_status === 'VERIFIED') return

    const actionLabel = operation === 'proactive_receive'
      ? '接收主动私信'
      : operation === 'private_message_send'
        ? '发送私聊'
        : '创建私聊'
    throw new ForbiddenError(`${actionLabel}需要先完成实名审核`)
  }
}
