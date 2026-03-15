import type {
  ModerationCase,
  ReviewCaseType,
  ReviewQueue,
} from '../../repos/types.js'
import { ValidationError } from '../../lib/errors.js'
import type { RiskGovernanceRepository } from '../../repos/risk-governance-repository.js'
import type { NotificationService } from '../notification-service.js'

export interface ReviewServiceContext {
  riskRepo: RiskGovernanceRepository
  notificationService: NotificationService | null
}

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

export async function getPrimaryTarget(context: ReviewServiceContext, caseId: string) {
  const targets = await context.riskRepo.listCaseTargets(caseId)
  return targets.find((target) => target.relation_type === 'PRIMARY') ?? targets[0] ?? null
}

export async function getCaseLinks(
  context: ReviewServiceContext,
  moderationCase: ModerationCase,
) {
  const [linkedComplaint, linkedAppeal] = await Promise.all([
    moderationCase.linked_complaint_ticket_id
      ? context.riskRepo.findComplaintTicketById(moderationCase.linked_complaint_ticket_id)
      : Promise.resolve(null),
    moderationCase.linked_appeal_request_id
      ? context.riskRepo.findAppealRequestById(moderationCase.linked_appeal_request_id)
      : Promise.resolve(null),
  ])

  return {
    linked_complaint: linkedComplaint,
    linked_appeal: linkedAppeal,
  }
}

export function deriveTicketStatusFromResolution(
  resolutionAction: string,
): 'RESOLVED' | 'REJECTED' {
  const normalized = resolutionAction.trim().toLowerCase()
  if (
    normalized.includes('reject') ||
    normalized.includes('dismiss') ||
    normalized.includes('deny') ||
    normalized.includes('invalid') ||
    normalized.includes('duplicate') ||
    normalized.includes('no_action') ||
    normalized.includes('no-op')
  ) {
    return 'REJECTED'
  }
  return 'RESOLVED'
}

export async function createGovernanceNotification(
  context: ReviewServiceContext,
  input: {
    user_id: string
    title: string
    body: string
    target_type: string
    target_id: string
  },
) {
  if (!context.notificationService) return null
  return context.notificationService.create({
    userId: input.user_id,
    type: 'GOVERNANCE',
    title: input.title,
    body: input.body,
    targetType: input.target_type,
    targetId: input.target_id,
  })
}

export function deriveQueue(caseType: ReviewCaseType): ReviewQueue {
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

export function computeSlaDueAt(
  queue: ReviewQueue,
  priority: number,
  requested?: Date | null,
): Date | null {
  if (requested !== undefined) return requested
  const baseHours = QUEUE_SLA_HOURS[queue]
  const factor = priority >= 95 ? 0.25 : priority >= 90 ? 0.5 : priority >= 80 ? 0.75 : 1
  const dueAt = new Date()
  dueAt.setHours(dueAt.getHours() + Math.max(1, Math.round(baseHours * factor)))
  return dueAt
}

export function defaultAssignedRole(queue: ReviewQueue): string {
  return DEFAULT_ASSIGNED_ROLE[queue]
}

export function ensureAssignableCase(moderationCase: ModerationCase): void {
  if (moderationCase.status === 'RESOLVED' || moderationCase.status === 'DISMISSED') {
    throw new ValidationError('case is not assignable')
  }
}

export function ensureResolvableCase(moderationCase: ModerationCase): void {
  if (moderationCase.status === 'RESOLVED' || moderationCase.status === 'DISMISSED') {
    throw new ValidationError('case is not resolvable')
  }
}

export function ensureReopenableCase(moderationCase: ModerationCase): void {
  if (moderationCase.status === 'OPEN' || moderationCase.status === 'IN_REVIEW') {
    throw new ValidationError('case is already open')
  }
}
