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
  UpdateAppealRequestInput,
  UpdateComplaintTicketInput,
  UpdateModerationCaseInput,
  UpdateModerationCaseTargetInput,
  UpdatePolicySnapshotInput,
  UpdateReviewTaskInput,
  UpdateRiskEventLogInput,
  UpsertUserIdentityVerificationInput,
  UserIdentityVerification,
  RiskEventLog,
  GovernanceAttachment,
} from './types.js'

export interface RiskGovernanceRepository {
  getLatestIdentityVerification(userId: string): Promise<UserIdentityVerification | null>
  getIdentityReviewSummary(userId: string): Promise<IdentityReviewSummary>
  upsertIdentityVerification(input: UpsertUserIdentityVerificationInput): Promise<UserIdentityVerification>
  listIdentityVerifications(opts: PaginationOpts & { status?: string }): Promise<PaginatedResult<UserIdentityVerification>>

  findPolicySnapshotByHash(input: { content_hash: string; channel: string; target_type: string }): Promise<PolicySnapshot | null>
  createPolicySnapshot(input: CreatePolicySnapshotInput): Promise<PolicySnapshot>
  updatePolicySnapshot(id: string, input: UpdatePolicySnapshotInput): Promise<PolicySnapshot | null>

  createRiskEvent(input: CreateRiskEventLogInput): Promise<RiskEventLog>
  updateRiskEvent(id: string, input: UpdateRiskEventLogInput): Promise<RiskEventLog | null>
  listRiskEvents(
    opts: PaginationOpts & { target_type?: string; target_id?: string; channel?: string; agent_id?: string; user_id?: string },
  ): Promise<PaginatedResult<RiskEventLog>>

  createCase(input: CreateModerationCaseInput): Promise<ModerationCase>
  updateCase(id: string, input: UpdateModerationCaseInput): Promise<ModerationCase | null>
  findCaseById(id: string): Promise<ModerationCase | null>
  findLatestCaseByTarget(targetType: string, targetId: string): Promise<ModerationCase | null>
  listCases(opts: PaginationOpts & { status?: string; case_type?: string; queue?: string }): Promise<PaginatedResult<ModerationCase>>
  addCaseTarget(input: CreateModerationCaseTargetInput): Promise<ModerationCaseTarget>
  updateCaseTargets(caseId: string, input: UpdateModerationCaseTargetInput): Promise<ModerationCaseTarget[]>
  listCaseTargets(caseId: string): Promise<ModerationCaseTarget[]>
  addEvidenceSnapshot(input: CreateModerationEvidenceSnapshotInput): Promise<ModerationEvidenceSnapshot>
  listEvidenceSnapshots(caseId: string): Promise<ModerationEvidenceSnapshot[]>
  createReviewTask(input: CreateReviewTaskInput): Promise<ReviewTask>
  updateReviewTask(id: string, input: UpdateReviewTaskInput): Promise<ReviewTask | null>
  findReviewTaskById(id: string): Promise<ReviewTask | null>
  listReviewTasks(caseId: string): Promise<ReviewTask[]>

  createGovernanceActionLog(input: CreateGovernanceActionLogInput): Promise<GovernanceActionLog>
  listGovernanceActionLogs(targetType: string, targetId: string): Promise<GovernanceActionLog[]>

  createComplaintTicket(input: CreateComplaintTicketInput): Promise<ComplaintTicket>
  updateComplaintTicket(id: string, input: UpdateComplaintTicketInput): Promise<ComplaintTicket | null>
  findComplaintTicketById(id: string): Promise<ComplaintTicket | null>
  listComplaintTickets(
    opts: PaginationOpts & { status?: string; reporter_user_id?: string },
  ): Promise<PaginatedResult<ComplaintTicket>>

  createAppealRequest(input: CreateAppealRequestInput): Promise<AppealRequest>
  updateAppealRequest(id: string, input: UpdateAppealRequestInput): Promise<AppealRequest | null>
  findAppealRequestById(id: string): Promise<AppealRequest | null>
  listAppealRequests(
    opts: PaginationOpts & { status?: string; requester_user_id?: string },
  ): Promise<PaginatedResult<AppealRequest>>
}

