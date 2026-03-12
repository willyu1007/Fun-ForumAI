import {
  Prisma,
  AppealRequest as PrismaAppealRequest,
  ComplaintTicket as PrismaComplaintTicket,
  GovernanceActionLog as PrismaGovernanceActionLog,
  ModerationCase as PrismaModerationCase,
  ModerationCaseTarget as PrismaModerationCaseTarget,
  ModerationEvidenceSnapshot as PrismaModerationEvidenceSnapshot,
  PolicySnapshot as PrismaPolicySnapshot,
  PrismaClient,
  ReviewTask as PrismaReviewTask,
  RiskEventLog as PrismaRiskEventLog,
  UserIdentityVerification as PrismaUserIdentityVerification,
} from '@prisma/client'
import type {
  AppealRequest,
  ComplaintTicket,
  CreateAppealRequestInput,
  CreateComplaintTicketInput,
  CreateGovernanceActionLogInput,
  CreateModerationCaseInput,
  CreateModerationCaseTargetInput,
  CreateModerationEvidenceSnapshotInput,
  CreatePolicySnapshotInput,
  CreateReviewTaskInput,
  CreateRiskEventLogInput,
  GovernanceActionLog,
  IdentityReviewSummary,
  ModerationCase,
  ModerationCaseTarget,
  ModerationEvidenceSnapshot,
  PaginatedResult,
  PaginationOpts,
  PolicySnapshot,
  ReviewTask,
  RiskEventLog,
  UpdateAppealRequestInput,
  UpdateComplaintTicketInput,
  UpdateModerationCaseInput,
  UpdateModerationCaseTargetInput,
  UpdatePolicySnapshotInput,
  UpdateReviewTaskInput,
  UpdateRiskEventLogInput,
  UpsertUserIdentityVerificationInput,
  UserIdentityVerification,
} from '../types.js'
import type { RiskGovernanceRepository } from '../risk-governance-repository.js'

function paginate<T extends { id: string }>(
  items: T[],
  opts: PaginationOpts,
): PaginatedResult<T> {
  let start = 0
  if (opts.cursor) {
    const idx = items.findIndex((item) => item.id === opts.cursor)
    start = idx >= 0 ? idx + 1 : 0
  }
  const page = items.slice(start, start + opts.limit)
  const next_cursor =
    page.length === opts.limit && start + opts.limit < items.length
      ? page[page.length - 1].id
      : null
  return { items: page, next_cursor }
}

