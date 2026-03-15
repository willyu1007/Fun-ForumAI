import type {
  CreateModerationCaseTargetInput,
  CreateModerationEvidenceSnapshotInput,
  ModerationCase,
  ReviewCaseType,
  ReviewQueue,
} from '../../repos/types.js'
import type { CaseDetail } from './types.js'
import {
  computeSlaDueAt,
  deriveQueue,
  ensureReopenableCase,
  ensureResolvableCase,
  getCaseLinks,
  getPrimaryTarget,
  type ReviewServiceContext,
} from './shared.js'
import {
  completeOutstandingTasks,
  createTaskForCase,
} from './task-assignment.js'
import {
  syncLinkedRequestsOnReopened,
  syncLinkedRequestsOnResolved,
} from './linked-request-sync.js'

export interface OpenAutomatedCaseInput {
  case_type?: ReviewCaseType
  queue?: ReviewQueue
  priority?: number
  summary_text?: string | null
  risk_summary?: Record<string, unknown> | null
  opened_reason?: string | null
  opened_by?: string
  linked_policy_snapshot_id?: string | null
  linked_complaint_ticket_id?: string | null
  linked_appeal_request_id?: string | null
  sla_due_at?: Date | null
  target: CreateModerationCaseTargetInput
  evidence?: Array<CreateModerationEvidenceSnapshotInput>
  create_default_task?: boolean
  default_task_role?: string | null
}

export interface EnsureCaseInput extends OpenAutomatedCaseInput {
  reopen_existing?: boolean
}

export async function openAutomatedCase(
  context: ReviewServiceContext,
  input: OpenAutomatedCaseInput,
): Promise<ModerationCase> {
  const caseType = input.case_type ?? 'MODERATION'
  const queue = input.queue ?? deriveQueue(caseType)
  const priority = input.priority ?? 70
  const created = await context.riskRepo.createCase({
    case_type: caseType,
    queue,
    priority,
    summary_text: input.summary_text ?? null,
    risk_summary: input.risk_summary ?? null,
    opened_reason: input.opened_reason ?? null,
    opened_by: input.opened_by ?? 'system',
    primary_target_type: input.target.target_type,
    primary_target_id: input.target.target_id,
    sla_due_at: computeSlaDueAt(queue, priority, input.sla_due_at),
    linked_policy_snapshot_id: input.linked_policy_snapshot_id ?? null,
    linked_complaint_ticket_id: input.linked_complaint_ticket_id ?? null,
    linked_appeal_request_id: input.linked_appeal_request_id ?? null,
  })

  await context.riskRepo.addCaseTarget({
    ...input.target,
    case_id: created.id,
  })

  for (const evidence of input.evidence ?? []) {
    await context.riskRepo.addEvidenceSnapshot({
      ...evidence,
      case_id: created.id,
    })
  }

  if (input.create_default_task !== false) {
    await createTaskForCase(context, {
      case_id: created.id,
      queue: created.queue,
      task_type: 'INITIAL_REVIEW',
      due_at: created.sla_due_at,
      assigned_role: input.default_task_role ?? null,
    })
  }

  return created
}

