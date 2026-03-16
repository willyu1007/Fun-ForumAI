import type { PromptEngine } from '../llm/prompt-engine.js'
import type { LLMGateway } from '../llm/llm-gateway.js'
import type { RenderDecision } from '../llm/gateway-contract.js'
import type { AgentService } from './agent-service.js'
import type { NotificationService } from './notification-service.js'
import type { PrivateChannelRepository } from '../repos/private-channel-repository.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import type { PromptOrchestrator } from '../runtime/prompt-orchestrator.js'
import type { RenderTierDecisionResult } from '../runtime/persona-runtime-types.js'
import { PROMPT_TEMPLATE_REFS } from '../llm/prompt-template-refs.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import type { PersonaStateService } from './persona-state-service.js'
import type { InferenceProfileService } from './inference-profile-service.js'
import type { PromptComposeAudit } from '../runtime/types.js'
import type { LlmTokenUsage } from '../llm/types.js'
import { resolvePreferredVisibleModelId } from '../llm/model-preference.js'
import {
  attachPersonaObservation,
  buildPersonaObservation,
  type PersonaObservationV1,
  recordPersonaObservation,
} from '../runtime/persona-observation.js'
import type { PolicyGatewayService } from './policy-gateway-service.js'
import type { IdentityGateService } from './identity-gate-service.js'

const MAX_PROACTIVE_PER_DAY = 2
const PROACTIVE_COOLDOWN_MS = 4 * 60 * 60 * 1000

export interface ProactiveInteractionDeps {
  channelRepo: PrivateChannelRepository
  agentService: AgentService
  llmGateway: LLMGateway
  promptOrchestrator?: PromptOrchestrator | null
  personaStateService?: PersonaStateService | null
  inferenceProfileService?: InferenceProfileService | null
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  notificationService: NotificationService
  policyGatewayService?: PolicyGatewayService | null
  identityGateService?: IdentityGateService | null
}

export class ProactiveInteractionService {
  constructor(private readonly deps: ProactiveInteractionDeps) {}