function toRecordOrNull(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function toNullableJsonInput(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined
  if (value === null) return Prisma.JsonNull
  return value as Prisma.InputJsonValue
}

function toJsonInput(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

export class PgRiskGovernanceRepository implements RiskGovernanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getLatestIdentityVerification(userId: string): Promise<UserIdentityVerification | null> {
    const row = await this.prisma.userIdentityVerification.findFirst({
      where: { userId },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    })
    return row ? this.toIdentityVerification(row) : null
  }

  async getIdentityReviewSummary(userId: string): Promise<IdentityReviewSummary> {
    const latest = await this.getLatestIdentityVerification(userId)
    const effective_status = latest
      && latest.status === 'VERIFIED'
      && latest.expires_at
      && latest.expires_at.getTime() <= Date.now()
      ? 'EXPIRED'
      : latest?.status ?? 'UNVERIFIED'
    return { latest, effective_status }
  }

  async upsertIdentityVerification(
    input: UpsertUserIdentityVerificationInput,
  ): Promise<UserIdentityVerification> {
    const row = await this.prisma.userIdentityVerification.create({
      data: {
        userId: input.user_id,
        status: input.status,
        method: input.method ?? 'MANUAL_REVIEW',
        reviewedByUserId: input.reviewed_by_user_id ?? null,
        reason: input.reason ?? null,
        reviewedAt: input.reviewed_at ?? (input.reviewed_by_user_id ? new Date() : null),
        expiresAt: input.expires_at ?? null,
        metaJson: toNullableJsonInput(input.meta),
      },
    })
    return this.toIdentityVerification(row)
  }

  async listIdentityVerifications(
    opts: PaginationOpts & { status?: string },
  ): Promise<PaginatedResult<UserIdentityVerification>> {
    const rows = await this.prisma.userIdentityVerification.findMany({
      where: opts.status ? { status: opts.status as PrismaUserIdentityVerification['status'] } : undefined,
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    })
    return paginate(rows.map((row) => this.toIdentityVerification(row)), opts)
  }

  async findPolicySnapshotByHash(input: {
    content_hash: string
    channel: string
    target_type: string
  }): Promise<PolicySnapshot | null> {
    const row = await this.prisma.policySnapshot.findFirst({
      where: {
        contentHash: input.content_hash,
        channel: input.channel,
        targetType: input.target_type,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return row ? this.toPolicySnapshot(row) : null
  }

  async createPolicySnapshot(input: CreatePolicySnapshotInput): Promise<PolicySnapshot> {
    const row = await this.prisma.policySnapshot.create({
      data: {
        contentHash: input.content_hash,
        channel: input.channel,
        targetType: input.target_type,
        targetId: input.target_id ?? null,
        communityId: input.community_id ?? null,
        agentId: input.agent_id ?? null,
        userId: input.user_id ?? null,
        scene: input.scene ?? null,
        normalizedText: input.normalized_text,
        moderationJson: toJsonInput(input.moderation),
        decisionJson: toJsonInput(input.decision),
      },
    })
    return this.toPolicySnapshot(row)
  }

  async updatePolicySnapshot(id: string, input: UpdatePolicySnapshotInput): Promise<PolicySnapshot | null> {
    try {
      const row = await this.prisma.policySnapshot.update({
        where: { id },
        data: {
          ...(input.target_id !== undefined ? { targetId: input.target_id } : {}),
        },
      })
      return this.toPolicySnapshot(row)
    } catch {
      return null
    }
  }

  async createRiskEvent(input: CreateRiskEventLogInput): Promise<RiskEventLog> {
    const row = await this.prisma.riskEventLog.create({
      data: {
        policySnapshotId: input.policy_snapshot_id ?? null,
        caseId: input.case_id ?? null,
        channel: input.channel,
        eventType: input.event_type,
        action: input.action,
        riskLevel: input.risk_level ?? null,
        riskScore: input.risk_score ?? null,
        riskCategories: input.risk_categories ?? [],
        targetType: input.target_type ?? null,
        targetId: input.target_id ?? null,
        communityId: input.community_id ?? null,
        agentId: input.agent_id ?? null,
        userId: input.user_id ?? null,
        roomId: input.room_id ?? null,
        sessionId: input.session_id ?? null,
        messageId: input.message_id ?? null,
        detailText: input.detail_text ?? null,
        payloadJson: toNullableJsonInput(input.payload),
      },
    })
    return this.toRiskEvent(row)
  }

  async updateRiskEvent(id: string, input: UpdateRiskEventLogInput): Promise<RiskEventLog | null> {
    try {
      const row = await this.prisma.riskEventLog.update({
        where: { id },
        data: {
          ...(input.target_id !== undefined ? { targetId: input.target_id } : {}),
          ...(input.room_id !== undefined ? { roomId: input.room_id } : {}),
          ...(input.session_id !== undefined ? { sessionId: input.session_id } : {}),
          ...(input.message_id !== undefined ? { messageId: input.message_id } : {}),
        },
      })
      return this.toRiskEvent(row)
    } catch {
      return null
    }
  }

  async listRiskEvents(
    opts: PaginationOpts & { target_type?: string; target_id?: string; channel?: string; agent_id?: string; user_id?: string },
  ): Promise<PaginatedResult<RiskEventLog>> {
    const rows = await this.prisma.riskEventLog.findMany({
      where: {
        ...(opts.target_type ? { targetType: opts.target_type } : {}),
        ...(opts.target_id ? { targetId: opts.target_id } : {}),
        ...(opts.channel ? { channel: opts.channel } : {}),
        ...(opts.agent_id ? { agentId: opts.agent_id } : {}),
        ...(opts.user_id ? { userId: opts.user_id } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return paginate(rows.map((row) => this.toRiskEvent(row)), opts)
  }

  async createCase(input: CreateModerationCaseInput): Promise<ModerationCase> {
    const row = await this.prisma.moderationCase.create({
      data: {
        caseType: input.case_type,
        status: input.status ?? 'OPEN',
        priority: input.priority ?? 50,
        summaryText: input.summary_text ?? null,
        openedReason: input.opened_reason ?? null,
        openedBy: input.opened_by ?? 'system',
        assignedToUserId: input.assigned_to_user_id ?? null,
        linkedPolicySnapshotId: input.linked_policy_snapshot_id ?? null,
        linkedComplaintTicketId: input.linked_complaint_ticket_id ?? null,
        linkedAppealRequestId: input.linked_appeal_request_id ?? null,
        resolutionAction: input.resolution_action ?? null,
        resolvedAt: input.resolved_at ?? null,
      },
    })
    return this.toModerationCase(row)
  }

  async updateCase(id: string, input: UpdateModerationCaseInput): Promise<ModerationCase | null> {
    try {
      const row = await this.prisma.moderationCase.update({
        where: { id },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.summary_text !== undefined ? { summaryText: input.summary_text } : {}),
          ...(input.assigned_to_user_id !== undefined ? { assignedToUserId: input.assigned_to_user_id } : {}),
          ...(input.linked_complaint_ticket_id !== undefined
            ? { linkedComplaintTicketId: input.linked_complaint_ticket_id }
            : {}),
          ...(input.linked_appeal_request_id !== undefined
            ? { linkedAppealRequestId: input.linked_appeal_request_id }
            : {}),
          ...(input.resolution_action !== undefined ? { resolutionAction: input.resolution_action } : {}),
          ...(input.resolved_at !== undefined ? { resolvedAt: input.resolved_at } : {}),
        },
      })
      return this.toModerationCase(row)
    } catch {
      return null
    }
  }

  async findCaseById(id: string): Promise<ModerationCase | null> {
    const row = await this.prisma.moderationCase.findUnique({ where: { id } })
    return row ? this.toModerationCase(row) : null
  }

  async findLatestCaseByTarget(targetType: string, targetId: string): Promise<ModerationCase | null> {
    const targets = await this.prisma.moderationCaseTarget.findMany({
      where: { targetType, targetId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const caseIds = [...new Set(targets.map((target) => target.caseId))]
    if (caseIds.length === 0) return null

    const rows = await this.prisma.moderationCase.findMany({
      where: { id: { in: caseIds } },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: 1,
    })
    return rows[0] ? this.toModerationCase(rows[0]) : null
  }

  async listCases(
    opts: PaginationOpts & { status?: string; case_type?: string },
  ): Promise<PaginatedResult<ModerationCase>> {
    const rows = await this.prisma.moderationCase.findMany({
      where: {
        ...(opts.status ? { status: opts.status as PrismaModerationCase['status'] } : {}),
        ...(opts.case_type ? { caseType: opts.case_type as PrismaModerationCase['caseType'] } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    })
    return paginate(rows.map((row) => this.toModerationCase(row)), opts)
  }

  async addCaseTarget(input: CreateModerationCaseTargetInput): Promise<ModerationCaseTarget> {
    const row = await this.prisma.moderationCaseTarget.create({
      data: {
        caseId: input.case_id,
        targetType: input.target_type,
        targetId: input.target_id,
        channel: input.channel,
        communityId: input.community_id ?? null,
        agentId: input.agent_id ?? null,
        userId: input.user_id ?? null,
        roomId: input.room_id ?? null,
        sessionId: input.session_id ?? null,
        messageId: input.message_id ?? null,
      },
    })
    return this.toCaseTarget(row)
  }

  async listCaseTargets(caseId: string): Promise<ModerationCaseTarget[]> {
    const rows = await this.prisma.moderationCaseTarget.findMany({
      where: { caseId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toCaseTarget(row))
  }

  async updateCaseTargets(caseId: string, input: UpdateModerationCaseTargetInput): Promise<ModerationCaseTarget[]> {
    await this.prisma.moderationCaseTarget.updateMany({
      where: { caseId },
      data: {
        ...(input.target_id !== undefined ? { targetId: input.target_id } : {}),
        ...(input.room_id !== undefined ? { roomId: input.room_id } : {}),
        ...(input.session_id !== undefined ? { sessionId: input.session_id } : {}),
        ...(input.message_id !== undefined ? { messageId: input.message_id } : {}),
      },
    })
    return this.listCaseTargets(caseId)
  }

  async addEvidenceSnapshot(
    input: CreateModerationEvidenceSnapshotInput,
  ): Promise<ModerationEvidenceSnapshot> {
    const row = await this.prisma.moderationEvidenceSnapshot.create({
      data: {
        caseId: input.case_id,
        snapshotType: input.snapshot_type,
        payloadJson: toJsonInput(input.payload),
      },
    })
    return this.toEvidenceSnapshot(row)
  }

  async listEvidenceSnapshots(caseId: string): Promise<ModerationEvidenceSnapshot[]> {
    const rows = await this.prisma.moderationEvidenceSnapshot.findMany({
      where: { caseId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => this.toEvidenceSnapshot(row))
  }

  async createReviewTask(input: CreateReviewTaskInput): Promise<ReviewTask> {
    const row = await this.prisma.reviewTask.create({
      data: {
        caseId: input.case_id,
        taskType: input.task_type,
        status: input.status ?? 'PENDING',
        assigneeUserId: input.assignee_user_id ?? null,
        dueAt: input.due_at ?? null,
        completedAt: input.completed_at ?? null,
      },
    })
    return this.toReviewTask(row)
  }

  async updateReviewTask(id: string, input: UpdateReviewTaskInput): Promise<ReviewTask | null> {
    try {
      const row = await this.prisma.reviewTask.update({
        where: { id },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.assignee_user_id !== undefined ? { assigneeUserId: input.assignee_user_id } : {}),
          ...(input.due_at !== undefined ? { dueAt: input.due_at } : {}),
          ...(input.completed_at !== undefined ? { completedAt: input.completed_at } : {}),
        },
      })
      return this.toReviewTask(row)
    } catch {
      return null
    }
  }

  async listReviewTasks(caseId: string): Promise<ReviewTask[]> {
    const rows = await this.prisma.reviewTask.findMany({
      where: { caseId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((row) => this.toReviewTask(row))
  }

  async createGovernanceActionLog(input: CreateGovernanceActionLogInput): Promise<GovernanceActionLog> {
    const row = await this.prisma.governanceActionLog.create({
      data: {
        caseId: input.case_id ?? null,
        action: input.action,
        targetType: input.target_type,
        targetId: input.target_id,
        actorUserId: input.actor_user_id,
        reason: input.reason ?? null,
        resultJson: toNullableJsonInput(input.result),
      },
    })
    return this.toGovernanceActionLog(row)
  }

  async listGovernanceActionLogs(targetType: string, targetId: string): Promise<GovernanceActionLog[]> {
    const rows = await this.prisma.governanceActionLog.findMany({
      where: { targetType, targetId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return rows.map((row) => this.toGovernanceActionLog(row))
  }

  async createComplaintTicket(input: CreateComplaintTicketInput): Promise<ComplaintTicket> {
    const row = await this.prisma.complaintTicket.create({
      data: {
        reporterUserId: input.reporter_user_id,
        targetType: input.target_type,
        targetId: input.target_id,
        reasonCode: input.reason_code,
        detailText: input.detail_text ?? null,
        status: input.status ?? 'OPEN',
        linkedCaseId: input.linked_case_id ?? null,
      },
    })
    return this.toComplaintTicket(row)
  }

  async updateComplaintTicket(id: string, input: UpdateComplaintTicketInput): Promise<ComplaintTicket | null> {
    try {
      const row = await this.prisma.complaintTicket.update({
        where: { id },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.linked_case_id !== undefined ? { linkedCaseId: input.linked_case_id } : {}),
        },
      })
      return this.toComplaintTicket(row)
    } catch {
      return null
    }
  }

  async findComplaintTicketById(id: string): Promise<ComplaintTicket | null> {
    const row = await this.prisma.complaintTicket.findUnique({ where: { id } })
    return row ? this.toComplaintTicket(row) : null
  }

  async listComplaintTickets(
    opts: PaginationOpts & { status?: string; reporter_user_id?: string },
  ): Promise<PaginatedResult<ComplaintTicket>> {
    const rows = await this.prisma.complaintTicket.findMany({
      where: {
        ...(opts.status ? { status: opts.status as PrismaComplaintTicket['status'] } : {}),
        ...(opts.reporter_user_id ? { reporterUserId: opts.reporter_user_id } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return paginate(rows.map((row) => this.toComplaintTicket(row)), opts)
  }

  async createAppealRequest(input: CreateAppealRequestInput): Promise<AppealRequest> {
    const row = await this.prisma.appealRequest.create({
      data: {
        requesterUserId: input.requester_user_id,
        targetType: input.target_type,
        targetId: input.target_id,
        linkedCaseId: input.linked_case_id ?? null,
        linkedComplaintTicketId: input.linked_complaint_ticket_id ?? null,
        reason: input.reason,
        status: input.status ?? 'OPEN',
      },
    })
    return this.toAppealRequest(row)
  }

  async updateAppealRequest(id: string, input: UpdateAppealRequestInput): Promise<AppealRequest | null> {
    try {
      const row = await this.prisma.appealRequest.update({
        where: { id },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.linked_case_id !== undefined ? { linkedCaseId: input.linked_case_id } : {}),
          ...(input.linked_complaint_ticket_id !== undefined
            ? { linkedComplaintTicketId: input.linked_complaint_ticket_id }
            : {}),
        },
      })
      return this.toAppealRequest(row)
    } catch {
      return null
    }
  }

  async findAppealRequestById(id: string): Promise<AppealRequest | null> {
    const row = await this.prisma.appealRequest.findUnique({ where: { id } })
    return row ? this.toAppealRequest(row) : null
  }

  async listAppealRequests(
    opts: PaginationOpts & { status?: string; requester_user_id?: string },
  ): Promise<PaginatedResult<AppealRequest>> {
    const rows = await this.prisma.appealRequest.findMany({
      where: {
        ...(opts.status ? { status: opts.status as PrismaAppealRequest['status'] } : {}),
        ...(opts.requester_user_id ? { requesterUserId: opts.requester_user_id } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    return paginate(rows.map((row) => this.toAppealRequest(row)), opts)
  }

  private toIdentityVerification(row: PrismaUserIdentityVerification): UserIdentityVerification {
    return {
      id: row.id,
      user_id: row.userId,
      status: row.status,
      method: row.method,
      reviewed_by_user_id: row.reviewedByUserId,
      reason: row.reason,
      submitted_at: row.submittedAt,
      reviewed_at: row.reviewedAt,
      expires_at: row.expiresAt,
      meta: toRecordOrNull(row.metaJson),
    }
  }

  private toPolicySnapshot(row: PrismaPolicySnapshot): PolicySnapshot {
    return {
      id: row.id,
      content_hash: row.contentHash,
      channel: row.channel,
      target_type: row.targetType,
      target_id: row.targetId,
      community_id: row.communityId,
      agent_id: row.agentId,
      user_id: row.userId,
      scene: row.scene,
      normalized_text: row.normalizedText,
      moderation: toRecordOrNull(row.moderationJson) ?? {},
      decision: toRecordOrNull(row.decisionJson) ?? {},
      created_at: row.createdAt,
    }
  }

  private toModerationCase(row: PrismaModerationCase): ModerationCase {
    return {
      id: row.id,
      case_type: row.caseType,
      status: row.status,
      priority: row.priority,
      summary_text: row.summaryText,
      opened_reason: row.openedReason,
      opened_by: row.openedBy,
      assigned_to_user_id: row.assignedToUserId,
      linked_policy_snapshot_id: row.linkedPolicySnapshotId,
      linked_complaint_ticket_id: row.linkedComplaintTicketId,
      linked_appeal_request_id: row.linkedAppealRequestId,
      resolution_action: row.resolutionAction,
      resolved_at: row.resolvedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toCaseTarget(row: PrismaModerationCaseTarget): ModerationCaseTarget {
    return {
      id: row.id,
      case_id: row.caseId,
      target_type: row.targetType,
      target_id: row.targetId,
      channel: row.channel,
      community_id: row.communityId,
      agent_id: row.agentId,
      user_id: row.userId,
      room_id: row.roomId,
      session_id: row.sessionId,
      message_id: row.messageId,
      created_at: row.createdAt,
    }
  }

  private toEvidenceSnapshot(row: PrismaModerationEvidenceSnapshot): ModerationEvidenceSnapshot {
    return {
      id: row.id,
      case_id: row.caseId,
      snapshot_type: row.snapshotType,
      payload: toRecordOrNull(row.payloadJson) ?? {},
      created_at: row.createdAt,
    }
  }

  private toReviewTask(row: PrismaReviewTask): ReviewTask {
    return {
      id: row.id,
      case_id: row.caseId,
      task_type: row.taskType,
      status: row.status,
      assignee_user_id: row.assigneeUserId,
      due_at: row.dueAt,
      completed_at: row.completedAt,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toGovernanceActionLog(row: PrismaGovernanceActionLog): GovernanceActionLog {
    return {
      id: row.id,
      case_id: row.caseId,
      action: row.action,
      target_type: row.targetType,
      target_id: row.targetId,
      actor_user_id: row.actorUserId,
      reason: row.reason,
      result: toRecordOrNull(row.resultJson),
      created_at: row.createdAt,
    }
  }

  private toComplaintTicket(row: PrismaComplaintTicket): ComplaintTicket {
    return {
      id: row.id,
      reporter_user_id: row.reporterUserId,
      target_type: row.targetType,
      target_id: row.targetId,
      reason_code: row.reasonCode,
      detail_text: row.detailText,
      status: row.status,
      linked_case_id: row.linkedCaseId,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toAppealRequest(row: PrismaAppealRequest): AppealRequest {
    return {
      id: row.id,
      requester_user_id: row.requesterUserId,
      target_type: row.targetType,
      target_id: row.targetId,
      linked_case_id: row.linkedCaseId,
      linked_complaint_ticket_id: row.linkedComplaintTicketId,
      reason: row.reason,
      status: row.status,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    }
  }

  private toRiskEvent(row: PrismaRiskEventLog): RiskEventLog {
    return {
      id: row.id,
      policy_snapshot_id: row.policySnapshotId,
      case_id: row.caseId,
      channel: row.channel,
      event_type: row.eventType,
      action: row.action,
      risk_level: row.riskLevel,
      risk_score: row.riskScore,
      risk_categories: toStringArray(row.riskCategories),
      target_type: row.targetType,
      target_id: row.targetId,
      community_id: row.communityId,
      agent_id: row.agentId,
      user_id: row.userId,
      room_id: row.roomId,
      session_id: row.sessionId,
      message_id: row.messageId,
      detail_text: row.detailText,
      payload: toRecordOrNull(row.payloadJson),
      created_at: row.createdAt,
    }
  }
}
