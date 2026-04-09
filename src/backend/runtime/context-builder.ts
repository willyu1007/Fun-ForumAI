import type { ForumReadService } from '../services/forum-read-service.js'
import type { AgentService } from '../services/agent-service.js'
import type { PromptOrchestrator } from './prompt-orchestrator.js'
import type { EventPayload, SelectedAgent } from '../allocator/types.js'
import type {
  AgentPersona,
  CurrentContextSource,
  ExecutionContext,
  PromptRequestEnvelope,
} from './types.js'
import { config } from '../lib/config.js'
import type { CommunityPromptProfileCompiler } from './community-prompt-profile-compiler.js'
import type { CommunityCultureDigestService } from '../services/community-culture-digest-service.js'
import type { ForumSceneContinuityService } from '../services/forum-scene-continuity-service.js'
import type { ChatService } from '../services/chat-service.js'
import type { ChatroomRuntimeContextBuilder } from '../services/chatroom-runtime-context-builder.js'
import type { SemanticProjectionService } from '../services/semantic-projection-service.js'
import type { DisplayProjectionService } from '../services/display-projection-service.js'
import type { AgentPerceptionService } from '../services/agent-perception-service.js'
import type { RuntimeContextAssembler } from '../services/runtime-context-assembler.js'
import { ThreadLifecycleService } from '../services/thread-lifecycle-service.js'
import { ThreadInteractionResolver } from '../services/thread-interaction-resolver.js'
import { resolveAgentIdentity } from '../identity/agent-identity.js'
import { runtimeFeatureMetrics } from './runtime-feature-metrics.js'

export interface ContextBuilderDeps {
  forumReadService: ForumReadService
  agentService: AgentService
  promptOrchestrator?: PromptOrchestrator | null
  communityPromptProfileCompiler?: CommunityPromptProfileCompiler | null
  communityCultureDigestService?: CommunityCultureDigestService | null
  forumSceneContinuityService?: ForumSceneContinuityService | null
  chatService?: ChatService | null
  chatroomRuntimeContextBuilder?: ChatroomRuntimeContextBuilder | null
  semanticProjectionService?: Pick<SemanticProjectionService, 'buildPostSemanticCapsule' | 'buildReadingGuide' | 'buildThreadCapsule'> | null
  displayProjectionService?: Pick<DisplayProjectionService, 'buildDiscussionForest'> | null
  agentPerceptionService?: Pick<AgentPerceptionService, 'buildSlice'> | null
  runtimeContextAssembler?: Pick<RuntimeContextAssembler, 'build'> | null
}

const DEFAULT_PERSONA: AgentPersona = {
  name: '匿名智能体',
  style: '中立客观，简洁明了',
  interests: ['通用话题'],
  language: 'zh-CN',
}

const DEFAULT_THREAD_LIFECYCLE_SERVICE = new ThreadLifecycleService()
const DEFAULT_THREAD_INTERACTION_RESOLVER = new ThreadInteractionResolver()

export class ContextBuilder {
  constructor(private readonly deps: ContextBuilderDeps) {}

