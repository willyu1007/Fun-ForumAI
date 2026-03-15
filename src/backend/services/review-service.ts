import type {
  CreateGovernanceActionLogInput,
  ModerationCase,
} from '../repos/types.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'
import type { NotificationService } from './notification-service.js'
import {
  ensureCase,
  getCaseDetail,
  listQueue,
  openAutomatedCase,
  openConfigReviewCase,
  openIdentityReviewCase,
  reopenCase,
  resolveCase,
  type EnsureCaseInput,
  type OpenAutomatedCaseInput,
} from './review-service/case-lifecycle.js'
import { buildEvidenceExport } from './review-service/evidence-export.js'
import {
  assignCase,
  claimTask,
  releaseCase,
  transferCase,
} from './review-service/task-assignment.js'
import type {
  CaseDetail,
  CaseEvidenceExport,
  EvidenceExportRedaction,
  ReleasedReviewCase,
} from './review-service/types.js'

export type {
  CaseDetail,
  CaseEvidenceExport,
  EvidenceExportRedaction,
  ReleasedReviewCase,
} from './review-service/types.js'

export class ReviewService {
  private readonly context: {
    riskRepo: RiskGovernanceRepository
    notificationService: NotificationService | null
  }

  constructor(
    riskRepo: RiskGovernanceRepository,
    notificationService: NotificationService | null = null,
  ) {
    this.context = { riskRepo, notificationService }
  }

  async openAutomatedCase(input: OpenAutomatedCaseInput): Promise<ModerationCase> {
    return openAutomatedCase(this.context, input)
  }

  async ensureCase(input: EnsureCaseInput): Promise<ModerationCase> {
    return ensureCase(this.context, input)
  }

  async openIdentityReviewCase(input: {
    user_id: string
    opened_by?: string
    summary_text?: string
    evidence?: Record<string, unknown>
  }): Promise<ModerationCase> {
    return openIdentityReviewCase(this.context, input)
  }

  async openConfigReviewCase(input: {
    agent_id: string
    updated_by: string
    summary_text: string
    evidence: Record<string, unknown>
  }): Promise<ModerationCase> {
    return openConfigReviewCase(this.context, input)
  }

  async listQueue(opts: {
    status?: string
    case_type?: string
    queue?: string
    cursor?: string
    limit?: number
  }) {
    return listQueue(this.context, opts)
  }

  async getCaseDetail(caseId: string): Promise<CaseDetail | null> {
    return getCaseDetail(this.context, caseId)
  }

  async assignCase(
    caseId: string,
    assigneeUserId: string | null,
    actorUserId = assigneeUserId ?? 'system',
  ): Promise<ModerationCase | null> {
    return assignCase(this.context, caseId, assigneeUserId, actorUserId)
  }

  async releaseCase(
    caseId: string,
    actorUserId = 'system',
    input?: { operator_note?: string | null },
  ): Promise<ReleasedReviewCase | null> {
    return releaseCase(this.context, caseId, actorUserId, input)
  }

  async transferCase(
    caseId: string,
    assigneeUserId: string,
    actorUserId = 'system',
    input?: { assigned_role?: string | null; operator_note?: string | null },
  ) {
    return transferCase(this.context, caseId, assigneeUserId, actorUserId, input)
  }

  async claimTask(
    taskId: string,
    actorUserId: string,
    input?: { assigned_role?: string | null; operator_note?: string | null },
  ) {
    return claimTask(this.context, taskId, actorUserId, input)
  }

  async resolveCase(
    caseId: string,
    resolutionAction: string,
    actorUserId = 'system',
    resolutionNote: string | null = null,
  ): Promise<ModerationCase | null> {
    return resolveCase(this.context, caseId, resolutionAction, actorUserId, resolutionNote)
  }

  async reopenCase(
    caseId: string,
    openedReason: string,
    actorUserId = 'system',
    options?: { task_type?: string; assigned_role?: string | null },
  ): Promise<ModerationCase | null> {
    return reopenCase(this.context, caseId, openedReason, actorUserId, options)
  }

  async buildEvidenceExport(
    caseId: string,
    input?: { redaction?: EvidenceExportRedaction | string | null },
  ): Promise<CaseEvidenceExport | null> {
    return buildEvidenceExport(this.context, caseId, input)
  }

  async logGovernanceAction(input: CreateGovernanceActionLogInput) {
    return this.context.riskRepo.createGovernanceActionLog(input)
  }
}
