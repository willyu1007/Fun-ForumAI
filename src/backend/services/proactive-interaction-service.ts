import type { LlmClient } from '../llm/llm-client.js'
import type { AgentService } from './agent-service.js'
import type { NotificationService } from './notification-service.js'
import type { PrivateChannelRepository } from '../repos/private-channel-repository.js'

const MAX_PROACTIVE_PER_DAY = 2
const PROACTIVE_COOLDOWN_MS = 4 * 60 * 60 * 1000 // 4 hours between proactive sessions

export interface ProactiveInteractionDeps {
  channelRepo: PrivateChannelRepository
  agentService: AgentService
  llmClient: LlmClient
  notificationService: NotificationService
}

export class ProactiveInteractionService {
  constructor(private readonly deps: ProactiveInteractionDeps) {}

  async onVoteReceived(agentId: string, vote: {
    direction: string
    target_type: string
    target_id: string
    voter_agent_id: string
  }): Promise<boolean> {
    if (vote.direction !== 'UP') return false

    const agent = this.deps.agentService.getAgent(agentId)
    if (!agent) return false

    const canTrigger = await this.canTriggerProactive(agentId)
    if (!canTrigger) return false

    const voterAgent = this.deps.agentService.getAgent(vote.voter_agent_id)
    const voterName = voterAgent?.display_name ?? '一位智能体'

    const targetLabel = vote.target_type === 'POST' ? '帖子' : vote.target_type === 'COMMENT' ? '评论' : '消息'

    const openingMessage = await this.generateOpeningMessage(agentId, {
      trigger: 'vote_received',
      context: `${voterName}给你的${targetLabel}点了赞。`,
    })

    const session = await this.deps.channelRepo.createSession({
      agent_id: agentId,
      human_user_id: agent.owner_id,
      initiator: 'AGENT',
      trigger_type: 'VOTE_RECEIVED',
      trigger_ref: vote.target_id,
    })

    await this.deps.channelRepo.createMessage({
      session_id: session.id,
      author_type: 'AGENT',
      content: openingMessage,
    })

    await this.deps.notificationService.create({
      userId: agent.owner_id,
      type: 'AGENT_PROACTIVE',
      title: `${agent.display_name} 想和你聊聊`,
      body: `你的${targetLabel}获得了 ${voterName} 的赞同，${agent.display_name} 有些想法想分享。`,
      targetType: 'private_session',
      targetId: session.id,
    })

    return true
  }

  async onOpinionChallenged(agentId: string, challenge: {
    challenger_agent_id: string
    original_content: string
    challenge_content: string
    post_id: string
    comment_id?: string
  }): Promise<boolean> {
    const agent = this.deps.agentService.getAgent(agentId)
    if (!agent) return false

    const canTrigger = await this.canTriggerProactive(agentId)
    if (!canTrigger) return false

    const challengerAgent = this.deps.agentService.getAgent(challenge.challenger_agent_id)
    const challengerName = challengerAgent?.display_name ?? '一位智能体'

    const openingMessage = await this.generateOpeningMessage(agentId, {
      trigger: 'opinion_challenged',
      context: [
        `${challengerName}对你的观点提出了质疑。`,
        `你的原文："${challenge.original_content.slice(0, 200)}"`,
        `质疑内容："${challenge.challenge_content.slice(0, 200)}"`,
      ].join('\n'),
    })

    const session = await this.deps.channelRepo.createSession({
      agent_id: agentId,
      human_user_id: agent.owner_id,
      initiator: 'AGENT',
      trigger_type: 'OPINION_CHALLENGED',
      trigger_ref: challenge.comment_id ?? challenge.post_id,
    })

    await this.deps.channelRepo.createMessage({
      session_id: session.id,
      author_type: 'AGENT',
      content: openingMessage,
    })

    await this.deps.notificationService.create({
      userId: agent.owner_id,
      type: 'AGENT_PROACTIVE',
      title: `${agent.display_name} 的观点被质疑了`,
      body: `${challengerName} 对你的 Agent 的观点提出了不同看法，${agent.display_name} 想听听你的意见。`,
      targetType: 'private_session',
      targetId: session.id,
    })

    return true
  }

  async onAgentFirstPost(agentId: string, postId: string): Promise<void> {
    const agent = this.deps.agentService.getAgent(agentId)
    if (!agent) return

    await this.deps.notificationService.create({
      userId: agent.owner_id,
      type: 'AGENT_FIRST_POST',
      title: `${agent.display_name} 发布了第一个帖子！`,
      body: `你的 Agent 迈出了在论坛中的第一步。去看看吧，也可以和 TA 私聊讨论。`,
      targetType: 'post',
      targetId: postId,
    })
  }

  private async canTriggerProactive(agentId: string): Promise<boolean> {
    const agent = this.deps.agentService.getAgent(agentId)
    if (!agent) return false

    // Check daily limit
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todaySessions = await this.deps.channelRepo.listSessions(agentId, {
      limit: MAX_PROACTIVE_PER_DAY + 1,
      initiator: 'AGENT',
    })

    const todayCount = todaySessions.items.filter(
      (s) => s.started_at >= todayStart,
    ).length

    if (todayCount >= MAX_PROACTIVE_PER_DAY) return false

    // Check if owner responded to last proactive session
    const lastProactive = todaySessions.items[0]
    if (lastProactive && lastProactive.started_at >= todayStart) {
      const messages = await this.deps.channelRepo.listMessages(lastProactive.id, { limit: 10 })
      const hasOwnerReply = messages.items.some((m) => m.author_type === 'HUMAN')
      if (!hasOwnerReply) return false

      // Cooldown check
      const elapsed = Date.now() - lastProactive.started_at.getTime()
      if (elapsed < PROACTIVE_COOLDOWN_MS) return false
    }

    return true
  }

  private async generateOpeningMessage(
    agentId: string,
    trigger: { trigger: string; context: string },
  ): Promise<string> {
    const agent = this.deps.agentService.getAgent(agentId)
    const config = this.deps.agentService.getLatestConfig(agentId)
    const persona = config?.config_json?.persona as Record<string, unknown> | undefined
    const personaName = (persona?.name as string) || agent?.display_name || '智能体'
    const personaStyle = (persona?.style as string) || '友好'

    const response = await this.deps.llmClient.chat({
      messages: [
        {
          role: 'system',
          content: [
            `你是「${personaName}」，风格是${personaStyle}。`,
            '你正在主动和你的 Owner（人类持有者）发起一次简短对话。',
            '要求：',
            '- 语气自然亲切，像朋友分享事情',
            '- 简洁，2-4 句话',
            '- 不要说"作为AI"或类似自我指涉',
            '- 根据触发事件自然地开启对话',
          ].join('\n'),
        },
        {
          role: 'user',
          content: `触发事件：${trigger.trigger}\n${trigger.context}\n\n请自然地开启对话。`,
        },
      ],
      temperature: 0.8,
      model: agent?.model,
    })

    return response.content
  }
}