  async build(event: EventPayload, agent: SelectedAgent): Promise<ExecutionContext> {
    const persona = this.loadPersona(agent.agent_id)

    const community = await this.loadCommunity(event.community_id)

    const ctx: ExecutionContext = { event, agent, persona, community }

    if (event.post_id) {
      ctx.post = await this.loadPost(event.post_id)
      ctx.threadTurns = await this.loadThreadTurns(event.post_id, event.thread_id)
      const targetThreadId = event.thread_id
      if (targetThreadId) {
        ctx.threadMeta = await this.loadThreadMeta(targetThreadId)
        if (event.event_type === 'ThreadOpened' || event.event_type === 'ThreadTurnAdded') {
          ctx.skip_reason = this.resolveThreadSkipReason(ctx.threadMeta) ?? undefined
        }
      }
    }

    if ((event.event_type === 'ThreadOpened' || event.event_type === 'ThreadTurnAdded') && ctx.threadTurns?.length) {
      const targetId = event.turn_id ?? event.thread_id
      if (targetId) {
        ctx.targetThreadTurn = ctx.threadTurns.find((entry) => entry.id === targetId)
      } else {
        ctx.targetThreadTurn = ctx.threadTurns[ctx.threadTurns.length - 1]
      }
    }

    if (
      !ctx.skip_reason
      && this.deps.forumSceneContinuityService
      && (
        event.event_type === 'NewPostCreated'
        || event.event_type === 'ThreadOpened'
        || event.event_type === 'ThreadTurnAdded'
      )
    ) {
      const targetThreadAuthorAgentId = ctx.targetThreadTurn?.entry_kind === 'THREAD'
        ? ctx.targetThreadTurn.author_agent_id
        : undefined
      const targetTurnAuthorAgentId = ctx.targetThreadTurn?.entry_kind === 'TURN'
        ? ctx.targetThreadTurn.author_agent_id
        : undefined
      const continuity = await this.deps.forumSceneContinuityService.resolve({
        event,
        post_author_agent_id: ctx.post?.author_agent_id,
        target_thread_author_agent_id: targetThreadAuthorAgentId,
        target_turn_author_agent_id: targetTurnAuthorAgentId,
      })
      if (continuity?.kind === 'skip') {
        ctx.skip_reason = continuity.reason
      } else if (continuity?.kind === 'continue') {
        ctx.public_scene = {
          ...continuity.payload,
          continuity_source: continuity.source,
        }
      }
    }

    const runtimePreviewBuilder = this.deps.forumReadService as unknown as {
      buildRuntimeContextPreview?: (
        input: {
          post_id: string
          thread_id?: string | null
          focus_turn_id?: string | null
        },
      ) => Promise<{
        post_capsule: ExecutionContext['semantic_post_capsule']
        thread_capsule: ExecutionContext['semantic_thread_capsule']
        perceived_slice: ExecutionContext['perceived_context_slice']
        runtime_context: ExecutionContext['forum_runtime_context']
      }>
    }

    if (event.post_id && typeof runtimePreviewBuilder.buildRuntimeContextPreview === 'function') {
      try {
        const preview = await runtimePreviewBuilder.buildRuntimeContextPreview({
          post_id: event.post_id,
          thread_id: event.thread_id ?? null,
          focus_turn_id: agent.selected_anchor_turn_id ?? event.turn_id ?? null,
          agent_id: agent.agent_id,
        })

        ctx.semantic_post_capsule = preview.post_capsule ?? null
        ctx.semantic_thread_capsule = preview.thread_capsule ?? null
        ctx.perceived_context_slice = preview.perceived_slice ?? null
        ctx.forum_runtime_context = preview.runtime_context ?? null

        if (preview.perceived_slice && ctx.threadTurns?.length) {
          const visibleIds = new Set(preview.perceived_slice.visible_node_ids)
          const filtered = ctx.threadTurns.filter((item) => visibleIds.has(item.id))
          if (filtered.length > 0) {
            ctx.threadTurns = filtered
          }
        }
      } catch (error) {
        console.error(
          `[ContextBuilder] forum semantic context build failed for post=${event.post_id} thread=${event.thread_id ?? 'none'} agent=${agent.agent_id}:`,
          error,
        )
      }
    }

    if (
      event.event_type === 'NewMessageCreated'
      && event.room_id
      && this.deps.chatService
      && this.deps.chatroomRuntimeContextBuilder
    ) {
      try {
        const room = await this.deps.chatService.getRoom(event.room_id)
        const recentMessages = await this.deps.chatService.getMessages(event.room_id, { limit: 10 })
        const runtimeChat = await this.deps.chatroomRuntimeContextBuilder.build({
          room,
          agentId: agent.agent_id,
          recentMessages: recentMessages.items,
        })
        ctx.chatContext = runtimeChat.chatContext
        ctx.chat_prompt_variables = {
          program_scene: runtimeChat.promptVariables.program_scene,
          current_beat: runtimeChat.promptVariables.current_beat,
          live_hook: runtimeChat.promptVariables.live_hook,
          unresolved_question: runtimeChat.promptVariables.unresolved_question,
          local_intent_block: runtimeChat.promptVariables.local_intent_block,
          room_public_context_summary: runtimeChat.promptVariables.room_public_context_summary,
          role_hint: runtimeChat.promptVariables.role_hint,
        }
      } catch (error) {
        console.error(
          `[ContextBuilder] chat room runtime context build failed for room=${event.room_id} agent=${agent.agent_id}:`,
          error,
        )
      }
    }

    return ctx
  }

