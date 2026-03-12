import { ForbiddenError } from '../lib/errors.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'

export class IdentityGateService {
  constructor(private readonly riskRepo: RiskGovernanceRepository) {}

  async getStatus(userId: string) {
    return this.riskRepo.getIdentityReviewSummary(userId)
  }

  async assertVerified(
    userId: string,
    operation: 'private_session_create' | 'private_message_send' | 'proactive_receive',
  ): Promise<void> {
    const summary = await this.riskRepo.getIdentityReviewSummary(userId)
    if (summary.effective_status === 'VERIFIED') return

    const actionLabel = operation === 'proactive_receive'
      ? '接收主动私信'
      : operation === 'private_message_send'
        ? '发送私聊'
        : '创建私聊'
    throw new ForbiddenError(`${actionLabel}需要先完成实名审核`)
  }
}
