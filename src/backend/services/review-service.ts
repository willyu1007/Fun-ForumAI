import type {
  CreateGovernanceActionLogInput,
  CreateModerationCaseTargetInput,
  CreateModerationEvidenceSnapshotInput,
  ModerationCase,
  ReviewCaseType,
} from '../repos/types.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'

export interface CaseDetail {
  case: ModerationCase
  targets: Awaited<ReturnType<RiskGovernanceRepository['listCaseTargets']>>
  evidence: Awaited<ReturnType<RiskGovernanceRepository['listEvidenceSnapshots']>>
  tasks: Awaited<ReturnType<RiskGovernanceRepository['listReviewTasks']>>
}

export class ReviewService {
  constructor(private readonly riskRepo: RiskGovernanceRepository) {}

  async openAutomatedCase(input: {
    case_type?: ReviewCaseType
    priority?: number
    summary_text?: string | null
    opened_reason?: string | null
    opened_by?: string
    linked_policy_snapshot_id?: string | null
    linked_complaint_ticket_id?: string | null
    linked_appeal_request_id?: string | null
    target: CreateModerationCaseTargetInput
    evidence?: Array<CreateModerationEvidenceSnapshotInput>
    create_default_task?: boolean
  }): Promise<ModerationCase> {
    const created = await this.riskRepo.createCase({
      case_type: input.case_type ?? 'MODERATION',
      priority: input.priority ?? 70,
      summary_text: input.summary_text ?? null,
      opened_reason: input.opened_reason ?? null,
      opened_by: input.opened_by ?? 'system',
      linked_policy_snapshot_id: input.linked_policy_snapshot_id ?? null,
      linked_complaint_ticket_id: input.linked_complaint_ticket_id ?? null,
      linked_appeal_request_id: input.linked_appeal_request_id ?? null,
    })

    await this.riskRepo.addCaseTarget({
      ...input.target,
      case_id: created.id,
    })

    for (const evidence of input.evidence ?? []) {
      await this.riskRepo.addEvidenceSnapshot({
        ...evidence,
        case_id: created.id,
      })
    }

    if (input.create_default_task !== false) {
      await this.riskRepo.createReviewTask({
        case_id: created.id,
        task_type: 'INITIAL_REVIEW',
      })
    }

    return created
  }

  async openIdentityReviewCase(input: {
    user_id: string
    opened_by?: string
    summary_text?: string
    evidence?: Record<string, unknown>
  }): Promise<ModerationCase> {
    return this.openAutomatedCase({
      case_type: 'IDENTITY_REVIEW',
      priority: 90,
      summary_text: input.summary_text ?? `Identity review for user ${input.user_id}`,
      opened_reason: 'manual_identity_review',
      opened_by: input.opened_by ?? 'system',
      target: {
        case_id: '',
        target_type: 'identity_user',
        target_id: input.user_id,
        channel: 'identity_review',
        user_id: input.user_id,
      },
      evidence: input.evidence ? [{ case_id: '', snapshot_type: 'identity_request', payload: input.evidence }] : [],
    })
  }

  async openConfigReviewCase(input: {
    agent_id: string
    updated_by: string
    summary_text: string
    evidence: Record<string, unknown>
  }): Promise<ModerationCase> {
    return this.openAutomatedCase({
      case_type: 'CONFIG_REVIEW',
      priority: 80,
      summary_text: input.summary_text,
      opened_reason: 'high_risk_config_revision',
      opened_by: input.updated_by,
      target: {
        case_id: '',
        target_type: 'config_revision',
        target_id: input.agent_id,
        channel: 'config_revision',
        agent_id: input.agent_id,
        user_id: input.updated_by,
      },
      evidence: [{
        case_id: '',
        snapshot_type: 'config_revision',
        payload: input.evidence,
      }],
    })
  }

  async listQueue(opts: { status?: string; case_type?: string; cursor?: string; limit?: number }) {
    return this.riskRepo.listCases({
      status: opts.status,
      case_type: opts.case_type,
      cursor: opts.cursor,
      limit: Math.min(opts.limit ?? 50, 100),
    })
  }

  async getCaseDetail(caseId: string): Promise<CaseDetail | null> {
    const existing = await this.riskRepo.findCaseById(caseId)
    if (!existing) return null
    const [targets, evidence, tasks] = await Promise.all([
      this.riskRepo.listCaseTargets(caseId),
      this.riskRepo.listEvidenceSnapshots(caseId),
      this.riskRepo.listReviewTasks(caseId),
    ])
    return { case: existing, targets, evidence, tasks }
  }

  async assignCase(caseId: string, assigneeUserId: string | null): Promise<ModerationCase | null> {
    return this.riskRepo.updateCase(caseId, {
      status: assigneeUserId ? 'IN_REVIEW' : undefined,
      assigned_to_user_id: assigneeUserId,
    })
  }

  async resolveCase(caseId: string, resolutionAction: string): Promise<ModerationCase | null> {
    return this.riskRepo.updateCase(caseId, {
      status: 'RESOLVED',
      resolution_action: resolutionAction,
      resolved_at: new Date(),
    })
  }

  async reopenCase(caseId: string, openedReason: string): Promise<ModerationCase | null> {
    const updated = await this.riskRepo.updateCase(caseId, {
      status: 'OPEN',
      resolution_action: null,
      resolved_at: null,
    })
    if (!updated) return null
    await this.riskRepo.addEvidenceSnapshot({
      case_id: caseId,
      snapshot_type: 'case_reopened',
      payload: { opened_reason: openedReason, reopened_at: new Date().toISOString() },
    })
    return updated
  }

  async logGovernanceAction(input: CreateGovernanceActionLogInput) {
    return this.riskRepo.createGovernanceActionLog(input)
  }
}