  async enrichWithLayers(ctx: ExecutionContext): Promise<ExecutionContext> {
    const scene: import('./types.js').PromptScene = ctx.event.event_type === 'NewMessageCreated'
      ? 'chat_room'
      : ctx.chatContext
      ? 'chat_room'
      : ctx.targetThreadTurn
        ? 'forum_thread'
        : 'forum_post'
    ctx.promptScene = scene
    const conversationText = this.composeConversationText(ctx)
    const topicHints = this.extractTopicHints(ctx)

    if (!this.deps.promptOrchestrator?.isSceneEnabled(scene)) {
      throw new Error(`PromptOrchestrator unavailable for scene ${scene}`)
    }

    const communityProfile = config.features.communityPromptProfileV1
      ? ctx.community.prompt_profile
      : undefined
    const communityHardRule = communityProfile?.hard_rules_text || ctx.community.rules
    const communitySoftCulture = communityProfile?.soft_culture_text || ctx.community.description

    const composed = await this.deps.promptOrchestrator.compose({
      agentId: ctx.agent.agent_id,
      scene,
      conversationText,
      communityId: ctx.community.id,
      topicHints,
      currentContextSources: this.buildCurrentContextSources(ctx, scene),
      requestEnvelope: this.buildRequestEnvelope(scene, {
        currentUserText: ctx.targetThreadTurn?.body,
      }),
      communityHardRule,
      communitySoftCulture,
      ...(communityProfile
        ? {
            communityProfileProvenance: {
              source: communityProfile.provenance.source,
              version: 'v1',
            },
          }
        : {}),
      sceneRule: ctx.chatContext
        ? `你正在聊天室「${ctx.chatContext.room_name}」中继续群聊`
        : ctx.event.event_type === 'NewMessageCreated'
          ? '你正在聊天室中继续群聊'
        : ctx.targetThreadTurn
          ? '你正在公共 thread 中继续推进当前回合'
          : '你正在论坛帖子下参与公开讨论',
      shortTermState: ctx.chatContext
        ? `recent_messages=${ctx.chatContext.recent_messages.length}`
        : ctx.event.event_type === 'NewMessageCreated'
          ? 'recent_messages=0'
        : ctx.threadMeta
          ? `thread_turns=${Math.max((ctx.threadTurns?.length ?? 1) - 1, 0)};thread_state=${ctx.threadMeta.thread_state};reply_mode=${ctx.threadMeta.writeability.reply_mode};preferred_action=${ctx.threadMeta.writeability.preferred_action};reply_budget_remaining=${ctx.threadMeta.reply_budget_remaining}`
          : ctx.threadTurns
            ? `thread_turns=${Math.max(ctx.threadTurns.length - 1, 0)}`
            : '',
      threadTurns: ctx.threadTurns?.map((entry) => ({
        id: entry.id,
        author_agent_id: entry.author_agent_id,
        body: entry.body,
      })),
      targetThreadTurnId: ctx.targetThreadTurn?.id,
    })
    ctx.persona = composed.persona
    ctx.blocks = composed.blocks
    ctx.runtimeEnvelope = composed.runtimeEnvelope ?? null
    ctx.prompt_audit = composed.audit
    return ctx
  }

  private composeConversationText(ctx: ExecutionContext): string {
    if (ctx.chatContext?.recent_messages?.length) {
      return ctx.chatContext.recent_messages.map((m) => m.body).join(' ')
    }
    if (ctx.targetThreadTurn) {
      const thread = ctx.threadTurns?.map((entry) => entry.body).join(' ') ?? ''
      return `${thread} ${ctx.targetThreadTurn.body}`.trim()
    }
    if (ctx.post) {
      return `${ctx.post.title} ${ctx.post.body}`.trim()
    }
    return ''
  }

  private loadPersona(agentId: string): AgentPersona {
    try {
      const agent = this.deps.agentService.getAgent(agentId)
      const latestConfig = this.deps.agentService.getLatestConfig(agentId)
      return resolveAgentIdentity(agent, latestConfig).visiblePersona
    } catch {
      return DEFAULT_PERSONA
    }
  }

  private async loadCommunity(communityId: string): Promise<ExecutionContext['community']> {
    try {
      const communities = await this.deps.forumReadService.getCommunities({ limit: 100 })
      const c = communities.items.find((item) => item.id === communityId)
      if (!c) {
        return { id: communityId, name: '未知社区', description: '', rules: '' }
      }
      return {
        id: c.id,
        name: c.name,
        description: c.description || '',
        rules: c.rules_json ? JSON.stringify(c.rules_json) : '',
        ...(config.features.communityPromptProfileV1 && this.deps.communityPromptProfileCompiler
          ? {
              prompt_profile: this.deps.communityPromptProfileCompiler.compile({
                communityDescription: c.description,
                rulesJson: c.rules_json,
                cultureDigest: config.features.communityDigestV1 && this.deps.communityCultureDigestService
                  ? await this.deps.communityCultureDigestService.getActiveDigest(c.id)
                  : null,
              }),
            }
          : {}),
      }
    } catch {
      return { id: communityId, name: '未知社区', description: '', rules: '' }
    }
  }

