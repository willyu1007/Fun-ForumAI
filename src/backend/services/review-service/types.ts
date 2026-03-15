import type {
  ModerationCase,
  ReviewTask,
} from '../../repos/types.js'
import type { RiskGovernanceRepository } from '../../repos/risk-governance-repository.js'

export interface CaseDetail {
  case: ModerationCase
  targets: Awaited<ReturnType<RiskGovernanceRepository['listCaseTargets']>>
  evidence: Awaited<ReturnType<RiskGovernanceRepository['listEvidenceSnapshots']>>
  tasks: Awaited<ReturnType<RiskGovernanceRepository['listReviewTasks']>>
  linked_complaint: Awaited<ReturnType<RiskGovernanceRepository['findComplaintTicketById']>>
  linked_appeal: Awaited<ReturnType<RiskGovernanceRepository['findAppealRequestById']>>
}

export interface CaseEvidenceExport {
  case: ModerationCase
  linked_complaint: Awaited<ReturnType<RiskGovernanceRepository['findComplaintTicketById']>>
  linked_appeal: Awaited<ReturnType<RiskGovernanceRepository['findAppealRequestById']>>
  targets: Awaited<ReturnType<RiskGovernanceRepository['listCaseTargets']>>
  tasks: Awaited<ReturnType<RiskGovernanceRepository['listReviewTasks']>>
  action_logs: Awaited<ReturnType<RiskGovernanceRepository['listGovernanceActionLogs']>>
  redaction_level: EvidenceExportRedaction
  redaction_notes: string[]
  evidence: Array<{
    id: string
    snapshot_type: string
    evidence_package: Record<string, unknown> | null
    created_at: Date
  }>
  exported_at: string
}

export interface ReleasedReviewCase {
  case: ModerationCase | null
  tasks: ReviewTask[]
}

export type EvidenceExportRedaction = 'operator' | 'share'
