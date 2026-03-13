import type {
  CreateGovernanceActionLogInput,
  CreateModerationCaseTargetInput,
  CreateModerationEvidenceSnapshotInput,
  ModerationCase,
  ReviewCaseType,
  ReviewQueue,
  ReviewTask,
} from '../repos/types.js'
import { ValidationError } from '../lib/errors.js'
import type { RiskGovernanceRepository } from '../repos/risk-governance-repository.js'
import type { NotificationService } from './notification-service.js'

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

const QUEUE_SLA_HOURS: Record<ReviewQueue, number> = {
  MODERATION: 24,
  COMPLAINT: 24,
  APPEAL: 48,
  IDENTITY_REVIEW: 72,
  CONFIG_REVIEW: 48,
  PRIVACY: 12,
  DELETION: 18,
  HOT_TOPIC: 6,
}

const DEFAULT_ASSIGNED_ROLE: Record<ReviewQueue, string> = {
  MODERATION: 'content_reviewer',
  COMPLAINT: 'content_reviewer',
  APPEAL: 'senior_reviewer',
  IDENTITY_REVIEW: 'identity_reviewer',
  CONFIG_REVIEW: 'config_reviewer',
  PRIVACY: 'privacy_reviewer',
  DELETION: 'privacy_reviewer',
  HOT_TOPIC: 'policy_reviewer',
}

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

export class ReviewService {
  constructor(
    private readonly riskRepo: RiskGovernanceRepository,
    private readonly notificationService: NotificationService | null = null,
  ) {}

  private async getPrimaryTarget(caseId: string) {
    const targets = await this.riskRepo.listCaseTargets(caseId)
    return targets.find((target) => target.relation_type === 'PRIMARY') ?? targets[0] ?? null
  }

  private async getCaseLinks(moderationCase: ModerationCase) {
    const [linkedComplaint, linkedAppeal] = await Promise.all([
      moderationCase.linked_complaint_ticket_id
        ? this.riskRepo.findComplaintTicketById(moderationCase.linked_complaint_ticket_id)
        : Promise.resolve(null),
      moderationCase.linked_appeal_request_id
        ? this.riskRepo.findAppealRequestById(moderationCase.linked_appeal_request_id)
        : Promise.resolve(null),
    ])

    return {
      linked_complaint: linkedComplaint,
      linked_appeal: linkedAppeal,
    }
  }

  private deriveTicketStatusFromResolution(resolutionAction: string): 'RESOLVED' | 'REJECTED' {
    const normalized = resolutionAction.trim().toLowerCase()
    if (
      normalized.includes('reject')
      || normalized.includes('dismiss')
      || normalized.includes('deny')
      || normalized.includes('invalid')
      || normalized.includes('duplicate')
      || normalized.includes('no_action')
      || normalized.includes('no-op')
    ) {
      return 'REJECTED'
    }
    return 'RESOLVED'
  }

  private async createGovernanceNotification(input: {
    user_id: string
    title: string
    body: string
    target_type: string
    target_id: string
  }) {
    if (!this.notificationService) return null
    return this.notificationService.create({
      userId: input.user_id,
      type: 'GOVERNANCE',
      title: input.title,
      body: input.body,
      targetType: input.target_type,
      targetId: input.target_id,
    })
  }

  private complaintNotificationTitle(complaintType: string | null | undefined, status: 'RESOLVED' | 'REJECTED' | 'LINKED'): string {
    const base = complaintType === 'PRIVACY_REQUEST'
      ? '你的隐私请求'
      : complaintType === 'DELETION_REQUEST'
        ? '你的删除请求'
        : complaintType === 'IMPERSONATION_REPORT'
          ? '你的冒充举报'
          : complaintType === 'MISLABEL_REPORT'
            ? '你的误标举报'
            : complaintType === 'HARASSMENT_REPORT'
              ? '你的骚扰举报'
              : complaintType === 'OTHER'
                ? '你的投诉'
                : '你的举报'
    if (status === 'LINKED') return `${base}已重新进入审核`
    if (status === 'REJECTED') return `${base}已结案`
    return `${base}已处理`
  }