  private async loadPost(postId: string): Promise<ExecutionContext['post'] | undefined> {
    try {
      const post = await this.deps.forumReadService.getPost(postId)
      const authorName = this.getAgentName(post.author_agent_id)
      return {
        id: post.id,
        title: post.title,
        body: post.body,
        author_agent_id: post.author_agent_id,
        author_name: authorName,
      }
    } catch {
      return undefined
    }
  }

  private async loadThreadTurns(postId: string, threadId?: string): Promise<ExecutionContext['threadTurns']> {
    try {
      if (threadId) {
        const thread = await this.deps.forumReadService.getThread(threadId)
        return this.flattenThreadTurns([thread])
      }
      const result = await this.deps.forumReadService.getThreads(postId, { limit: 20 })
      return this.flattenThreadTurns(result.items)
    } catch {
      return []
    }
  }

  private async loadThreadMeta(threadId: string): Promise<ExecutionContext['threadMeta'] | undefined> {
    try {
      const lifecycleLoader = this.deps.forumReadService as unknown as {
        getThreadLifecycle?: (threadId: string) => Promise<{
          thread_id: string
          thread_state: NonNullable<ExecutionContext['threadMeta']>['thread_state']
          reply_budget: {
            hard_cap_turns: number | null
            remaining_turns: number | null
            limit: number
            remaining: number
          }
          active_route: {
            route_type: 'SPINOFF' | 'AFTERSHOW' | 'PRIVATE' | 'AUDIENCE'
            route_state: string
          } | null
          writeability: NonNullable<ExecutionContext['threadMeta']>['writeability']
        }>
      }
      if (typeof lifecycleLoader.getThreadLifecycle === 'function') {
        const lifecycle = await lifecycleLoader.getThreadLifecycle(threadId)
        return toThreadMeta(lifecycle)
      }

      const thread = await this.deps.forumReadService.getThread(threadId)
      if (thread.lifecycle?.writeability) {
        return toThreadMeta(thread.lifecycle)
      }

      const turnCount = typeof thread.turn_count === 'number'
        ? thread.turn_count
        : Array.isArray(thread.turns)
          ? thread.turns.length
          : 0
      const lifecycle = DEFAULT_THREAD_INTERACTION_RESOLVER.resolveLifecycleSnapshot(
        DEFAULT_THREAD_LIFECYCLE_SERVICE.buildThreadLifecycle(thread, turnCount),
      )
      return toThreadMeta(lifecycle)
    } catch {
      return undefined
    }
  }

  private resolveThreadSkipReason(
    threadMeta: ExecutionContext['threadMeta'] | undefined,
  ): string | null {
    if (!threadMeta?.writeability || threadMeta.writeability.reply_allowed) {
      return null
    }

    const reasonSuffix = threadMeta.writeability.reason_code
      .toLowerCase()
      .replace(/^thread_/, '')
    return `thread_${reasonSuffix}_no_followup`
  }

  private flattenThreadTurns(
    threads: Array<{
      id: string
      post_id: string
      body: string
      author_agent_id: string | null
      author: { id: string; display_name: string }
      turns: Array<{
        id: string
        post_id: string
        thread_id: string
        anchor_turn_id: string | null
        turn_index: number
        body: string
        author_agent_id: string | null
        author: { id: string; display_name: string }
      }>
    }>,
  ): ExecutionContext['threadTurns'] {
    return threads.flatMap((thread) => {
      const threadAuthorId = thread.author_agent_id ?? thread.author.id
      const root = {
        id: thread.id,
        post_id: thread.post_id,
        thread_id: thread.id,
        entry_kind: 'THREAD' as const,
        anchor_turn_id: null,
        body: thread.body,
        author_agent_id: threadAuthorId,
        author_name: thread.author.display_name,
      }
      const turns = thread.turns.map((turn) => ({
        id: turn.id,
        post_id: turn.post_id,
        thread_id: turn.thread_id,
        entry_kind: 'TURN' as const,
        anchor_turn_id: turn.anchor_turn_id ?? thread.id,
        turn_index: turn.turn_index,
        body: turn.body,
        author_agent_id: turn.author_agent_id ?? turn.author.id,
        author_name: turn.author.display_name,
      }))
      return [root, ...turns]
    })
  }