  bindPromptOrchestrator(promptEngine: PromptEngine, promptOrchestrator: PromptOrchestrator): void {
    void promptEngine
    ;(this.deps as { promptOrchestrator?: PromptOrchestrator | null }).promptOrchestrator = promptOrchestrator
  }

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
    const policyDecision = this.deps.policyGatewayService
      ? await this.deps.policyGatewayService.evaluate({
          channel: 'proactive_dm',
          text: openingMessage.content,
          author_agent_id: agentId,
          user_id: agent.owner_id,
          target_type: 'notification',
          target_id: vote.target_id,
          scene: 'proactive_dm',
        })
      : null
    if (policyDecision?.action === 'block') return false
    const effectiveOpeningContent = policyDecision?.final_text ?? openingMessage.content

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
      content: effectiveOpeningContent,
      delivery_status: policyDecision?.delivery_status ?? 'DELIVERED',
      moderation_metadata: policyDecision?.metadata ?? null,
    })

    this.recordOpeningRun({
      agentId,
      sessionId: session.id,
      triggerType: 'vote_received',
      triggerRef: vote.target_id,
      openingMessage: { ...openingMessage, content: effectiveOpeningContent },
    })

    if (openingMessage.renderDecision && this.deps.personaStateService) {
      await this.deps.personaStateService.recordVisibleRender({
        agentId,
        scene: 'proactive_dm',
        renderDecision: openingMessage.renderDecision,
        outputText: effectiveOpeningContent,
      }).catch((err) => {
        console.error('[ProactiveInteraction] persona runtime render record failed:', err)
      })
    }

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
    const policyDecision = this.deps.policyGatewayService
      ? await this.deps.policyGatewayService.evaluate({
          channel: 'proactive_dm',
          text: openingMessage.content,
          topic_context_text: [
            challenge.original_content,
            challenge.challenge_content,
          ].join('\n\n'),
          author_agent_id: agentId,
          user_id: agent.owner_id,
          target_type: 'notification',
          target_id: challenge.comment_id ?? challenge.post_id,
          scene: 'proactive_dm',
        })
      : null
    if (policyDecision?.action === 'block') return false
    const effectiveOpeningContent = policyDecision?.final_text ?? openingMessage.content

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
      content: effectiveOpeningContent,
      delivery_status: policyDecision?.delivery_status ?? 'DELIVERED',
      moderation_metadata: policyDecision?.metadata ?? null,
    })

    this.recordOpeningRun({
      agentId,
      sessionId: session.id,
      triggerType: 'opinion_challenged',
      triggerRef: challenge.comment_id ?? challenge.post_id,
      openingMessage: { ...openingMessage, content: effectiveOpeningContent },
    })

    if (openingMessage.renderDecision && this.deps.personaStateService) {
      await this.deps.personaStateService.recordVisibleRender({
        agentId,
        scene: 'proactive_dm',
        renderDecision: openingMessage.renderDecision,
        outputText: effectiveOpeningContent,
      }).catch((err) => {
        console.error('[ProactiveInteraction] persona runtime render record failed:', err)
      })
    }

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
    if (agent.status === 'LIMITED' || agent.status === 'QUARANTINED' || agent.status === 'BANNED') {
      return false
    }
    if (this.deps.identityGateService) {
      try {
        await this.deps.identityGateService.assertVerified(agent.owner_id, 'proactive_receive')
      } catch {
        return false
      }
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todaySessions = await this.deps.channelRepo.listSessions(agentId, {
      limit: MAX_PROACTIVE_PER_DAY + 1,
      initiator: 'AGENT',
    })

    const todayCount = todaySessions.items.filter((session) => session.started_at >= todayStart).length
    if (todayCount >= MAX_PROACTIVE_PER_DAY) return false

    const lastProactive = todaySessions.items[0]
    if (lastProactive && lastProactive.started_at >= todayStart) {
      const messages = await this.deps.channelRepo.listMessages(lastProactive.id, { limit: 10 })
      const hasOwnerReply = messages.items.some((message) => message.author_type === 'HUMAN')
      if (!hasOwnerReply) return false

      const elapsed = Date.now() - lastProactive.started_at.getTime()
      if (elapsed < PROACTIVE_COOLDOWN_MS) return false
    }

    return true
  }

  private async generateOpeningMessage(
    agentId: string,
    trigger: { trigger: string; context: string },
  ): Promise<{
    content: string
    renderDecision: RenderTierDecisionResult | null
    usage: LlmTokenUsage
    latencyMs: number
    promptAudit: PromptComposeAudit | null
    sourceCallsiteId: 'proactive-orchestrated-opening'
    gatewayRenderDecision: RenderDecision
    llmProviderId?: string
    llmModelId?: string
  }> {
    const agent = this.deps.agentService.getAgent(agentId)
    const latestConfig = this.deps.agentService.getLatestConfig(agentId)
    const identity = resolveAgentIdentity(agent, latestConfig)
    const defaultHomeVoiceLineId = identity.summary.home_voice_line_id
    const defaultPreferredModelId = resolvePreferredVisibleModelId(agent.model, defaultHomeVoiceLineId)

    if (!this.deps.promptOrchestrator) {
      throw new Error('PromptOrchestrator is not configured for proactive DM')
    }

    const composed = await this.deps.promptOrchestrator.compose({
      agentId,
      scene: 'proactive_dm',
      conversationText: `${trigger.trigger}\n${trigger.context}`,
      topicHints: [trigger.trigger],
      shortTermState: trigger.context.slice(0, 200),
      shortTermStateUpdatedAt: new Date(),
    })

    const variables: Record<string, string> = {
      persona_name: composed.persona.name,
      persona_style: composed.persona.style,
      persona_interests: composed.persona.interests.join('、'),
      persona_language: composed.persona.language,
      trigger_type: trigger.trigger,
      trigger_context: trigger.context,
      layer_traits: composed.layers.layer1_traits ?? '',
      layer_style: composed.layers.layer2_style ?? '',
      layer_instructions: composed.layers.layer3_instructions ?? '',
      layer_community: composed.layers.layer_community ?? '',
      layer_relationship: composed.layers.layer_relationship ?? '',
      layer_showrunner: composed.layers.layer_showrunner ?? '',
      layer_overrides: composed.layers.layer4_overrides ?? '',
      layer_memory: composed.layers.layer5_memory ?? '',
      layer_privacy: composed.layers.layer6_privacy ?? '',
    }

    const routing = this.deps.inferenceProfileService
      ? await this.deps.inferenceProfileService.resolveVisibleRoute({
          agentId,
          requestedTier: composed.runtimeEnvelope?.renderTierDecision.requestedTier ?? 'base',
        })
      : {
          homeVoiceLineId: defaultHomeVoiceLineId,
          preferredModelId: defaultPreferredModelId,
          requestedTier: composed.runtimeEnvelope?.renderTierDecision.requestedTier ?? 'base',
        }
    const startMs = Date.now()
    const response = await this.deps.llmGateway.generateVisibleText({
      intent: 'proactive_opening',
      scene: 'proactive_dm',
      agentId,
      homeVoiceLineId: routing.homeVoiceLineId,
      preferredModelId: routing.preferredModelId,
      promptRef: PROMPT_TEMPLATE_REFS.agentProactiveDmOpening,
      variables,
      budgetClass: 'visible_standard',
      traceId: `proactive-dm:${agentId}:${Date.now()}`,
      requestedTier: routing.requestedTier,
      allowFallbackWithinLine: true,
      allowCrossFamily: false,
      temperature: 0.8,
    })

    return {
      content: response.content,
      renderDecision: composed.runtimeEnvelope?.renderTierDecision ?? null,
      usage: response.usage,
      latencyMs: Date.now() - startMs,
      promptAudit: composed.audit,
      sourceCallsiteId: 'proactive-orchestrated-opening',
      gatewayRenderDecision: response.renderDecision,
      llmProviderId: response.renderDecision.providerId,
      llmModelId: response.renderDecision.modelId,
    }
  }

  private recordOpeningRun(input: {
    agentId: string
    sessionId: string
    triggerType: string
    triggerRef: string
    openingMessage: {
      content: string
      renderDecision: RenderTierDecisionResult | null
      usage: LlmTokenUsage
      latencyMs: number
      promptAudit: PromptComposeAudit | null
      sourceCallsiteId: 'proactive-orchestrated-opening'
      gatewayRenderDecision: RenderDecision
      llmProviderId?: string
      llmModelId?: string
    }
  }): void {
    const identity = this.resolveObservationIdentity(input.agentId)
    const observation: PersonaObservationV1 = buildPersonaObservation({
      sourceCallsiteId: input.openingMessage.sourceCallsiteId,
      scene: 'proactive_dm',
      intent: 'proactive_opening',
      visibility: 'visible',
      coverageStatus: 'visible_complete',
      personaSeedCode: identity?.persona_seed_code,
      homeVoiceLineId: identity?.home_voice_line_id,
      promptRef: PROMPT_TEMPLATE_REFS.agentProactiveDmOpening,
      requestedTier: input.openingMessage.gatewayRenderDecision.tier,
      resolvedTier: input.openingMessage.gatewayRenderDecision.tier,
      renderDecision: input.openingMessage.gatewayRenderDecision,
      usage: input.openingMessage.usage,
      latencyMs: input.openingMessage.latencyMs,
      parseSuccess: true,
      promptAudit: input.openingMessage.promptAudit,
      llmProviderId: input.openingMessage.llmProviderId,
      llmModelId: input.openingMessage.llmModelId,
    })

    try {
      const event = this.deps.eventRepo.create({
        event_type: 'PROACTIVE_DM_OPENING_GENERATED',
        plane: 'RUNTIME',
        actor_type: 'agent',
        actor_id: input.agentId,
        correlation_id: `private-session:${input.sessionId}`,
        payload_json: {
          agent_id: input.agentId,
          session_id: input.sessionId,
          trigger_type: input.triggerType,
          trigger_ref: input.triggerRef,
        },
      })

      this.deps.agentRunRepo.create({
        agent_id: input.agentId,
        trigger_event_id: event.id,
        input_digest: `proactive_dm|session:${input.sessionId}|trigger:${input.triggerType}`,
        output_json: attachPersonaObservation(
          {
            session_id: input.sessionId,
            trigger_type: input.triggerType,
            trigger_ref: input.triggerRef,
            reply_len: input.openingMessage.content.length,
          },
          observation,
        ),
        token_cost: input.openingMessage.usage.total_tokens,
        latency_ms: input.openingMessage.latencyMs,
      })
      recordPersonaObservation(observation)
    } catch (err) {
      console.error('[ProactiveInteraction] AgentRun record failed:', err)
    }
  }

  private resolveObservationIdentity(agentId: string): {
    persona_seed_code: import('../../shared/agent-persona-catalog.js').PersonaSeedCode
    home_voice_line_id: import('../../shared/agent-persona-catalog.js').VoiceLineId
  } | null {
    try {
      const agent = this.deps.agentService.getAgent(agentId)
      const latestConfig = this.deps.agentService.getLatestConfig(agentId)
      const resolved = resolveAgentIdentity(agent, latestConfig)
      return {
        persona_seed_code: resolved.summary.persona_seed_code,
        home_voice_line_id: resolved.summary.home_voice_line_id,
      }
    } catch {
      return null
    }
  }
}