let counter = 0
function cuid(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now()}_${counter}`
}

function normalizeAttachments(value: GovernanceAttachment[] | undefined): GovernanceAttachment[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is GovernanceAttachment =>
    Boolean(item)
    && typeof item.ref === 'string'
    && item.ref.length > 0
    && typeof item.type === 'string'
    && item.type.length > 0)
}

function buildEvidencePackage(input: CreateModerationEvidenceSnapshotInput): Record<string, unknown> {
  return {
    snapshot_type: input.snapshot_type,
    payload: input.payload ?? {},
    content: input.content ?? null,
    context: input.context ?? null,
    policy_hits: input.policy_hits ?? null,
    prompt_memory: input.prompt_memory ?? null,
    topic_signals: input.topic_signals ?? null,
    action_history: input.action_history ?? null,
  }
}

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
  const next_cursor = page.length === opts.limit && start + opts.limit < items.length
    ? page[page.length - 1].id
    : null
  return { items: page, next_cursor }
}

export class InMemoryRiskGovernanceRepository implements RiskGovernanceRepository {
  private identityVerifications = new Map<string, UserIdentityVerification>()
  private identityByUser = new Map<string, string[]>()
  private policySnapshots = new Map<string, PolicySnapshot>()
  private riskEvents = new Map<string, RiskEventLog>()
  private cases = new Map<string, ModerationCase>()
  private caseTargets = new Map<string, ModerationCaseTarget[]>()
  private evidenceSnapshots = new Map<string, ModerationEvidenceSnapshot[]>()
  private reviewTasks = new Map<string, ReviewTask>()
  private reviewTasksByCase = new Map<string, string[]>()
  private actionLogs = new Map<string, GovernanceActionLog[]>()
  private complaintTickets = new Map<string, ComplaintTicket>()
  private appealRequests = new Map<string, AppealRequest>()

  async getLatestIdentityVerification(userId: string): Promise<UserIdentityVerification | null> {
    const ids = this.identityByUser.get(userId) ?? []
    const latest = ids.at(-1)
    return latest ? this.identityVerifications.get(latest) ?? null : null
  }

  async getIdentityReviewSummary(userId: string): Promise<IdentityReviewSummary> {
    const latest = await this.getLatestIdentityVerification(userId)
    const effective_status = latest
      && latest.status === 'VERIFIED'
      && latest.expires_at
      && latest.expires_at.getTime() <= Date.now()
      ? 'EXPIRED'
      : latest?.status ?? 'UNVERIFIED'
    return {
      latest,
      effective_status,
    }
  }

  async upsertIdentityVerification(input: UpsertUserIdentityVerificationInput): Promise<UserIdentityVerification> {
    const now = new Date()
    const entity: UserIdentityVerification = {
      id: cuid('idv'),
      user_id: input.user_id,
      status: input.status,
      method: input.method ?? 'MANUAL_REVIEW',
      reviewed_by_user_id: input.reviewed_by_user_id ?? null,
      reason: input.reason ?? null,
      submitted_at: now,
      reviewed_at: input.reviewed_at ?? now,
      expires_at: input.expires_at ?? null,
      meta: input.meta ?? null,
    }
    this.identityVerifications.set(entity.id, entity)
    const ids = this.identityByUser.get(entity.user_id) ?? []
    ids.push(entity.id)
    this.identityByUser.set(entity.user_id, ids)
    return entity
  }

  async listIdentityVerifications(
    opts: PaginationOpts & { status?: string },
  ): Promise<PaginatedResult<UserIdentityVerification>> {
    const items = Array.from(this.identityVerifications.values())
      .filter((item) => (opts.status ? item.status === opts.status : true))
      .sort((a, b) => b.submitted_at.getTime() - a.submitted_at.getTime())
    return paginate(items, opts)
  }

  async findPolicySnapshotByHash(input: {
    content_hash: string
    channel: string
    target_type: string
  }): Promise<PolicySnapshot | null> {
    const snapshots = Array.from(this.policySnapshots.values())
      .filter((item) =>
        item.content_hash === input.content_hash
        && item.channel === input.channel
        && item.target_type === input.target_type)
      .sort((a, b) =>
        b.created_at.getTime() - a.created_at.getTime()
        || b.id.localeCompare(a.id))
    return snapshots[0] ?? null
  }

  async createPolicySnapshot(input: CreatePolicySnapshotInput): Promise<PolicySnapshot> {
    const entity: PolicySnapshot = {
      id: cuid('psnap'),
      content_hash: input.content_hash,
      channel: input.channel,
      target_type: input.target_type,
      target_id: input.target_id ?? null,
      community_id: input.community_id ?? null,
      agent_id: input.agent_id ?? null,
      user_id: input.user_id ?? null,
      scene: input.scene ?? null,
      normalized_text: input.normalized_text,
      moderation: input.moderation,
      decision: input.decision,
      created_at: new Date(),
    }
    this.policySnapshots.set(entity.id, entity)
    return entity
  }

  async updatePolicySnapshot(id: string, input: UpdatePolicySnapshotInput): Promise<PolicySnapshot | null> {
    const existing = this.policySnapshots.get(id)
    if (!existing) return null
    const next: PolicySnapshot = {
      ...existing,
      ...(input.target_id !== undefined ? { target_id: input.target_id } : {}),
    }
    this.policySnapshots.set(id, next)
    return next
  }

  async createRiskEvent(input: CreateRiskEventLogInput): Promise<RiskEventLog> {
    const entity: RiskEventLog = {
      id: cuid('risk'),
      policy_snapshot_id: input.policy_snapshot_id ?? null,
      case_id: input.case_id ?? null,
      channel: input.channel,
      event_type: input.event_type,
      action: input.action,
      risk_level: input.risk_level ?? null,
      risk_score: input.risk_score ?? null,
      risk_categories: input.risk_categories ?? [],
      target_type: input.target_type ?? null,
      target_id: input.target_id ?? null,
      community_id: input.community_id ?? null,
      agent_id: input.agent_id ?? null,
      user_id: input.user_id ?? null,
      room_id: input.room_id ?? null,
      session_id: input.session_id ?? null,
      message_id: input.message_id ?? null,
      detail_text: input.detail_text ?? null,
      payload: input.payload ?? null,
      created_at: new Date(),
    }
    this.riskEvents.set(entity.id, entity)
    return entity
  }

  async updateRiskEvent(id: string, input: UpdateRiskEventLogInput): Promise<RiskEventLog | null> {
    const existing = this.riskEvents.get(id)
    if (!existing) return null
    const next: RiskEventLog = {
      ...existing,
      ...(input.target_id !== undefined ? { target_id: input.target_id } : {}),
      ...(input.room_id !== undefined ? { room_id: input.room_id } : {}),
      ...(input.session_id !== undefined ? { session_id: input.session_id } : {}),
      ...(input.message_id !== undefined ? { message_id: input.message_id } : {}),
    }
    this.riskEvents.set(id, next)
    return next
  }

  async listRiskEvents(
    opts: PaginationOpts & { target_type?: string; target_id?: string; channel?: string; agent_id?: string; user_id?: string },
  ): Promise<PaginatedResult<RiskEventLog>> {
    const items = Array.from(this.riskEvents.values())
      .filter((item) => (opts.target_type ? item.target_type === opts.target_type : true))
      .filter((item) => (opts.target_id ? item.target_id === opts.target_id : true))
      .filter((item) => (opts.channel ? item.channel === opts.channel : true))
      .filter((item) => (opts.agent_id ? item.agent_id === opts.agent_id : true))
      .filter((item) => (opts.user_id ? item.user_id === opts.user_id : true))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  async createCase(input: CreateModerationCaseInput): Promise<ModerationCase> {
    const now = new Date()
    const entity: ModerationCase = {
      id: cuid('mcase'),
      case_type: input.case_type,
      queue: input.queue ?? 'MODERATION',
      status: input.status ?? 'OPEN',
      priority: input.priority ?? 50,
      summary_text: input.summary_text ?? null,
      risk_summary: input.risk_summary ?? null,
      opened_reason: input.opened_reason ?? null,
      opened_by: input.opened_by ?? 'system',
      primary_target_type: input.primary_target_type ?? null,
      primary_target_id: input.primary_target_id ?? null,
      assigned_to_user_id: input.assigned_to_user_id ?? null,
      sla_due_at: input.sla_due_at ?? null,
      claimed_by_user_id: input.claimed_by_user_id ?? null,
      claimed_at: input.claimed_at ?? null,
      linked_policy_snapshot_id: input.linked_policy_snapshot_id ?? null,
      linked_complaint_ticket_id: input.linked_complaint_ticket_id ?? null,
      linked_appeal_request_id: input.linked_appeal_request_id ?? null,
      resolution_action: input.resolution_action ?? null,
      resolved_by_user_id: input.resolved_by_user_id ?? null,
      resolution_note: input.resolution_note ?? null,
      resolved_at: input.resolved_at ?? null,
      created_at: now,
      updated_at: now,
    }
    this.cases.set(entity.id, entity)
    return entity
  }

  async updateCase(id: string, input: UpdateModerationCaseInput): Promise<ModerationCase | null> {
    const existing = this.cases.get(id)
    if (!existing) return null
    const next: ModerationCase = {
      ...existing,
      ...(input.queue !== undefined ? { queue: input.queue } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.summary_text !== undefined ? { summary_text: input.summary_text } : {}),
      ...(input.risk_summary !== undefined ? { risk_summary: input.risk_summary } : {}),
      ...(input.primary_target_type !== undefined ? { primary_target_type: input.primary_target_type } : {}),
      ...(input.primary_target_id !== undefined ? { primary_target_id: input.primary_target_id } : {}),
      ...(input.assigned_to_user_id !== undefined ? { assigned_to_user_id: input.assigned_to_user_id } : {}),
      ...(input.sla_due_at !== undefined ? { sla_due_at: input.sla_due_at } : {}),
      ...(input.claimed_by_user_id !== undefined ? { claimed_by_user_id: input.claimed_by_user_id } : {}),
      ...(input.claimed_at !== undefined ? { claimed_at: input.claimed_at } : {}),
      ...(input.linked_complaint_ticket_id !== undefined ? { linked_complaint_ticket_id: input.linked_complaint_ticket_id } : {}),
      ...(input.linked_appeal_request_id !== undefined ? { linked_appeal_request_id: input.linked_appeal_request_id } : {}),
      ...(input.resolution_action !== undefined ? { resolution_action: input.resolution_action } : {}),
      ...(input.resolved_by_user_id !== undefined ? { resolved_by_user_id: input.resolved_by_user_id } : {}),
      ...(input.resolution_note !== undefined ? { resolution_note: input.resolution_note } : {}),
      ...(input.resolved_at !== undefined ? { resolved_at: input.resolved_at } : {}),
      updated_at: new Date(),
    }
    this.cases.set(id, next)
    return next
  }

  async findCaseById(id: string): Promise<ModerationCase | null> {
    return this.cases.get(id) ?? null
  }

  async findLatestCaseByTarget(targetType: string, targetId: string): Promise<ModerationCase | null> {
    const caseIds = Array.from(this.caseTargets.entries())
      .filter(([, targets]) => targets.some((target) =>
        target.target_type === targetType
        && target.target_id === targetId
        && target.relation_type === 'PRIMARY'))
      .map(([caseId]) => caseId)

    const matches = caseIds
      .map((caseId) => this.cases.get(caseId))
      .filter((item): item is ModerationCase => Boolean(item))
      .sort((a, b) =>
        b.updated_at.getTime() - a.updated_at.getTime()
        || b.created_at.getTime() - a.created_at.getTime()
        || b.id.localeCompare(a.id))

    return matches[0] ?? null
  }

  async listCases(
    opts: PaginationOpts & { status?: string; case_type?: string; queue?: string },
  ): Promise<PaginatedResult<ModerationCase>> {
    const items = Array.from(this.cases.values())
      .filter((item) => (opts.status ? item.status === opts.status : true))
      .filter((item) => (opts.case_type ? item.case_type === opts.case_type : true))
      .filter((item) => (opts.queue ? item.queue === opts.queue : true))
      .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
    return paginate(items, opts)
  }

  async addCaseTarget(input: CreateModerationCaseTargetInput): Promise<ModerationCaseTarget> {
    const entity: ModerationCaseTarget = {
      id: cuid('ctarget'),
      case_id: input.case_id,
      target_type: input.target_type,
      target_id: input.target_id,
      relation_type: input.relation_type ?? 'PRIMARY',
      channel: input.channel,
      meta: input.meta ?? null,
      community_id: input.community_id ?? null,
      agent_id: input.agent_id ?? null,
      user_id: input.user_id ?? null,
      room_id: input.room_id ?? null,
      session_id: input.session_id ?? null,
      message_id: input.message_id ?? null,
      created_at: new Date(),
    }
    const items = this.caseTargets.get(input.case_id) ?? []
    items.push(entity)
    this.caseTargets.set(input.case_id, items)
    return entity
  }

  async updateCaseTargets(caseId: string, input: UpdateModerationCaseTargetInput): Promise<ModerationCaseTarget[]> {
    const existing = this.caseTargets.get(caseId) ?? []
    const next = existing.map((target) => ({
      ...target,
      ...(input.target_id !== undefined ? { target_id: input.target_id } : {}),
      ...(input.relation_type !== undefined ? { relation_type: input.relation_type } : {}),
      ...(input.meta !== undefined ? { meta: input.meta } : {}),
      ...(input.room_id !== undefined ? { room_id: input.room_id } : {}),
      ...(input.session_id !== undefined ? { session_id: input.session_id } : {}),
      ...(input.message_id !== undefined ? { message_id: input.message_id } : {}),
    }))
    this.caseTargets.set(caseId, next)
    return [...next]
  }

  async listCaseTargets(caseId: string): Promise<ModerationCaseTarget[]> {
    return [...(this.caseTargets.get(caseId) ?? [])]
  }

  async addEvidenceSnapshot(input: CreateModerationEvidenceSnapshotInput): Promise<ModerationEvidenceSnapshot> {
    const entity: ModerationEvidenceSnapshot = {
      id: cuid('evid'),
      case_id: input.case_id,
      snapshot_type: input.snapshot_type,
      payload: input.payload ?? {},
      content: input.content ?? null,
      context: input.context ?? null,
      policy_hits: input.policy_hits ?? null,
      prompt_memory: input.prompt_memory ?? null,
      topic_signals: input.topic_signals ?? null,
      action_history: input.action_history ?? null,
      evidence_package: input.evidence_package ?? buildEvidencePackage(input),
      created_at: new Date(),
    }
    const items = this.evidenceSnapshots.get(input.case_id) ?? []
    items.push(entity)
    this.evidenceSnapshots.set(input.case_id, items)
    return entity
  }

  async listEvidenceSnapshots(caseId: string): Promise<ModerationEvidenceSnapshot[]> {
    return [...(this.evidenceSnapshots.get(caseId) ?? [])]
  }

  async createReviewTask(input: CreateReviewTaskInput): Promise<ReviewTask> {
    const now = new Date()
    const entity: ReviewTask = {
      id: cuid('rtask'),
      case_id: input.case_id,
      queue: input.queue ?? 'MODERATION',
      task_type: input.task_type,
      status: input.status ?? 'PENDING',
      assignee_user_id: input.assignee_user_id ?? null,
      claim_token: input.claim_token ?? null,
      claimed_by_user_id: input.claimed_by_user_id ?? null,
      claimed_at: input.claimed_at ?? null,
      assigned_role: input.assigned_role ?? null,
      due_at: input.due_at ?? null,
      resolution_code: input.resolution_code ?? null,
      operator_note: input.operator_note ?? null,
      completed_at: input.completed_at ?? null,
      created_at: now,
      updated_at: now,
    }
    this.reviewTasks.set(entity.id, entity)
    const ids = this.reviewTasksByCase.get(entity.case_id) ?? []
    ids.push(entity.id)
    this.reviewTasksByCase.set(entity.case_id, ids)
    return entity
  }

  async updateReviewTask(id: string, input: UpdateReviewTaskInput): Promise<ReviewTask | null> {
    const existing = this.reviewTasks.get(id)
    if (!existing) return null
    const next: ReviewTask = {
      ...existing,
      ...(input.queue !== undefined ? { queue: input.queue } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.assignee_user_id !== undefined ? { assignee_user_id: input.assignee_user_id } : {}),
      ...(input.claim_token !== undefined ? { claim_token: input.claim_token } : {}),
      ...(input.claimed_by_user_id !== undefined ? { claimed_by_user_id: input.claimed_by_user_id } : {}),
      ...(input.claimed_at !== undefined ? { claimed_at: input.claimed_at } : {}),
      ...(input.assigned_role !== undefined ? { assigned_role: input.assigned_role } : {}),
      ...(input.due_at !== undefined ? { due_at: input.due_at } : {}),
      ...(input.resolution_code !== undefined ? { resolution_code: input.resolution_code } : {}),
      ...(input.operator_note !== undefined ? { operator_note: input.operator_note } : {}),
      ...(input.completed_at !== undefined ? { completed_at: input.completed_at } : {}),
      updated_at: new Date(),
    }
    this.reviewTasks.set(id, next)
    return next
  }

  async findReviewTaskById(id: string): Promise<ReviewTask | null> {
    return this.reviewTasks.get(id) ?? null
  }

  async listReviewTasks(caseId: string): Promise<ReviewTask[]> {
    return (this.reviewTasksByCase.get(caseId) ?? [])
      .map((id) => this.reviewTasks.get(id))
      .filter((item): item is ReviewTask => Boolean(item))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async createGovernanceActionLog(input: CreateGovernanceActionLogInput): Promise<GovernanceActionLog> {
    const entity: GovernanceActionLog = {
      id: cuid('gact'),
      case_id: input.case_id ?? null,
      action: input.action,
      target_type: input.target_type,
      target_id: input.target_id,
      actor_user_id: input.actor_user_id,
      reason: input.reason ?? null,
      result: input.result ?? null,
      created_at: new Date(),
    }
    const key = `${entity.target_type}:${entity.target_id}`
    const items = this.actionLogs.get(key) ?? []
    items.push(entity)
    this.actionLogs.set(key, items)
    return entity
  }

  async listGovernanceActionLogs(targetType: string, targetId: string): Promise<GovernanceActionLog[]> {
    return [...(this.actionLogs.get(`${targetType}:${targetId}`) ?? [])]
  }

  async createComplaintTicket(input: CreateComplaintTicketInput): Promise<ComplaintTicket> {
    const now = new Date()
    const entity: ComplaintTicket = {
      id: cuid('cticket'),
      reporter_user_id: input.reporter_user_id,
      target_type: input.target_type,
      target_id: input.target_id,
      complaint_type: input.complaint_type,
      reason_code: input.reason_code,
      detail_text: input.detail_text ?? null,
      attachments: normalizeAttachments(input.attachments),
      status: input.status ?? 'OPEN',
      linked_case_id: input.linked_case_id ?? null,
      resolution: input.resolution ?? null,
      created_at: now,
      updated_at: now,
    }
    this.complaintTickets.set(entity.id, entity)
    return entity
  }

  async updateComplaintTicket(id: string, input: UpdateComplaintTicketInput): Promise<ComplaintTicket | null> {
    const existing = this.complaintTickets.get(id)
    if (!existing) return null
    const next: ComplaintTicket = {
      ...existing,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.linked_case_id !== undefined ? { linked_case_id: input.linked_case_id } : {}),
      ...(input.resolution !== undefined ? { resolution: input.resolution } : {}),
      updated_at: new Date(),
    }
    this.complaintTickets.set(id, next)
    return next
  }

  async findComplaintTicketById(id: string): Promise<ComplaintTicket | null> {
    return this.complaintTickets.get(id) ?? null
  }

  async listComplaintTickets(
    opts: PaginationOpts & { status?: string; reporter_user_id?: string },
  ): Promise<PaginatedResult<ComplaintTicket>> {
    const items = Array.from(this.complaintTickets.values())
      .filter((item) => (opts.status ? item.status === opts.status : true))
      .filter((item) => (opts.reporter_user_id ? item.reporter_user_id === opts.reporter_user_id : true))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }

  async createAppealRequest(input: CreateAppealRequestInput): Promise<AppealRequest> {
    const now = new Date()
    const entity: AppealRequest = {
      id: cuid('appeal'),
      requester_user_id: input.requester_user_id,
      requester_type: input.requester_type ?? 'USER',
      target_type: input.target_type,
      target_id: input.target_id,
      appeal_type: input.appeal_type,
      linked_case_id: input.linked_case_id ?? null,
      linked_complaint_ticket_id: input.linked_complaint_ticket_id ?? null,
      reason: input.reason,
      status: input.status ?? 'OPEN',
      result: input.result ?? null,
      created_at: now,
      updated_at: now,
    }
    this.appealRequests.set(entity.id, entity)
    return entity
  }

  async updateAppealRequest(id: string, input: UpdateAppealRequestInput): Promise<AppealRequest | null> {
    const existing = this.appealRequests.get(id)
    if (!existing) return null
    const next: AppealRequest = {
      ...existing,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.linked_case_id !== undefined ? { linked_case_id: input.linked_case_id } : {}),
      ...(input.linked_complaint_ticket_id !== undefined
        ? { linked_complaint_ticket_id: input.linked_complaint_ticket_id }
        : {}),
      ...(input.result !== undefined ? { result: input.result } : {}),
      updated_at: new Date(),
    }
    this.appealRequests.set(id, next)
    return next
  }

  async findAppealRequestById(id: string): Promise<AppealRequest | null> {
    return this.appealRequests.get(id) ?? null
  }

  async listAppealRequests(
    opts: PaginationOpts & { status?: string; requester_user_id?: string },
  ): Promise<PaginatedResult<AppealRequest>> {
    const items = Array.from(this.appealRequests.values())
      .filter((item) => (opts.status ? item.status === opts.status : true))
      .filter((item) => (opts.requester_user_id ? item.requester_user_id === opts.requester_user_id : true))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    return paginate(items, opts)
  }
}