  private getAgentName(agentId: string): string {
    try {
      const agent = this.deps.agentService.getAgent(agentId)
      return agent.display_name
    } catch {
      return '未知智能体'
    }
  }

  private extractTopicHints(ctx: ExecutionContext): string[] {
    const hints: string[] = []

    if (ctx.post) {
      const titleWords = ctx.post.title.split(/[\s,，、；;：:]+/).filter((w) => w.length >= 2)
      hints.push(...titleWords.slice(0, 5))
    }

    if (ctx.chatContext) {
      if (ctx.chatContext.room_name) {
        hints.push(...ctx.chatContext.room_name.split(/[\s,，、]+/).filter((w) => w.length >= 2))
      }
      const recentText = ctx.chatContext.recent_messages
        ?.slice(-3)
        .map((m) => m.body)
        .join(' ')
      if (recentText) {
        const keywords = recentText
          .split(/[\s,，、；;：:。.!！?？]+/)
          .filter((w) => w.length >= 2)
          .slice(0, 5)
        hints.push(...keywords)
      }
    }

    if (ctx.targetThreadTurn) {
      const entryWords = ctx.targetThreadTurn.body
        .split(/[\s,，、；;：:。.!！?？]+/)
        .filter((w) => w.length >= 2)
        .slice(0, 3)
      hints.push(...entryWords)
    }

    return [...new Set(hints)].slice(0, 10)
  }

  private buildCurrentContextSources(
    ctx: ExecutionContext,
    scene: import('./types.js').PromptScene,
  ): CurrentContextSource[] {
    const sources: CurrentContextSource[] = []
    const hasForumRuntimeContext = Boolean(
      config.features.forumOrchestrationEnvelopeCutover
      && ctx.forum_runtime_context,
    )
    if (ctx.post) {
      sources.push({
        kind: 'post_body',
        text: [`标题：${ctx.post.title}`, `正文：${ctx.post.body}`].join('\n'),
        priority: 'critical',
        source_id: ctx.post.id,
      })
    }
    if (hasForumRuntimeContext && ctx.forum_runtime_context) {
      const text = this.serializeForumRuntimeContext(ctx.forum_runtime_context)
      sources.push({
        kind: 'forum_runtime_context',
        text,
        priority: 'critical',
        source_id: ctx.forum_runtime_context.envelope_id,
      })
      runtimeFeatureMetrics.recordForumRuntimeContext({
        token_count: Math.max(1, Math.ceil(text.length / 4)),
        envelope_cutover: true,
      })
    } else if (ctx.threadTurns?.length) {
      sources.push({
        kind: 'thread_excerpt',
        text: ctx.threadTurns
          .slice(-6)
          .map((entry) => `${entry.author_name}：${entry.body}`)
          .join('\n'),
        priority: scene === 'forum_thread' ? 'high' : 'medium',
        source_id: ctx.post?.id,
      })
      if (config.features.forumOrchestrationEnvelopeCutover) {
        runtimeFeatureMetrics.recordForumOrchestrationFallback()
      }
    }
    if (ctx.targetThreadTurn) {
      sources.push({
        kind: 'target_thread_turn',
        text: `${ctx.targetThreadTurn.author_name}：${ctx.targetThreadTurn.body}`,
        priority: 'critical',
        source_id: ctx.targetThreadTurn.id,
      })
    }
    if (ctx.community.description) {
      sources.push({
        kind: 'community_context',
        text: ctx.community.description,
        priority: 'low',
        source_id: ctx.community.id,
      })
    }
    if (ctx.public_scene?.local_intent_block) {
      sources.push({
        kind: 'local_intent',
        text: ctx.public_scene.local_intent_block,
        priority: 'high',
        source_id:
          ctx.public_scene.scene_metadata.local_intent_id
          ?? ctx.public_scene.scene_metadata.selection_id,
      })
    }
    if (ctx.chatContext?.recent_messages.length) {
      sources.push({
        kind: 'room_recent_turns',
        text: ctx.chatContext.recent_messages
          .slice(-8)
          .map((message) => `${message.author_name}：${message.body}`)
          .join('\n'),
        priority: 'critical',
        source_id: `${ctx.event.room_id ?? ctx.community.id}:recent_turns`,
      })
    }
    if (ctx.chat_prompt_variables?.room_public_context_summary) {
      sources.push({
        kind: 'thread_or_scene_continuity',
        text: ctx.chat_prompt_variables.room_public_context_summary,
        priority: 'high',
        source_id: `${ctx.event.room_id ?? ctx.community.id}:public_context`,
      })
    }
    if (ctx.chat_prompt_variables?.local_intent_block) {
      sources.push({
        kind: 'local_intent',
        text: ctx.chat_prompt_variables.local_intent_block,
        priority: 'high',
        source_id: `${ctx.event.room_id ?? ctx.community.id}:local_intent`,
      })
    }
    const roomProgramContext = [
      ctx.chat_prompt_variables?.program_scene,
      ctx.chat_prompt_variables?.current_beat,
      ctx.chat_prompt_variables?.live_hook,
      ctx.chat_prompt_variables?.unresolved_question,
      ctx.chat_prompt_variables?.role_hint,
    ]
      .filter(Boolean)
      .join('\n')
    if (roomProgramContext) {
      sources.push({
        kind: 'room_program_context',
        text: roomProgramContext,
        priority: 'high',
        source_id: `${ctx.event.room_id ?? ctx.community.id}:program_context`,
      })
    }
    if (ctx.surface_media_plan?.current_context_source) {
      sources.push(ctx.surface_media_plan.current_context_source)
    }
    return sources
  }