export async function ensureCase(
  context: ReviewServiceContext,
  input: EnsureCaseInput,
): Promise<ModerationCase> {
  const existing = await context.riskRepo.findLatestCaseByTarget(
    input.target.target_type,
    input.target.target_id,
  )
  const nextCaseType = input.case_type ?? 'MODERATION'
  const nextQueue = input.queue ?? deriveQueue(nextCaseType)
  const nextPriority = input.priority ?? existing?.priority ?? 70
  const caseLinks = {
    linked_complaint_ticket_id: input.linked_complaint_ticket_id ?? null,
    linked_appeal_request_id: input.linked_appeal_request_id ?? null,
  }

  if (existing && (existing.status === 'OPEN' || existing.status === 'IN_REVIEW')) {
    const updated = await context.riskRepo.updateCase(existing.id, {
      queue: nextQueue,
      ...caseLinks,
      summary_text: input.summary_text ?? existing.summary_text,
      risk_summary: input.risk_summary ?? existing.risk_summary,
      primary_target_type: input.target.target_type,
      primary_target_id: input.target.target_id,
      priority: nextPriority,
      sla_due_at: computeSlaDueAt(
        nextQueue,
        nextPriority,
        input.sla_due_at !== undefined ? input.sla_due_at : existing.sla_due_at,
      ),
    })
    for (const evidence of input.evidence ?? []) {
      await context.riskRepo.addEvidenceSnapshot({
        ...evidence,
        case_id: existing.id,
      })
    }
    return updated ?? existing
  }

  if (existing && input.reopen_existing !== false) {
    const reopened = await reopenCase(
      context,
      existing.id,
      input.opened_reason ?? 'ensure_case_reopen',
      input.opened_by ?? 'system',
      {
        task_type: 'REOPENED_REVIEW',
        assigned_role: input.default_task_role ?? null,
      },
    )
    for (const evidence of input.evidence ?? []) {
      await context.riskRepo.addEvidenceSnapshot({
        ...evidence,
        case_id: existing.id,
      })
    }
    return (
      (await context.riskRepo.updateCase(existing.id, {
        queue: nextQueue,
        ...caseLinks,
        summary_text: input.summary_text ?? existing.summary_text,
        risk_summary: input.risk_summary ?? existing.risk_summary,
        primary_target_type: input.target.target_type,
        primary_target_id: input.target.target_id,
        priority: nextPriority,
        sla_due_at: computeSlaDueAt(
          nextQueue,
          nextPriority,
          input.sla_due_at !== undefined ? input.sla_due_at : existing.sla_due_at,
        ),
      })) ??
      reopened ??
      existing
    )
  }

  return openAutomatedCase(context, input)
}

export async function openIdentityReviewCase(
  context: ReviewServiceContext,
  input: {
    user_id: string
    opened_by?: string
    summary_text?: string
    evidence?: Record<string, unknown>
  },
): Promise<ModerationCase> {
  return openAutomatedCase(context, {
    case_type: 'IDENTITY_REVIEW',
    queue: 'IDENTITY_REVIEW',
    priority: 90,
    summary_text: input.summary_text ?? `Identity review for user ${input.user_id}`,
    risk_summary: { review_type: 'identity_review' },
    opened_reason: 'manual_identity_review',
    opened_by: input.opened_by ?? 'system',
    target: {
      case_id: '',
      target_type: 'identity_user',
      target_id: input.user_id,
      relation_type: 'PRIMARY',
      channel: 'identity_review',
      user_id: input.user_id,
    },
    evidence: [
      {
        case_id: '',
        snapshot_type: 'identity_request',
        payload: input.evidence ?? {},
        content: input.evidence ?? null,
        context: {
          user_id: input.user_id,
          opened_by: input.opened_by ?? 'system',
          channel: 'identity_review',
        },
        policy_hits: {
          review_type: 'identity_review',
        },
        action_history: {
          opened_reason: 'manual_identity_review',
        },
      },
    ],
  })
}

export async function openConfigReviewCase(
  context: ReviewServiceContext,
  input: {
    agent_id: string
    updated_by: string
    summary_text: string
    evidence: Record<string, unknown>
  },
): Promise<ModerationCase> {
  return openAutomatedCase(context, {
    case_type: 'CONFIG_REVIEW',
    queue: 'CONFIG_REVIEW',
    priority: 80,
    summary_text: input.summary_text,
    risk_summary: { review_type: 'config_review' },
    opened_reason: 'high_risk_config_revision',
    opened_by: input.updated_by,
    target: {
      case_id: '',
      target_type: 'config_revision',
      target_id: input.agent_id,
      relation_type: 'PRIMARY',
      channel: 'config_revision',
      agent_id: input.agent_id,
      user_id: input.updated_by,
    },
    evidence: [
      {
        case_id: '',
        snapshot_type: 'config_revision',
        payload: input.evidence,
        content: input.evidence,
        context: {
          agent_id: input.agent_id,
          updated_by: input.updated_by,
          channel: 'config_revision',
        },
        policy_hits: {
          review_type: 'config_review',
        },
        action_history: {
          opened_reason: 'high_risk_config_revision',
        },
      },
    ],
  })
}

