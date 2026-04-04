import { ForbiddenError } from '../lib/errors.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'
import type { UserRepository } from '../repos/user-repository.js'

export type IdentityGateOperation =
  | 'private_session_create'
  | 'private_message_send'
  | 'proactive_receive'

export type IdentityGateStagingMode = 'enforced' | 'admin_bypass'

export interface IdentityGateRuntimeState {
  app_env: 'dev' | 'staging' | 'prod'
  configured_staging_mode: IdentityGateStagingMode
  effective_mode: 'enforced' | 'staging_admin_bypass'
  bypass_scope: 'none' | 'admin_users'
  bypass_active: boolean
  gated_operations: IdentityGateOperation[]
}

interface IdentityGateServiceDeps {
  riskRepo: RiskGovernanceRepository
  userRepo?: UserRepository | null
  appEnv?: 'dev' | 'staging' | 'prod'
  stagingMode?: IdentityGateStagingMode
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
    const configuredStagingMode = this.deps.stagingMode ?? 'enforced'
    const bypassActive =
      appEnv === 'staging'
      && configuredStagingMode === 'admin_bypass'
      && Boolean(this.deps.userRepo)

    return {
      app_env: appEnv,
      configured_staging_mode: configuredStagingMode,
      effective_mode: bypassActive ? 'staging_admin_bypass' : 'enforced',
      bypass_scope: bypassActive ? 'admin_users' : 'none',
      bypass_active: bypassActive,
      gated_operations: GATED_OPERATIONS,
    }
  }

  private async canBypass(userId: string): Promise<boolean> {
    const runtimeState = this.getRuntimeState()
    if (!runtimeState.bypass_active || !this.deps.userRepo) {
      return false
    }

    const user = await this.deps.userRepo.findById(userId)
    return user?.plan_tier === 'ADMIN' && user.status === 'ACTIVE'
  }

  async assertVerified(
    userId: string,
    operation: IdentityGateOperation,
  ): Promise<void> {
    const summary = await this.deps.riskRepo.getIdentityReviewSummary(userId)
    if (summary.effective_status === 'VERIFIED') return
    if (await this.canBypass(userId)) return

    const actionLabel = operation === 'proactive_receive'
      ? '接收主动私信'
      : operation === 'private_message_send'
        ? '发送私聊'
        : '创建私聊'
    throw new ForbiddenError(`${actionLabel}需要先完成实名审核`)
  }
}