  private appealNotificationTitle(appealType: string | null | undefined, status: 'RESOLVED' | 'REJECTED' | 'LINKED'): string {
    const base = appealType === 'ACCOUNT_LIMIT_APPEAL'
      ? '你的账号限制申诉'
      : appealType === 'AGENT_RESTRICTION_APPEAL'
        ? '你的智能体限制申诉'
        : appealType === 'OTHER'
          ? '你的申诉'
          : '你的内容申诉'
    if (status === 'LINKED') return `${base}已重新进入审核`
    if (status === 'REJECTED') return `${base}已驳回`
    return `${base}已处理`
  }

  private targetLabel(targetType: string | null | undefined, targetId: string | null | undefined): string {
    const base = targetType === 'post'
      ? '论坛帖子'
      : targetType === 'comment'
        ? '评论区回复'
        : targetType === 'message'
          ? '聊天室发言'
          : targetType === 'private_session'
            ? '私聊会话'
            : targetType === 'agent'
              ? '智能体主页'
              : targetType === 'config_revision'
                ? '配置修订'
                : targetType === 'complaint_ticket'
                  ? '举报单'
                  : targetType === 'appeal_request'
                    ? '申诉单'
                    : '治理对象'

    return targetId ? `${base} · ${targetId}` : base
  }

  private resolutionNotificationBody(input: {
    caseId: string
    resolutionAction: string
    targetType: string | null | undefined
    targetId: string | null | undefined
  }): string {
    return `目标对象 ${this.targetLabel(input.targetType, input.targetId)} · case ${input.caseId} · 动作 ${input.resolutionAction}`
  }

  private reopenNotificationBody(input: {
    caseId: string
    openedReason: string
    targetType: string | null | undefined
    targetId: string | null | undefined
  }): string {
    return `目标对象 ${this.targetLabel(input.targetType, input.targetId)} · case ${input.caseId} · 重开原因 ${input.openedReason}`
  }

  private normalizeEvidenceExportRedaction(redaction: string | null | undefined): EvidenceExportRedaction {
    return redaction === 'share' ? 'share' : 'operator'
  }