export async function listQueue(
  context: ReviewServiceContext,
  opts: { status?: string; case_type?: string; queue?: string; cursor?: string; limit?: number },
) {
  return context.riskRepo.listCases({
    status: opts.status,
    case_type: opts.case_type,
    queue: opts.queue,
    cursor: opts.cursor,
    limit: Math.min(opts.limit ?? 50, 100),
  })
}

export async function getCaseDetail(
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

export async function resolveCase(
  context: ReviewServiceContext,
  caseId: string,
  resolutionAction: string,
  actorUserId = 'system',
  resolutionNote: string | null = null,
): Promise<ModerationCase | null> {
  const existing = await context.riskRepo.findCaseById(caseId)
  if (!existing) return null
  ensureResolvableCase(existing)

  const completedAt = new Date()
  const updated = await context.riskRepo.updateCase(caseId, {
    status: 'RESOLVED',
    resolution_action: resolutionAction,
    claimed_by_user_id: null,
    claimed_at: null,
    resolved_by_user_id: actorUserId,
    resolution_note: resolutionNote,
    resolved_at: completedAt,
  })
  if (!updated) return null

  await completeOutstandingTasks(
    context,
    caseId,
    resolutionAction,
    resolutionNote,
    completedAt,
  )
  await syncLinkedRequestsOnResolved(context, {
    moderationCase: updated,
    resolutionAction,
    resolutionNote,
    actorUserId,
    resolvedAt: completedAt,
  })
  const target = await getPrimaryTarget(context, caseId)
  if (target) {
    await context.riskRepo.createGovernanceActionLog({
      case_id: caseId,
      action: 'case_resolved',
      target_type: target.target_type,
      target_id: target.target_id,
      actor_user_id: actorUserId,
      reason: resolutionAction,
      result: {
        case_status: updated.status,
        resolution_action: updated.resolution_action,
        resolved_by_user_id: updated.resolved_by_user_id,
        resolution_note: updated.resolution_note,
      },
    })
  }
  return updated
}

export async function reopenCase(
  context: ReviewServiceContext,
  caseId: string,
  openedReason: string,
  actorUserId = 'system',
  options?: { task_type?: string; assigned_role?: string | null },
): Promise<ModerationCase | null> {
  const existing = await context.riskRepo.findCaseById(caseId)
  if (!existing) return null
  ensureReopenableCase(existing)

  const updated = await context.riskRepo.updateCase(caseId, {
    status: 'OPEN',
    assigned_to_user_id: null,
    claimed_by_user_id: null,
    claimed_at: null,
    resolution_action: null,
    resolved_by_user_id: null,
    resolution_note: null,
    resolved_at: null,
  })
  if (!updated) return null

  const reopenedAt = new Date().toISOString()
  await context.riskRepo.addEvidenceSnapshot({
    case_id: caseId,
    snapshot_type: 'case_reopened',
    payload: { opened_reason: openedReason, reopened_at: reopenedAt },
    context: {
      actor_user_id: actorUserId,
    },
    action_history: {
      opened_reason: openedReason,
      reopened_at: reopenedAt,
      follow_up_task_type: options?.task_type ?? 'REOPENED_REVIEW',
    },
  })
  await createTaskForCase(context, {
    case_id: caseId,
    queue: updated.queue,
    task_type: options?.task_type ?? 'REOPENED_REVIEW',
    due_at: updated.sla_due_at,
    assigned_role: options?.assigned_role ?? null,
  })
  await syncLinkedRequestsOnReopened(context, {
    moderationCase: updated,
    actorUserId,
    openedReason,
  })
  const target = await getPrimaryTarget(context, caseId)
  if (target) {
    await context.riskRepo.createGovernanceActionLog({
      case_id: caseId,
      action: 'case_reopened',
      target_type: target.target_type,
      target_id: target.target_id,
      actor_user_id: actorUserId,
      reason: openedReason,
      result: {
        case_status: updated.status,
      },
    })
  }
  return updated
}
