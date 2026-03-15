import type { CaseEvidenceExport, CaseDetail, EvidenceExportRedaction } from './types.js'
import {
  getCaseLinks,
  type ReviewServiceContext,
} from './shared.js'

const SHARE_EXPORT_REDACTION_NOTES = [
  'raw content sections removed',
  'prompt/memory evidence removed',
  'user/operator identifiers redacted',
  'attachment refs redacted',
] as const

const SHARE_REDACTED_VALUE = '[REDACTED]'

const SHARE_REDACTED_KEYS = new Set([
  'assigned_to_user_id',
  'reporter_user_id',
  'requester_user_id',
  'actor_user_id',
  'assignee_user_id',
  'claimed_by_user_id',
  'resolved_by_user_id',
  'previous_assignee_user_id',
  'from_assignee_user_id',
  'to_assignee_user_id',
  'opened_by',
  'user_id',
  'agent_id',
  'session_id',
  'message_id',
  'claim_token',
  'detail_text',
  'reason',
  'resolution_note',
  'operator_note',
  'ref',
])

function normalizeEvidenceExportRedaction(
  redaction: string | null | undefined,
): EvidenceExportRedaction {
  return redaction === 'share' ? 'share' : 'operator'
}

function redactShareExportValue(value: unknown, key: string | null = null): unknown {
  if (value == null) return value

  if (Array.isArray(value)) {
    return value.map((item) => redactShareExportValue(item, key))
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (key === 'content' || key === 'prompt_memory') {
      return {
        redacted: true,
        summary: `${key} removed in share export`,
        keys: Object.keys(record),
      }
    }

    const nextEntries = Object.entries(record).map(([childKey, childValue]) => {
      if (childKey === 'attachments' && Array.isArray(childValue)) {
        return [
          childKey,
          childValue.map((attachment) => {
            if (!attachment || typeof attachment !== 'object') {
              return { redacted: true }
            }
            const attachmentRecord = attachment as Record<string, unknown>
            return {
              ...attachmentRecord,
              ref:
                typeof attachmentRecord.ref === 'string'
                  ? '[REDACTED_ATTACHMENT_REF]'
                  : attachmentRecord.ref,
            }
          }),
        ]
      }

      if (SHARE_REDACTED_KEYS.has(childKey) && typeof childValue === 'string') {
        return [childKey, SHARE_REDACTED_VALUE]
      }

      return [childKey, redactShareExportValue(childValue, childKey)]
    })

    return Object.fromEntries(nextEntries)
  }

  return value
}

function redactForEvidenceExport<T>(value: T, redaction: EvidenceExportRedaction): T {
  if (redaction === 'operator') return value
  return redactShareExportValue(value) as T
}

async function getCaseDetail(
  context: ReviewServiceContext,
  caseId: string,
): Promise<CaseDetail | null> {
  const existing = await context.riskRepo.findCaseById(caseId)
  if (!existing) return null
  const [targets, evidence, tasks, links] = await Promise.all([
    context.riskRepo.listCaseTargets(caseId),
    context.riskRepo.listEvidenceSnapshots(caseId),
    context.riskRepo.listReviewTasks(caseId),
    getCaseLinks(context, existing),
  ])
  return { case: existing, targets, evidence, tasks, ...links }
}

export async function buildEvidenceExport(
  context: ReviewServiceContext,
  caseId: string,
  input?: { redaction?: EvidenceExportRedaction | string | null },
): Promise<CaseEvidenceExport | null> {
  const detail = await getCaseDetail(context, caseId)
  if (!detail) return null

  const primaryTarget =
    detail.targets.find((target) => target.relation_type === 'PRIMARY') ?? detail.targets[0] ?? null
  const actionLogs = primaryTarget
    ? await context.riskRepo.listGovernanceActionLogs(
        primaryTarget.target_type,
        primaryTarget.target_id,
      )
    : []
  const redaction = normalizeEvidenceExportRedaction(input?.redaction)
  const scopedActionLogs = actionLogs.filter((log) => log.case_id === caseId)

  return {
    case: redactForEvidenceExport(detail.case, redaction),
    linked_complaint: redactForEvidenceExport(detail.linked_complaint, redaction),
    linked_appeal: redactForEvidenceExport(detail.linked_appeal, redaction),
    targets: redactForEvidenceExport(detail.targets, redaction),
    tasks: redactForEvidenceExport(detail.tasks, redaction),
    action_logs: redactForEvidenceExport(scopedActionLogs, redaction),
    redaction_level: redaction,
    redaction_notes: redaction === 'share' ? [...SHARE_EXPORT_REDACTION_NOTES] : [],
    evidence: detail.evidence.map((snapshot) => ({
      id: snapshot.id,
      snapshot_type: snapshot.snapshot_type,
      evidence_package: redactForEvidenceExport(snapshot.evidence_package, redaction),
      created_at: snapshot.created_at,
    })),
    exported_at: new Date().toISOString(),
  }
}