  private serializeForumRuntimeContext(runtimeContext: NonNullable<ExecutionContext['forum_runtime_context']>): string {
    return [
      '## Forum Runtime Context',
      `post=${runtimeContext.post_id}`,
      runtimeContext.thread_id ? `thread=${runtimeContext.thread_id}` : null,
      `flow_phase=${runtimeContext.post_situation?.flow_phase ?? 'UNKNOWN'}`,
      runtimeContext.foundation_skeleton.post.title
        ? `title=${runtimeContext.foundation_skeleton.post.title}`
        : null,
      runtimeContext.post_situation?.current_tension
        ? `tension=${runtimeContext.post_situation.current_tension}`
        : null,
      runtimeContext.focus_thread?.summary
        ? `focus_summary=${runtimeContext.focus_thread.summary}`
        : null,
      runtimeContext.evidence_window?.turns.length
        ? `evidence_window=${runtimeContext.evidence_window.turns.map((turn) => `${turn.author.display_name}：${turn.body_excerpt}`).join(' | ')}`
        : null,
    ].filter((value): value is string => Boolean(value)).join('\n')
  }

  private buildRequestEnvelope(
    scene: import('./types.js').PromptScene,
    input: {
      currentUserText?: string
    } = {},
  ): PromptRequestEnvelope {
    const currentUserInputTokens = input.currentUserText
      ? Math.max(1, Math.ceil(input.currentUserText.trim().length / 4))
      : 0
    return {
      static_system_tokens: 180,
      route_wrapper_tokens: scene === 'forum_thread' ? 120 : 100,
      tool_tokens: 0,
      current_user_input_tokens: currentUserInputTokens,
      output_reserve: 0,
      model_capability_ref: null,
    }
  }
}

function toThreadMeta(lifecycle: {
  thread_id: string
  thread_state: NonNullable<ExecutionContext['threadMeta']>['thread_state']
  reply_budget: {
    hard_cap_turns: number | null
    remaining_turns: number | null
    limit: number
    remaining: number
  }
  active_route: {
    route_type: 'SPINOFF' | 'AFTERSHOW' | 'PRIVATE' | 'AUDIENCE'
    route_state: string
  } | null
  writeability: NonNullable<ExecutionContext['threadMeta']>['writeability']
}): NonNullable<ExecutionContext['threadMeta']> {
  return {
    thread_id: lifecycle.thread_id,
    thread_state: lifecycle.thread_state,
    reply_budget: lifecycle.reply_budget.hard_cap_turns ?? lifecycle.reply_budget.limit,
    reply_budget_remaining: lifecycle.reply_budget.remaining_turns ?? lifecycle.reply_budget.remaining,
    active_route: lifecycle.active_route
      ? {
          route_type: lifecycle.active_route.route_type,
          route_state: lifecycle.active_route.route_state,
        }
      : null,
    writeability: lifecycle.writeability,
  }
}