  private redactShareExportValue(value: unknown, key: string | null = null): unknown {
    if (value == null) return value

    if (Array.isArray(value)) {
      return value.map((item) => this.redactShareExportValue(item, key))
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
                ref: typeof attachmentRecord.ref === 'string' ? '[REDACTED_ATTACHMENT_REF]' : attachmentRecord.ref,
              }
            }),
          ]
        }

        if (SHARE_REDACTED_KEYS.has(childKey) && typeof childValue === 'string') {
          return [childKey, SHARE_REDACTED_VALUE]
        }

        return [childKey, this.redactShareExportValue(childValue, childKey)]
      })

      return Object.fromEntries(nextEntries)
    }

    return value
  }

  private redactForEvidenceExport<T>(value: T, redaction: EvidenceExportRedaction): T {
    if (redaction === 'operator') return value
    return this.redactShareExportValue(value) as T
  }

  private async syncLinkedRequestsOnResolved(input: {
    moderationCase: ModerationCase
    resolutionAction: string
    resolutionNote: string | null
    actorUserId: string
    resolvedAt: Date
  }) {
    const links = await this.getCaseLinks(input.moderationCase)
    const ticketStatus = this.deriveTicketStatusFromResolution(input.resolutionAction)
    const baseResult = {
      linked_case_id: input.moderationCase.id,
      case_status: input.moderationCase.status,
      resolution_action: input.resolutionAction,
      resolution_note: input.resolutionNote,
      resolved_by_user_id: input.actorUserId,
      resolved_at: input.resolvedAt.toISOString(),
    }

    if (links.linked_complaint) {
      await this.riskRepo.updateComplaintTicket(links.linked_complaint.id, {
        status: ticketStatus,
        resolution: baseResult,
      })
      await this.createGovernanceNotification({
        user_id: links.linked_complaint.reporter_user_id,
        title: this.complaintNotificationTitle(links.linked_complaint.complaint_type, ticketStatus),
        body: this.resolutionNotificationBody({
          caseId: input.moderationCase.id,
          resolutionAction: input.resolutionAction,
          targetType: links.linked_complaint.target_type,
          targetId: links.linked_complaint.target_id,
        }),
        target_type: 'complaint_ticket',
        target_id: links.linked_complaint.id,
      })
    }

    if (links.linked_appeal) {
      await this.riskRepo.updateAppealRequest(links.linked_appeal.id, {
        status: ticketStatus,
        result: baseResult,
      })
      await this.createGovernanceNotification({
        user_id: links.linked_appeal.requester_user_id,
        title: this.appealNotificationTitle(links.linked_appeal.appeal_type, ticketStatus),
        body: this.resolutionNotificationBody({
          caseId: input.moderationCase.id,
          resolutionAction: input.resolutionAction,
          targetType: links.linked_appeal.target_type,
          targetId: links.linked_appeal.target_id,
        }),
        target_type: 'appeal_request',
        target_id: links.linked_appeal.id,
      })
    }
  }

  private async syncLinkedRequestsOnReopened(input: {
    moderationCase: ModerationCase
    actorUserId: string
    openedReason: string
  }) {
    const links = await this.getCaseLinks(input.moderationCase)
    const reopenedMeta = {
      linked_case_id: input.moderationCase.id,
      case_status: input.moderationCase.status,
      reopened_by_user_id: input.actorUserId,
      opened_reason: input.openedReason,
      reopened_at: new Date().toISOString(),
    }

    if (links.linked_complaint) {
      await this.riskRepo.updateComplaintTicket(links.linked_complaint.id, {
        status: 'LINKED',
        resolution: reopenedMeta,
      })
      await this.createGovernanceNotification({
        user_id: links.linked_complaint.reporter_user_id,
        title: this.complaintNotificationTitle(links.linked_complaint.complaint_type, 'LINKED'),
        body: this.reopenNotificationBody({
          caseId: input.moderationCase.id,
          openedReason: input.openedReason,
          targetType: links.linked_complaint.target_type,
          targetId: links.linked_complaint.target_id,
        }),
        target_type: 'complaint_ticket',
        target_id: links.linked_complaint.id,
      })
    }

    if (links.linked_appeal) {
      await this.riskRepo.updateAppealRequest(links.linked_appeal.id, {
        status: 'LINKED',
        result: reopenedMeta,
      })
      await this.createGovernanceNotification({
        user_id: links.linked_appeal.requester_user_id,
        title: this.appealNotificationTitle(links.linked_appeal.appeal_type, 'LINKED'),
        body: this.reopenNotificationBody({
          caseId: input.moderationCase.id,
          openedReason: input.openedReason,
          targetType: links.linked_appeal.target_type,
          targetId: links.linked_appeal.target_id,
        }),
        target_type: 'appeal_request',
        target_id: links.linked_appeal.id,
      })
    }
  }

  private deriveQueue(caseType: ReviewCaseType): ReviewQueue {
    switch (caseType) {
      case 'COMPLAINT':
        return 'COMPLAINT'
      case 'APPEAL':
        return 'APPEAL'
      case 'IDENTITY_REVIEW':
        return 'IDENTITY_REVIEW'
      case 'CONFIG_REVIEW':
        return 'CONFIG_REVIEW'
      case 'HOT_TOPIC':
        return 'HOT_TOPIC'
      case 'MODERATION':
      default:
        return 'MODERATION'
    }
  }

  private computeSlaDueAt(queue: ReviewQueue, priority: number, requested?: Date | null): Date | null {
    if (requested !== undefined) return requested
    const baseHours = QUEUE_SLA_HOURS[queue]
    const factor = priority >= 95 ? 0.25 : priority >= 90 ? 0.5 : priority >= 80 ? 0.75 : 1
    const dueAt = new Date()
    dueAt.setHours(dueAt.getHours() + Math.max(1, Math.round(baseHours * factor)))
    return dueAt
  }

  private defaultAssignedRole(queue: ReviewQueue) {
    return DEFAULT_ASSIGNED_ROLE[queue]
  }

  private ensureAssignableCase(moderationCase: ModerationCase) {
    if (moderationCase.status === 'RESOLVED' || moderationCase.status === 'DISMISSED') {
      throw new ValidationError('case is not assignable')
    }
  }

  private ensureResolvableCase(moderationCase: ModerationCase) {
    if (moderationCase.status === 'RESOLVED' || moderationCase.status === 'DISMISSED') {
      throw new ValidationError('case is not resolvable')
    }
  }

  private ensureReopenableCase(moderationCase: ModerationCase) {
    if (moderationCase.status === 'OPEN' || moderationCase.status === 'IN_REVIEW') {
      throw new ValidationError('case is already open')
    }
  }

  private async createTaskForCase(input: {
    case_id: string
    queue: ReviewQueue
    task_type: string
    due_at?: Date | null
    assigned_role?: string | null
    assignee_user_id?: string | null
    status?: ReviewTask['status']
    claim_token?: string | null
    claimed_by_user_id?: string | null
    claimed_at?: Date | null
    operator_note?: string | null
  }) {
    return this.riskRepo.createReviewTask({
      case_id: input.case_id,
      queue: input.queue,
      task_type: input.task_type,
      status: input.status,
      assignee_user_id: input.assignee_user_id,
      claim_token: input.claim_token,
      claimed_by_user_id: input.claimed_by_user_id,
      claimed_at: input.claimed_at,
      assigned_role: input.assigned_role ?? this.defaultAssignedRole(input.queue),
      due_at: input.due_at,
      operator_note: input.operator_note,
    })
  }

  private async completeOutstandingTasks(caseId: string, resolutionAction: string, resolutionNote: string | null, completedAt: Date) {
    const tasks = await this.riskRepo.listReviewTasks(caseId)
    await Promise.all(tasks
      .filter((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELED')
      .map((task) => this.riskRepo.updateReviewTask(task.id, {
        status: 'COMPLETED',
        resolution_code: resolutionAction,
        operator_note: resolutionNote ?? task.operator_note,
        completed_at: completedAt,
      })))
  }

  async openAutomatedCase(input: {
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
  }): Promise<ModerationCase> {
    const case_type = input.case_type ?? 'MODERATION'
    const queue = input.queue ?? this.deriveQueue(case_type)
    const priority = input.priority ?? 70
    const created = await this.riskRepo.createCase({
      case_type,
      queue,
      priority,
      summary_text: input.summary_text ?? null,
      risk_summary: input.risk_summary ?? null,
      opened_reason: input.opened_reason ?? null,
      opened_by: input.opened_by ?? 'system',
      primary_target_type: input.target.target_type,
      primary_target_id: input.target.target_id,
      sla_due_at: this.computeSlaDueAt(queue, priority, input.sla_due_at),
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
      await this.createTaskForCase({
        case_id: created.id,
        queue: created.queue,
        task_type: 'INITIAL_REVIEW',
        due_at: created.sla_due_at,
        assigned_role: input.default_task_role ?? null,
      })
    }

    return created
  }

  async ensureCase(input: {
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
    reopen_existing?: boolean
    create_default_task?: boolean
    default_task_role?: string | null
  }): Promise<ModerationCase> {
    const existing = await this.riskRepo.findLatestCaseByTarget(input.target.target_type, input.target.target_id)
    const nextCaseType = input.case_type ?? 'MODERATION'
    const nextQueue = input.queue ?? this.deriveQueue(nextCaseType)
    const nextPriority = input.priority ?? existing?.priority ?? 70
    const caseLinks = {
      linked_complaint_ticket_id: input.linked_complaint_ticket_id ?? null,
      linked_appeal_request_id: input.linked_appeal_request_id ?? null,
    }

    if (existing && (existing.status === 'OPEN' || existing.status === 'IN_REVIEW')) {
      const updated = await this.riskRepo.updateCase(existing.id, {
        queue: nextQueue,
        ...caseLinks,
        summary_text: input.summary_text ?? existing.summary_text,
        risk_summary: input.risk_summary ?? existing.risk_summary,
        primary_target_type: input.target.target_type,
        primary_target_id: input.target.target_id,
        priority: nextPriority,
        sla_due_at: this.computeSlaDueAt(
          nextQueue,
          nextPriority,
          input.sla_due_at !== undefined ? input.sla_due_at : existing.sla_due_at,
        ),
      })
      for (const evidence of input.evidence ?? []) {
        await this.riskRepo.addEvidenceSnapshot({
          ...evidence,
          case_id: existing.id,
        })
      }
      return updated ?? existing
    }

    if (existing && input.reopen_existing !== false) {
      const reopened = await this.reopenCase(existing.id, input.opened_reason ?? 'ensure_case_reopen', input.opened_by ?? 'system', {
        task_type: 'REOPENED_REVIEW',
        assigned_role: input.default_task_role ?? null,
      })
      for (const evidence of input.evidence ?? []) {
        await this.riskRepo.addEvidenceSnapshot({
          ...evidence,
          case_id: existing.id,
        })
      }
      return (await this.riskRepo.updateCase(existing.id, {
        queue: nextQueue,
        ...caseLinks,
        summary_text: input.summary_text ?? existing.summary_text,
        risk_summary: input.risk_summary ?? existing.risk_summary,
        primary_target_type: input.target.target_type,
        primary_target_id: input.target.target_id,
        priority: nextPriority,
        sla_due_at: this.computeSlaDueAt(
          nextQueue,
          nextPriority,
          input.sla_due_at !== undefined ? input.sla_due_at : existing.sla_due_at,
        ),
      })) ?? reopened ?? existing
    }

    return this.openAutomatedCase(input)
  }

  async openIdentityReviewCase(input: {
    user_id: string
    opened_by?: string
    summary_text?: string
    evidence?: Record<string, unknown>
  }): Promise<ModerationCase> {
    return this.openAutomatedCase({
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
      evidence: [{
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
      }],
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
      evidence: [{
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
      }],
    })
  }

  async listQueue(opts: { status?: string; case_type?: string; queue?: string; cursor?: string; limit?: number }) {
    return this.riskRepo.listCases({
      status: opts.status,
      case_type: opts.case_type,
      queue: opts.queue,
      cursor: opts.cursor,
      limit: Math.min(opts.limit ?? 50, 100),
    })
  }

  async getCaseDetail(caseId: string): Promise<CaseDetail | null> {
    const existing = await this.riskRepo.findCaseById(caseId)
    if (!existing) return null
    const [targets, evidence, tasks, links] = await Promise.all([
      this.riskRepo.listCaseTargets(caseId),
      this.riskRepo.listEvidenceSnapshots(caseId),
      this.riskRepo.listReviewTasks(caseId),
      this.getCaseLinks(existing),
    ])
    return { case: existing, targets, evidence, tasks, ...links }
  }

  async assignCase(caseId: string, assigneeUserId: string | null, actorUserId = assigneeUserId ?? 'system'): Promise<ModerationCase | null> {
    const existing = await this.riskRepo.findCaseById(caseId)
    if (!existing) return null
    this.ensureAssignableCase(existing)

    const tasks = await this.riskRepo.listReviewTasks(caseId)
    const activeTask = tasks.find((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELED') ?? null
    const claimedAt = assigneeUserId ? new Date() : null
    if (activeTask) {
      await this.riskRepo.updateReviewTask(activeTask.id, {
        status: assigneeUserId ? 'ASSIGNED' : 'PENDING',
        assignee_user_id: assigneeUserId,
        claim_token: assigneeUserId ? (activeTask.claim_token ?? `claim_${caseId}_${claimedAt?.getTime() ?? Date.now()}`) : null,
        claimed_by_user_id: assigneeUserId,
        claimed_at: claimedAt,
        assigned_role: activeTask.assigned_role ?? this.defaultAssignedRole(activeTask.queue),
      })
    }
    const updated = await this.riskRepo.updateCase(caseId, {
      status: assigneeUserId ? 'IN_REVIEW' : 'OPEN',
      assigned_to_user_id: assigneeUserId,
      claimed_by_user_id: assigneeUserId,
      claimed_at: claimedAt,
    })
    if (!updated) return null
    const target = await this.getPrimaryTarget(caseId)
    if (target) {
      await this.logGovernanceAction({
        case_id: caseId,
        action: assigneeUserId ? 'case_assigned' : 'case_unassigned',
        target_type: target.target_type,
        target_id: target.target_id,
        actor_user_id: actorUserId,
        reason: assigneeUserId ? `assigned_to:${assigneeUserId}` : 'case_unassigned',
        result: {
          case_status: updated.status,
          assigned_to_user_id: updated.assigned_to_user_id,
        },
      })
    }
    return updated
  }

  async releaseCase(
    caseId: string,
    actorUserId = 'system',
    input?: { operator_note?: string | null },
  ): Promise<ReleasedReviewCase | null> {
    const existing = await this.riskRepo.findCaseById(caseId)
    if (!existing) return null
    if (existing.status === 'RESOLVED' || existing.status === 'DISMISSED') {
      throw new ValidationError('case is not releasable')
    }

    const releasedAt = new Date()
    const tasks = await this.riskRepo.listReviewTasks(caseId)
    const activeTasks = tasks.filter((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELED')
    const releasedTasks = await Promise.all(activeTasks.map((task) =>
      this.riskRepo.updateReviewTask(task.id, {
        status: 'PENDING',
        assignee_user_id: null,
        claim_token: null,
        claimed_by_user_id: null,
        claimed_at: null,
        operator_note: input?.operator_note ?? task.operator_note,
      })))

    const updatedCase = await this.riskRepo.updateCase(caseId, {
      status: 'OPEN',
      assigned_to_user_id: null,
      claimed_by_user_id: null,
      claimed_at: null,
    })

    await this.riskRepo.addEvidenceSnapshot({
      case_id: caseId,
      snapshot_type: 'case_released',
      payload: {
        previous_assignee_user_id: existing.assigned_to_user_id,
        released_at: releasedAt.toISOString(),
      },
      context: {
        actor_user_id: actorUserId,
      },
      action_history: {
        previous_assignee_user_id: existing.assigned_to_user_id,
        released_at: releasedAt.toISOString(),
        released_task_ids: releasedTasks.map((task) => task?.id ?? null).filter((taskId): taskId is string => Boolean(taskId)),
        operator_note: input?.operator_note ?? null,
      },
    })

    const target = await this.getPrimaryTarget(caseId)
    if (target) {
      await this.logGovernanceAction({
        case_id: caseId,
        action: 'case_released',
        target_type: target.target_type,
        target_id: target.target_id,
        actor_user_id: actorUserId,
        reason: input?.operator_note ?? 'case_released',
        result: {
          case_status: updatedCase?.status ?? existing.status,
          previous_assignee_user_id: existing.assigned_to_user_id,
          released_task_ids: releasedTasks.map((task) => task?.id ?? null).filter((taskId): taskId is string => Boolean(taskId)),
        },
      })
    }

    return {
      case: updatedCase,
      tasks: releasedTasks.filter((task): task is ReviewTask => Boolean(task)),
    }
  }

  async transferCase(
    caseId: string,
    assigneeUserId: string,
    actorUserId = 'system',
    input?: { assigned_role?: string | null; operator_note?: string | null },
  ) {
    const nextAssignee = assigneeUserId.trim()
    if (!nextAssignee) {
      throw new ValidationError('assignee_user_id is required')
    }

    const existing = await this.riskRepo.findCaseById(caseId)
    if (!existing) return null
    if (existing.status === 'RESOLVED' || existing.status === 'DISMISSED') {
      throw new ValidationError('case is not transferable')
    }

    const claimedAt = new Date()
    const previousAssignee = existing.assigned_to_user_id
    const tasks = await this.riskRepo.listReviewTasks(caseId)
    const activeTask = tasks.find((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELED') ?? null
    const claimToken = activeTask?.claim_token ?? `transfer_${caseId}_${claimedAt.getTime()}`

    const updatedTask = activeTask
      ? await this.riskRepo.updateReviewTask(activeTask.id, {
        status: 'ASSIGNED',
        assignee_user_id: nextAssignee,
        claim_token: claimToken,
        claimed_by_user_id: nextAssignee,
        claimed_at: claimedAt,
        assigned_role: input?.assigned_role ?? activeTask.assigned_role ?? this.defaultAssignedRole(activeTask.queue),
        operator_note: input?.operator_note ?? activeTask.operator_note,
      })
      : await this.createTaskForCase({
        case_id: caseId,
        queue: existing.queue,
        task_type: 'TRANSFERRED_REVIEW',
        due_at: existing.sla_due_at,
        assigned_role: input?.assigned_role ?? null,
        assignee_user_id: nextAssignee,
        status: 'ASSIGNED',
        claim_token: claimToken,
        claimed_by_user_id: nextAssignee,
        claimed_at: claimedAt,
        operator_note: input?.operator_note ?? null,
      })

    const updatedCase = await this.riskRepo.updateCase(caseId, {
      status: 'IN_REVIEW',
      assigned_to_user_id: nextAssignee,
      claimed_by_user_id: nextAssignee,
      claimed_at: claimedAt,
    })

    await this.riskRepo.addEvidenceSnapshot({
      case_id: caseId,
      snapshot_type: 'case_transferred',
      payload: {
        from_assignee_user_id: previousAssignee,
        to_assignee_user_id: nextAssignee,
        transferred_at: claimedAt.toISOString(),
      },
      context: {
        actor_user_id: actorUserId,
      },
      action_history: {
        from_assignee_user_id: previousAssignee,
        to_assignee_user_id: nextAssignee,
        transferred_at: claimedAt.toISOString(),
        task_id: updatedTask?.id ?? null,
        assigned_role: updatedTask?.assigned_role ?? null,
      },
    })

    const target = await this.getPrimaryTarget(caseId)
    if (target) {
      await this.logGovernanceAction({
        case_id: caseId,
        action: 'case_transferred',
        target_type: target.target_type,
        target_id: target.target_id,
        actor_user_id: actorUserId,
        reason: input?.operator_note ?? 'case_transferred',
        result: {
          from_assignee_user_id: previousAssignee,
          to_assignee_user_id: nextAssignee,
          task_id: updatedTask?.id ?? null,
          queue: updatedCase?.queue ?? existing.queue,
        },
      })
    }

    return {
      case: updatedCase,
      task: updatedTask,
    }
  }

  async claimTask(taskId: string, actorUserId: string, input?: { assigned_role?: string | null; operator_note?: string | null }) {
    const task = await this.riskRepo.findReviewTaskById(taskId)
    if (!task) return null
    if (task.status === 'COMPLETED' || task.status === 'CANCELED') {
      throw new ValidationError('task is not claimable')
    }
    if (
      task.status === 'ASSIGNED'
      && (
        (task.claimed_by_user_id && task.claimed_by_user_id !== actorUserId)
        || (task.assignee_user_id && task.assignee_user_id !== actorUserId)
      )
    ) {
      throw new ValidationError('task is already claimed')
    }

    const claimedAt = new Date()
    const claimToken = task.claim_token ?? `claim_${task.id}_${claimedAt.getTime()}`
    const updatedTask = await this.riskRepo.updateReviewTask(task.id, {
      status: 'ASSIGNED',
      assignee_user_id: actorUserId,
      claim_token: claimToken,
      claimed_by_user_id: actorUserId,
      claimed_at: claimedAt,
      assigned_role: input?.assigned_role ?? task.assigned_role ?? this.defaultAssignedRole(task.queue),
      operator_note: input?.operator_note ?? task.operator_note,
    })
    if (!updatedTask) return null

    const updatedCase = await this.riskRepo.updateCase(task.case_id, {
      status: 'IN_REVIEW',
      assigned_to_user_id: actorUserId,
      claimed_by_user_id: actorUserId,
      claimed_at: claimedAt,
    })

    const target = await this.getPrimaryTarget(task.case_id)
    if (target) {
      await this.logGovernanceAction({
        case_id: task.case_id,
        action: 'review_task_claimed',
        target_type: target.target_type,
        target_id: target.target_id,
        actor_user_id: actorUserId,
        reason: updatedTask.task_type,
        result: {
          task_id: updatedTask.id,
          queue: updatedTask.queue,
          claim_token: updatedTask.claim_token,
        },
      })
    }

    return {
      task: updatedTask,
      case: updatedCase,
    }
  }

  async resolveCase(caseId: string, resolutionAction: string, actorUserId = 'system', resolutionNote: string | null = null): Promise<ModerationCase | null> {
    const existing = await this.riskRepo.findCaseById(caseId)
    if (!existing) return null
    this.ensureResolvableCase(existing)

    const completedAt = new Date()
    const updated = await this.riskRepo.updateCase(caseId, {
      status: 'RESOLVED',
      resolution_action: resolutionAction,
      claimed_by_user_id: null,
      claimed_at: null,
      resolved_by_user_id: actorUserId,
      resolution_note: resolutionNote,
      resolved_at: completedAt,
    })
    if (!updated) return null
    await this.completeOutstandingTasks(caseId, resolutionAction, resolutionNote, completedAt)
    await this.syncLinkedRequestsOnResolved({
      moderationCase: updated,
      resolutionAction,
      resolutionNote,
      actorUserId,
      resolvedAt: completedAt,
    })
    const target = await this.getPrimaryTarget(caseId)
    if (target) {
      await this.logGovernanceAction({
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

  async reopenCase(
    caseId: string,
    openedReason: string,
    actorUserId = 'system',
    options?: { task_type?: string; assigned_role?: string | null },
  ): Promise<ModerationCase | null> {
    const existing = await this.riskRepo.findCaseById(caseId)
    if (!existing) return null
    this.ensureReopenableCase(existing)

    const updated = await this.riskRepo.updateCase(caseId, {
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
    await this.riskRepo.addEvidenceSnapshot({
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
    await this.createTaskForCase({
      case_id: caseId,
      queue: updated.queue,
      task_type: options?.task_type ?? 'REOPENED_REVIEW',
      due_at: updated.sla_due_at,
      assigned_role: options?.assigned_role ?? null,
    })
    await this.syncLinkedRequestsOnReopened({
      moderationCase: updated,
      actorUserId,
      openedReason,
    })
    const target = await this.getPrimaryTarget(caseId)
    if (target) {
      await this.logGovernanceAction({
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

  async buildEvidenceExport(
    caseId: string,
    input?: { redaction?: EvidenceExportRedaction | string | null },
  ): Promise<CaseEvidenceExport | null> {
    const detail = await this.getCaseDetail(caseId)
    if (!detail) return null

    const primaryTarget = detail.targets.find((target) => target.relation_type === 'PRIMARY') ?? detail.targets[0] ?? null
    const actionLogs = primaryTarget
      ? await this.riskRepo.listGovernanceActionLogs(primaryTarget.target_type, primaryTarget.target_id)
      : []
    const redaction = this.normalizeEvidenceExportRedaction(input?.redaction)
    const scopedActionLogs = actionLogs.filter((log) => log.case_id === caseId)

    return {
      case: this.redactForEvidenceExport(detail.case, redaction),
      linked_complaint: this.redactForEvidenceExport(detail.linked_complaint, redaction),
      linked_appeal: this.redactForEvidenceExport(detail.linked_appeal, redaction),
      targets: this.redactForEvidenceExport(detail.targets, redaction),
      tasks: this.redactForEvidenceExport(detail.tasks, redaction),
      action_logs: this.redactForEvidenceExport(scopedActionLogs, redaction),
      redaction_level: redaction,
      redaction_notes: redaction === 'share' ? [...SHARE_EXPORT_REDACTION_NOTES] : [],
      evidence: detail.evidence.map((snapshot) => ({
        id: snapshot.id,
        snapshot_type: snapshot.snapshot_type,
        evidence_package: this.redactForEvidenceExport(snapshot.evidence_package, redaction),
        created_at: snapshot.created_at,
      })),
      exported_at: new Date().toISOString(),
    }
  }

  async logGovernanceAction(input: CreateGovernanceActionLogInput) {
    return this.riskRepo.createGovernanceActionLog(input)
  }
}
