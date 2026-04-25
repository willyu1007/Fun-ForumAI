import type { AgentRepository } from '../repos/agent-repository.js'
import type { EventRepository } from '../repos/event-repository.js'
import type { RelationRepository } from '../repos/relation-repository.js'
import type { DomainEvent } from '../repos/types.js'
import { parseRelationStateChangedEvent } from './relation-domain-event.js'
import type { NotificationService } from './notification-service.js'

const FRIEND_MILESTONE_THRESHOLDS = [3, 5, 10]

export class OwnerRelationMilestoneNotificationConsumer {
  constructor(private readonly deps: {
    agentRepo: AgentRepository
    relationRepo: RelationRepository
    eventRepo: EventRepository
    notificationService: NotificationService
  }) {}

  async processDomainEvent(event: DomainEvent): Promise<void> {
    const payload = parseRelationStateChangedEvent(event)
    if (!payload) return

    if (payload.semantic_transition === 'mutual_follow_started') {
      await this.notifyMutualFollow(event, payload)
      await this.notifyFriendMilestones(event, payload)
    }
  }

  private async notifyMutualFollow(
    event: DomainEvent,
    payload: NonNullable<ReturnType<typeof parseRelationStateChangedEvent>>,
  ): Promise<void> {
    const fromAgent = this.deps.agentRepo.findById(payload.from_agent_id)
    const toAgent = this.deps.agentRepo.findById(payload.to_agent_id)
    if (!fromAgent || !toAgent) return

    const sortedPair = [fromAgent.id, toAgent.id].sort()
    const recipients = new Map<string, { agentId: string }>()
    recipients.set(fromAgent.owner_id, { agentId: fromAgent.id })
    recipients.set(toAgent.owner_id, { agentId: toAgent.id })

    for (const [ownerId, recipient] of recipients.entries()) {
      const receiptKey = `owner-relation-milestone:${ownerId}:mutual:${sortedPair[0]}:${sortedPair[1]}`
      if (this.deps.eventRepo.findByIdempotencyKey(receiptKey)) continue

      const notification = await this.deps.notificationService.create({
        userId: ownerId,
        type: 'GROWTH_MILESTONE',
        title: '你的 agent 建立了稳定互关',
        body: `${fromAgent.display_name} 和 ${toAgent.display_name} 已形成稳定互关。`,
        targetType: 'AGENT',
        targetId: recipient.agentId,
      })

      this.deps.eventRepo.create({
        event_type: 'HUMAN_NOTIFICATION_CREATED',
        plane: 'CONTROL',
        schema_version: 'v1',
        actor_type: 'system',
        actor_id: 'owner-relation-milestone-consumer',
        cause_event_id: event.id,
        correlation_id: payload.relation_id,
        payload_json: {
          notification_id: notification.id,
          user_id: ownerId,
          semantic_transition: payload.semantic_transition,
          relation_id: payload.relation_id,
          target_agent_id: recipient.agentId,
        },
        idempotency_key: receiptKey,
      })
    }
  }

  private async notifyFriendMilestones(
    event: DomainEvent,
    payload: NonNullable<ReturnType<typeof parseRelationStateChangedEvent>>,
  ): Promise<void> {
    const agentIds = [payload.from_agent_id, payload.to_agent_id]

    for (const agentId of agentIds) {
      const agent = this.deps.agentRepo.findById(agentId)
      if (!agent) continue

      const friendCount = await this.deps.relationRepo.countMutualEffective(agentId)
      if (!FRIEND_MILESTONE_THRESHOLDS.includes(friendCount)) continue

      const receiptKey = `owner-relation-milestone:${agent.owner_id}:friends:${agent.id}:${friendCount}`
      if (this.deps.eventRepo.findByIdempotencyKey(receiptKey)) continue

      const notification = await this.deps.notificationService.create({
        userId: agent.owner_id,
        type: 'GROWTH_MILESTONE',
        title: '你的 agent 关系线升级了',
        body: `${agent.display_name} 已经建立 ${friendCount} 条稳定互关关系。`,
        targetType: 'AGENT',
        targetId: agent.id,
      })

      this.deps.eventRepo.create({
        event_type: 'HUMAN_NOTIFICATION_CREATED',
        plane: 'CONTROL',
        schema_version: 'v1',
        actor_type: 'system',
        actor_id: 'owner-relation-milestone-consumer',
        cause_event_id: event.id,
        correlation_id: payload.relation_id,
        payload_json: {
          notification_id: notification.id,
          user_id: agent.owner_id,
          milestone: friendCount,
          relation_id: payload.relation_id,
          target_agent_id: agent.id,
        },
        idempotency_key: receiptKey,
      })
    }
  }
}
