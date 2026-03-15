import type { ReviewTask } from '../../repos/types.js'
import { ValidationError } from '../../lib/errors.js'
import type { ReleasedReviewCase } from './types.js'
import {
  defaultAssignedRole,
  ensureAssignableCase,
  getPrimaryTarget,
  type ReviewServiceContext,
} from './shared.js'

export async function createTaskForCase(
  context: ReviewServiceContext,
  input: {
    case_id: string
    queue: ReviewTask['queue']
    task_type: string
    due_at?: Date | null
    assigned_role?: string | null
    assignee_user_id?: string | null
    status?: ReviewTask['status']
    claim_token?: string | null
    claimed_by_user_id?: string | null
    claimed_at?: Date | null
    operator_note?: string | null
  },
) {
  return context.riskRepo.createReviewTask({
    case_id: input.case_id,
    queue: input.queue,
    task_type: input.task_type,
    status: input.status,
    assignee_user_id: input.assignee_user_id,
    claim_token: input.claim_token,
    claimed_by_user_id: input.claimed_by_user_id,
    claimed_at: input.claimed_at,
    assigned_role: input.assigned_role ?? defaultAssignedRole(input.queue),
    due_at: input.due_at,
    operator_note: input.operator_note,
  })
}

export async function completeOutstandingTasks(
  context: ReviewServiceContext,
  caseId: string,
  resolutionAction: string,
  resolutionNote: string | null,
  completedAt: Date,
): Promise<void> {
  const tasks = await context.riskRepo.listReviewTasks(caseId)
  await Promise.all(
    tasks
      .filter((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELED')
      .map((task) =>
        context.riskRepo.updateReviewTask(task.id, {
          status: 'COMPLETED',
          resolution_code: resolutionAction,
          operator_note: resolutionNote ?? task.operator_note,
          completed_at: completedAt,
        }),
      ),
  )
}

export async function assignCase(
  context: ReviewServiceContext,
  caseId: string,
  assigneeUserId: string | null,
  actorUserId = assigneeUserId ?? 'system',
) {
  const existing = await context.riskRepo.findCaseById(caseId)
  if (!existing) return null
  ensureAssignableCase(existing)

  const tasks = await context.riskRepo.listReviewTasks(caseId)
  const activeTask =
    tasks.find((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELED') ?? null
  const claimedAt = assigneeUserId ? new Date() : null
  if (activeTask) {
    await context.riskRepo.updateReviewTask(activeTask.id, {
      status: assigneeUserId ? 'ASSIGNED' : 'PENDING',
      assignee_user_id: assigneeUserId,
      claim_token: assigneeUserId
        ? (activeTask.claim_token ?? `claim_${caseId}_${claimedAt?.getTime() ?? Date.now()}`)
        : null,
      claimed_by_user_id: assigneeUserId,
      claimed_at: claimedAt,
      assigned_role: activeTask.assigned_role ?? defaultAssignedRole(activeTask.queue),
    })
  }
  const updated = await context.riskRepo.updateCase(caseId, {
    status: assigneeUserId ? 'IN_REVIEW' : 'OPEN',
    assigned_to_user_id: assigneeUserId,
    claimed_by_user_id: assigneeUserId,
    claimed_at: claimedAt,
  })
  if (!updated) return null

  const target = await getPrimaryTarget(context, caseId)
  if (target) {
    await context.riskRepo.createGovernanceActionLog({
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

export async function releaseCase(
  context: ReviewServiceContext,
  caseId: string,
  actorUserId = 'system',
  input?: { operator_note?: string | null },
): Promise<ReleasedReviewCase | null> {
  const existing = await context.riskRepo.findCaseById(caseId)
  if (!existing) return null
  if (existing.status === 'RESOLVED' || existing.status === 'DISMISSED') {
    throw new ValidationError('case is not releasable')
  }

  const releasedAt = new Date()
  const tasks = await context.riskRepo.listReviewTasks(caseId)
  const activeTasks = tasks.filter(
    (task) => task.status !== 'COMPLETED' && task.status !== 'CANCELED',
  )
  const releasedTasks = await Promise.all(
    activeTasks.map((task) =>
      context.riskRepo.updateReviewTask(task.id, {
        status: 'PENDING',
        assignee_user_id: null,
        claim_token: null,
        claimed_by_user_id: null,
        claimed_at: null,
        operator_note: input?.operator_note ?? task.operator_note,
      }),
    ),
  )

  const updatedCase = await context.riskRepo.updateCase(caseId, {
    status: 'OPEN',
    assigned_to_user_id: null,
    claimed_by_user_id: null,
    claimed_at: null,
  })

  await context.riskRepo.addEvidenceSnapshot({
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
      released_task_ids: releasedTasks
        .map((task) => task?.id ?? null)
        .filter((taskId): taskId is string => Boolean(taskId)),
      operator_note: input?.operator_note ?? null,
    },
  })

  const target = await getPrimaryTarget(context, caseId)
  if (target) {
    await context.riskRepo.createGovernanceActionLog({
      case_id: caseId,
      action: 'case_released',
      target_type: target.target_type,
      target_id: target.target_id,
      actor_user_id: actorUserId,
      reason: input?.operator_note ?? 'case_released',
      result: {
        case_status: updatedCase?.status ?? existing.status,
        previous_assignee_user_id: existing.assigned_to_user_id,
        released_task_ids: releasedTasks
          .map((task) => task?.id ?? null)
          .filter((taskId): taskId is string => Boolean(taskId)),
      },
    })
  }

  return {
    case: updatedCase,
    tasks: releasedTasks.filter((task): task is ReviewTask => Boolean(task)),
  }
}

export async function transferCase(
  context: ReviewServiceContext,
  caseId: string,
  assigneeUserId: string,
  actorUserId = 'system',
  input?: { assigned_role?: string | null; operator_note?: string | null },
) {
  const nextAssignee = assigneeUserId.trim()
  if (!nextAssignee) {
    throw new ValidationError('assignee_user_id is required')
  }

  const existing = await context.riskRepo.findCaseById(caseId)
  if (!existing) return null
  if (existing.status === 'RESOLVED' || existing.status === 'DISMISSED') {
    throw new ValidationError('case is not transferable')
  }

  const claimedAt = new Date()
  const previousAssignee = existing.assigned_to_user_id
  const tasks = await context.riskRepo.listReviewTasks(caseId)
  const activeTask =
    tasks.find((task) => task.status !== 'COMPLETED' && task.status !== 'CANCELED') ?? null
  const claimToken = activeTask?.claim_token ?? `transfer_${caseId}_${claimedAt.getTime()}`

  const updatedTask = activeTask
    ? await context.riskRepo.updateReviewTask(activeTask.id, {
        status: 'ASSIGNED',
        assignee_user_id: nextAssignee,
        claim_token: claimToken,
        claimed_by_user_id: nextAssignee,
        claimed_at: claimedAt,
        assigned_role:
          input?.assigned_role ??
          activeTask.assigned_role ??
          defaultAssignedRole(activeTask.queue),
        operator_note: input?.operator_note ?? activeTask.operator_note,
      })
    : await createTaskForCase(context, {
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

  const updatedCase = await context.riskRepo.updateCase(caseId, {
    status: 'IN_REVIEW',
    assigned_to_user_id: nextAssignee,
    claimed_by_user_id: nextAssignee,
    claimed_at: claimedAt,
  })

  await context.riskRepo.addEvidenceSnapshot({
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

  const target = await getPrimaryTarget(context, caseId)
  if (target) {
    await context.riskRepo.createGovernanceActionLog({
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

export async function claimTask(
  context: ReviewServiceContext,
  taskId: string,
  actorUserId: string,
  input?: { assigned_role?: string | null; operator_note?: string | null },
) {
  const task = await context.riskRepo.findReviewTaskById(taskId)
  if (!task) return null
  if (task.status === 'COMPLETED' || task.status === 'CANCELED') {
    throw new ValidationError('task is not claimable')
  }
  if (
    task.status === 'ASSIGNED' &&
    ((task.claimed_by_user_id && task.claimed_by_user_id !== actorUserId) ||
      (task.assignee_user_id && task.assignee_user_id !== actorUserId))
  ) {
    throw new ValidationError('task is already claimed')
  }

  const claimedAt = new Date()
  const claimToken = task.claim_token ?? `claim_${task.id}_${claimedAt.getTime()}`
  const updatedTask = await context.riskRepo.updateReviewTask(task.id, {
    status: 'ASSIGNED',
    assignee_user_id: actorUserId,
    claim_token: claimToken,
    claimed_by_user_id: actorUserId,
    claimed_at: claimedAt,
    assigned_role: input?.assigned_role ?? task.assigned_role ?? defaultAssignedRole(task.queue),
    operator_note: input?.operator_note ?? task.operator_note,
  })
  if (!updatedTask) return null

  const updatedCase = await context.riskRepo.updateCase(task.case_id, {
    status: 'IN_REVIEW',
    assigned_to_user_id: actorUserId,
    claimed_by_user_id: actorUserId,
    claimed_at: claimedAt,
  })

  const target = await getPrimaryTarget(context, task.case_id)
  if (target) {
    await context.riskRepo.createGovernanceActionLog({
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
