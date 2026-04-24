import type { ForumReadService, PublicStageThreadWithAuthor } from '../services/forum-read-service.js'
import type { AgentService } from '../services/agent-service.js'
import type { PromptOrchestrator } from './prompt-orchestrator.js'
import type { EventPayload, SelectedAgent } from '../allocator/types.js'
import type {
  AgentPersona,
  CurrentContextSource,
  ExecutionContext,
  ExecutionContextThreadEntry,
  ForumTargetingContext,
  PromptRequestEnvelope,
  ResolvedForumExecutionPlan,
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

interface RuntimePreviewBuilder {
  buildRuntimeContextPreview?: (
    input: {
      post_id: string
      thread_id?: string | null
      focus_turn_id?: string | null
      agent_id?: string | null
    },
  ) => Promise<{
    post_capsule: ExecutionContext['semantic_post_capsule']
    thread_capsule: ExecutionContext['semantic_thread_capsule']
    forest: ExecutionContext['discussion_forest']
    perceived_slice: ExecutionContext['perceived_context_slice']
    runtime_context: ExecutionContext['forum_runtime_context']
    orchestration_policy: ExecutionContext['forum_orchestration_policy']
  }>
  buildRuntimeContextPreviewInternal?: (
    input: {
      post_id: string
      thread_id?: string | null
      focus_turn_id?: string | null
      agent_id?: string | null
    },
  ) => Promise<{
    post_capsule: ExecutionContext['semantic_post_capsule']
    thread_capsule: ExecutionContext['semantic_thread_capsule']
    forest: ExecutionContext['discussion_forest']
    perceived_slice: ExecutionContext['perceived_context_slice']
    runtime_context: ExecutionContext['forum_runtime_context']
    orchestration_policy: ExecutionContext['forum_orchestration_policy']
  }>
}

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

    if (
      !ctx.skip_reason
      && this.deps.forumSceneContinuityService
      && (
        event.event_type === 'NewPostCreated'
        || event.event_type === 'ThreadOpened'
        || event.event_type === 'ThreadTurnAdded'
      )
    ) {
      const eventTargetEntry = this.resolveEventTargetEntry(ctx)
      const targetThreadAuthorAgentId = eventTargetEntry?.entry_kind === 'THREAD'
        ? eventTargetEntry.author_agent_id ?? undefined
        : undefined
      const targetTurnAuthorAgentId = eventTargetEntry?.entry_kind === 'TURN'
        ? eventTargetEntry.author_agent_id ?? undefined
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

    const runtimePreviewBuilder = this.deps.forumReadService as unknown as RuntimePreviewBuilder

    if (event.post_id) {
      try {
        const preview = await this.invokeRuntimePreviewBuilder(runtimePreviewBuilder, {
          post_id: event.post_id,
          thread_id: event.thread_id ?? null,
          focus_turn_id: agent.selected_anchor_turn_id ?? event.turn_id ?? null,
          agent_id: agent.agent_id,
        })
        this.applyForumRuntimePreview(ctx, preview)
      } catch (error) {
        console.error(
          `[ContextBuilder] forum semantic context build failed for post=${event.post_id} thread=${event.thread_id ?? 'none'} agent=${agent.agent_id}:`,
          error,
        )
      }
    }

    this.finalizeForumTargeting(ctx)

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
    const promptFocusEntry = this.getPromptFocusEntry(ctx)
    const scene: import('./types.js').PromptScene = ctx.event.event_type === 'NewMessageCreated'
      ? 'chat_room'
      : ctx.chatContext
      ? 'chat_room'
      : promptFocusEntry
        ? 'forum_thread'
        : 'forum_post'
    ctx.promptScene = scene
    const conversationText = this.composeConversationText(ctx)
    const topicHints = this.extractTopicHints(ctx)

    if (!this.deps.promptOrchestrator?.isSceneEnabled(scene)) {
      throw new Error(`PromptOrchestrator unavailable for scene ${scene}`)
    }

    const communityProfile = config.launch.capabilities.communityPromptProfileV1
      ? ctx.community.prompt_profile
      : undefined
    const communityHardRule = communityProfile?.hard_rules_text || ctx.community.rules
    const communitySoftCulture = communityProfile?.soft_culture_text || ctx.community.description

    let composed
    try {
      composed = await this.deps.promptOrchestrator.compose({
        agentId: ctx.agent.agent_id,
        scene,
        conversationText,
        communityId: ctx.community.id,
        topicHints,
        currentContextSources: this.buildCurrentContextSources(ctx, scene),
        requestEnvelope: this.buildRequestEnvelope(scene, {
          currentUserText: promptFocusEntry?.body,
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
          : promptFocusEntry
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
        focusThreadTurnId: promptFocusEntry?.id,
      })
    } catch (error) {
      throw error
    }
    ctx.persona = composed.persona
    ctx.blocks = composed.blocks
    ctx.runtimeEnvelope = composed.runtimeEnvelope ?? null
    ctx.prompt_audit = composed.audit
    return ctx
  }

  async retargetForumThreadContext(
    ctx: ExecutionContext,
    plan: ResolvedForumExecutionPlan,
  ): Promise<ExecutionContext> {
    if (!ctx.post || !isForumThreadEvent(ctx.event)) {
      return ctx
    }

    const next: ExecutionContext = {
      ...ctx,
      agent: {
        ...ctx.agent,
        selected_anchor_turn_id: plan.context_focus_turn_id ?? ctx.agent.selected_anchor_turn_id ?? null,
      },
      focusThreadTurn: undefined,
      forum_targeting: undefined,
      blocks: undefined,
      prompt_audit: undefined,
      runtimeEnvelope: undefined,
    }

    const targetThreadId = plan.context_thread_id
    next.threadTurns = targetThreadId
      ? await this.loadThreadTurns(ctx.post.id, targetThreadId)
      : []
    next.threadMeta = targetThreadId
      ? await this.loadThreadMeta(targetThreadId)
      : undefined

    const runtimePreviewBuilder = this.deps.forumReadService as unknown as RuntimePreviewBuilder

    if (typeof runtimePreviewBuilder.buildRuntimeContextPreviewInternal === 'function'
      || typeof runtimePreviewBuilder.buildRuntimeContextPreview === 'function') {
      try {
        const preview = await this.invokeRuntimePreviewBuilder(runtimePreviewBuilder, {
          post_id: ctx.post.id,
          thread_id: targetThreadId,
          focus_turn_id: plan.context_focus_turn_id,
          agent_id: ctx.agent.agent_id,
        })
        this.applyForumRuntimePreview(next, preview)
      } catch (error) {
        console.error(
          `[ContextBuilder] forum retarget preview build failed for post=${ctx.post.id} thread=${targetThreadId ?? 'none'} agent=${ctx.agent.agent_id}:`,
          error,
        )
      }
    }

    this.finalizeForumTargeting(next)
    return next
  }

  private composeConversationText(ctx: ExecutionContext): string {
    const promptFocusEntry = this.getPromptFocusEntry(ctx)
    if (ctx.chatContext?.recent_messages?.length) {
      return ctx.chatContext.recent_messages.map((m) => m.body).join(' ')
    }
    if (promptFocusEntry) {
      const thread = ctx.threadTurns?.map((entry) => entry.body).join(' ') ?? ''
      return `${thread} ${promptFocusEntry.body}`.trim()
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
        ...(config.launch.capabilities.communityPromptProfileV1 && this.deps.communityPromptProfileCompiler
          ? {
              prompt_profile: this.deps.communityPromptProfileCompiler.compile({
                communityDescription: c.description,
                rulesJson: c.rules_json,
                cultureDigest: config.launch.capabilities.communityDigestV1 && this.deps.communityCultureDigestService
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
      const runtimeReadService = this.deps.forumReadService as unknown as {
        getRuntimePost?: (postId: string) => Promise<{
          id: string
          title: string
          body: string
          author_agent_id: string
        }>
      }
      if (typeof runtimeReadService.getRuntimePost !== 'function') {
        return undefined
      }
      try {
        const post = await runtimeReadService.getRuntimePost(postId)
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
  }

  private async loadThreadTurns(postId: string, threadId?: string): Promise<ExecutionContext['threadTurns']> {
    try {
      if (threadId) {
        const thread = await this.deps.forumReadService.getThread(threadId)
        return this.flattenThreadTurns([thread])
      }
      const forest = await this.deps.forumReadService.getDiscussionForest(postId)
      return this.flattenDiscussionForestNodes(forest)
    } catch {
      if (threadId) {
        const runtimeReadService = this.deps.forumReadService as unknown as {
          getRuntimeThread?: (threadId: string) => Promise<PublicStageThreadWithAuthor>
        }
        if (typeof runtimeReadService.getRuntimeThread === 'function') {
          try {
            const thread = await runtimeReadService.getRuntimeThread(threadId)
            return this.flattenThreadTurns([thread])
          } catch {
            return []
          }
        }
      }
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

  private async invokeRuntimePreviewBuilder(
    builder: RuntimePreviewBuilder,
    input: {
      post_id: string
      thread_id?: string | null
      focus_turn_id?: string | null
      agent_id?: string | null
    },
  ): Promise<{
    post_capsule: ExecutionContext['semantic_post_capsule']
    thread_capsule: ExecutionContext['semantic_thread_capsule']
    forest: ExecutionContext['discussion_forest']
    perceived_slice: ExecutionContext['perceived_context_slice']
    runtime_context: ExecutionContext['forum_runtime_context']
    orchestration_policy: ExecutionContext['forum_orchestration_policy']
  }> {
    if (typeof builder.buildRuntimeContextPreviewInternal === 'function') {
      return builder.buildRuntimeContextPreviewInternal.call(builder, input)
    }
    if (typeof builder.buildRuntimeContextPreview === 'function') {
      return builder.buildRuntimeContextPreview.call(builder, input)
    }
    throw new Error('Runtime preview builder is unavailable')
  }

  private finalizeForumTargeting(ctx: ExecutionContext): void {
    if (!isForumThreadEvent(ctx.event)) {
      return
    }

    const eventTargetEntry = this.resolveEventTargetEntry(ctx)
    const focusTurnId = ctx.perceived_context_slice?.focus_turn_id
      ?? eventTargetEntry?.id
      ?? null
    ctx.focusThreadTurn = this.resolveThreadEntryById(ctx.threadTurns, focusTurnId) ?? eventTargetEntry
    ctx.forum_targeting = this.buildForumTargetingContext(ctx, eventTargetEntry)
  }

  private buildForumTargetingContext(
    ctx: ExecutionContext,
    eventTargetEntry?: ExecutionContextThreadEntry,
  ): ForumTargetingContext {
    const eventTargetEntryId = ctx.event.turn_id
      ?? ctx.event.thread_id
      ?? eventTargetEntry?.id
      ?? null
    const eventTargetThreadId = ctx.event.thread_id
      ?? (eventTargetEntry?.entry_kind === 'THREAD'
        ? eventTargetEntry.id
        : eventTargetEntry?.thread_id ?? null)
    const focusTurnId = ctx.perceived_context_slice?.focus_turn_id
      ?? ctx.agent.forum_attention_hint?.selected_anchor_turn_id
      ?? ctx.focusThreadTurn?.id
      ?? null
    const focusEntry = this.resolveThreadEntryById(ctx.threadTurns, focusTurnId)
      ?? ctx.focusThreadTurn
      ?? eventTargetEntry
    const selectedAnchorTurnId = this.normalizeAnchorTurnId(
      ctx,
      ctx.perceived_context_slice?.selected_anchor_turn_id ?? null,
    )
    const actualAnchorTurnId = this.normalizeAnchorTurnId(
      ctx,
      ctx.perceived_context_slice?.actual_anchor_turn_id ?? null,
    )
    const fallbackFocusAnchorTurnId = focusEntry?.entry_kind === 'TURN'
      ? focusEntry.id
      : null

    return {
      event_target_entry_id: eventTargetEntryId,
      event_target_thread_id: eventTargetThreadId,
      focus_turn_id: focusTurnId,
      selected_anchor_turn_id: selectedAnchorTurnId,
      actual_anchor_turn_id: actualAnchorTurnId,
      final_write_anchor_turn_id:
        actualAnchorTurnId
        ?? selectedAnchorTurnId
        ?? fallbackFocusAnchorTurnId,
      reply_thread_id: ctx.forum_runtime_context?.thread_id
        ?? ctx.perceived_context_slice?.thread_id
        ?? ctx.agent.forum_attention_hint?.target_thread_id
        ?? ctx.semantic_thread_capsule?.thread_id
        ?? ctx.event.thread_id
        ?? null,
      browse_reason:
        ctx.perceived_context_slice?.browse_reason
        ?? ctx.agent.forum_attention_hint?.browse_reason
        ?? null,
      allowed_actions: ctx.perceived_context_slice?.allowed_actions ?? [],
    }
  }

  private resolveThreadEntryById(
    threadTurns: ExecutionContext['threadTurns'],
    entryId: string | null | undefined,
  ): ExecutionContextThreadEntry | undefined {
    if (!threadTurns || !entryId) {
      return undefined
    }
    return threadTurns.find((entry) => entry.id === entryId)
  }

  private applyForumRuntimePreview(
    ctx: ExecutionContext,
    preview: {
      post_capsule: ExecutionContext['semantic_post_capsule']
      thread_capsule: ExecutionContext['semantic_thread_capsule']
      forest: ExecutionContext['discussion_forest']
      perceived_slice: ExecutionContext['perceived_context_slice']
      runtime_context: ExecutionContext['forum_runtime_context']
      orchestration_policy: ExecutionContext['forum_orchestration_policy']
    },
  ): void {
    ctx.semantic_post_capsule = preview.post_capsule ?? null
    ctx.semantic_thread_capsule = preview.thread_capsule ?? null
    ctx.discussion_forest = preview.forest ?? null
    ctx.perceived_context_slice = preview.perceived_slice ?? null
    ctx.forum_runtime_context = preview.runtime_context ?? null
    ctx.forum_orchestration_policy = preview.orchestration_policy ?? null

    if (preview.perceived_slice && ctx.threadTurns?.length) {
      const visibleIds = new Set(preview.perceived_slice.visible_node_ids)
      const filtered = ctx.threadTurns.filter((item) => visibleIds.has(item.id))
      if (filtered.length > 0) {
        ctx.threadTurns = filtered
      }
    }
  }

  private resolveEventTargetEntry(ctx: ExecutionContext): ExecutionContextThreadEntry | undefined {
    if (!isForumThreadEvent(ctx.event)) {
      return undefined
    }

    const targetEntryId = ctx.event.turn_id ?? ctx.event.thread_id
    return this.resolveThreadEntryById(ctx.threadTurns, targetEntryId)
      ?? ctx.threadTurns?.at(-1)
  }

  private normalizeAnchorTurnId(
    ctx: ExecutionContext,
    entryId: string | null | undefined,
  ): string | null {
    const entry = this.resolveThreadEntryById(ctx.threadTurns, entryId)
    if (!entryId) {
      return null
    }
    return (entry?.entry_kind === 'TURN' ? entry.id : null)
      ?? (this.isKnownThreadId(ctx, entryId) ? null : entryId)
  }

  private isKnownThreadId(ctx: ExecutionContext, entryId: string): boolean {
    return entryId === (ctx.event.thread_id ?? null)
      || entryId === (ctx.forum_runtime_context?.thread_id ?? null)
      || entryId === (ctx.perceived_context_slice?.thread_id ?? null)
      || entryId === (ctx.semantic_thread_capsule?.thread_id ?? null)
      || ctx.threadTurns?.some((entry) => entry.entry_kind === 'THREAD' && entry.id === entryId)
      || false
  }

  private getPromptFocusEntry(ctx: ExecutionContext): ExecutionContextThreadEntry | undefined {
    return ctx.focusThreadTurn
  }

  private resolveThreadSkipReason(
    threadMeta: ExecutionContext['threadMeta'] | undefined,
  ): string | null {
    if (!threadMeta?.writeability || threadMeta.writeability.reply_allowed) {
      return null
    }

    if (threadMeta.writeability.preferred_action !== 'READ_ONLY') {
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
      author_actor_type: 'agent' | 'human'
      author_agent_id: string | null
      author_user_id: string | null
      author: { id: string; display_name: string }
      turns: Array<{
        id: string
        post_id: string
        thread_id: string
        anchor_turn_id: string | null
        turn_index: number
        body: string
        author_actor_type: 'agent' | 'human'
        author_agent_id: string | null
        author_user_id: string | null
        author: { id: string; display_name: string }
      }>
    }>,
  ): ExecutionContext['threadTurns'] {
    return threads.flatMap((thread) => {
      const root = {
        id: thread.id,
        post_id: thread.post_id,
        thread_id: thread.id,
        entry_kind: 'THREAD' as const,
        anchor_turn_id: null,
        author_actor_type: thread.author_actor_type,
        body: thread.body,
        author_agent_id: thread.author_agent_id,
        author_user_id: thread.author_user_id,
        author_name: thread.author.display_name,
      }
      const turns = thread.turns.map((turn) => ({
        id: turn.id,
        post_id: turn.post_id,
        thread_id: turn.thread_id,
        entry_kind: 'TURN' as const,
        anchor_turn_id: turn.anchor_turn_id ?? null,
        turn_index: turn.turn_index,
        author_actor_type: turn.author_actor_type,
        body: turn.body,
        author_agent_id: turn.author_agent_id,
        author_user_id: turn.author_user_id,
        author_name: turn.author.display_name,
      }))
      return [root, ...turns]
    })
  }

  private flattenDiscussionForestNodes(
    forest: NonNullable<ExecutionContext['discussion_forest']>,
  ): ExecutionContext['threadTurns'] {
    return forest.nodes.map((node) => ({
      id: node.id,
      post_id: node.post_id,
      thread_id: node.thread_id,
      entry_kind: node.entry_kind,
      anchor_turn_id: node.actual_anchor_turn_id,
      body: node.body,
      author_actor_type: node.author.actor_type,
      author_agent_id: node.author.actor_type === 'agent' ? node.author.id : null,
      author_user_id: node.author.actor_type === 'human' ? node.author.id : null,
      author_name: node.author.display_name,
    }))
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
    const promptFocusEntry = this.getPromptFocusEntry(ctx)

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

    if (promptFocusEntry) {
      const entryWords = promptFocusEntry.body
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
    const promptFocusEntry = this.getPromptFocusEntry(ctx)
    const resolvedExecutionPlan = ctx.forum_roaming?.resolved_execution_plan ?? null
    const chosenCandidate = resolvedExecutionPlan?.candidate_id
      ? ctx.forum_roaming?.arrival_candidates.find((item) => item.candidate_id === resolvedExecutionPlan.candidate_id) ?? null
      : null
    const hasForumRuntimeContext = Boolean(
      config.launch.capabilities.forumOrchestrationEnvelopeCutover
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
      const text = this.serializeForumRuntimeContext(
        ctx.forum_runtime_context,
        ctx.forum_targeting,
        resolvedExecutionPlan,
      )
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
      if (config.launch.capabilities.forumOrchestrationEnvelopeCutover) {
        runtimeFeatureMetrics.recordForumBaselineFallback({
          stage: 'context_builder',
          selection_path: ctx.agent.forum_attention_hint?.selection_path ?? 'legacy_baseline',
          fallback_reason: 'runtime_context_preview_fallback',
          count_selection_path: false,
          event_type: ctx.event.event_type,
          post_id: ctx.event.post_id ?? null,
          thread_id: ctx.event.thread_id ?? null,
          agent_id: ctx.agent.agent_id,
          opportunity_id: ctx.agent.forum_attention_hint?.opportunity_id ?? null,
        })
      }
    }
    if (chosenCandidate?.local_evidence.length) {
      sources.push({
        kind: 'roaming_local_evidence',
        text: chosenCandidate.local_evidence.join('\n'),
        priority: 'high',
        source_id: chosenCandidate.candidate_id,
      })
    }
    if (promptFocusEntry) {
      sources.push({
        kind: 'focus_thread_turn',
        text: `${promptFocusEntry.author_name}：${promptFocusEntry.body}`,
        priority: scene === 'forum_thread' ? 'high' : 'medium',
        source_id: promptFocusEntry.id,
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

  private serializeForumRuntimeContext(
    runtimeContext: NonNullable<ExecutionContext['forum_runtime_context']>,
    forumTargeting?: ForumTargetingContext,
    resolvedExecutionPlan?: ResolvedForumExecutionPlan | null,
  ): string {
    const routeSnapshot = runtimeContext.foundation_skeleton.route_snapshot
    const writeability = runtimeContext.focus_thread?.lifecycle.writeability
    return [
      '## Forum Runtime Context',
      `post=${runtimeContext.post_id}`,
      runtimeContext.thread_id ? `thread=${runtimeContext.thread_id}` : null,
      `flow_phase=${runtimeContext.post_situation?.flow_phase ?? 'UNKNOWN'}`,
      forumTargeting?.browse_reason ? `browse_reason=${forumTargeting.browse_reason}` : null,
      forumTargeting?.event_target_entry_id ? `event_target=${forumTargeting.event_target_entry_id}` : null,
      forumTargeting?.focus_turn_id ? `focus_turn=${forumTargeting.focus_turn_id}` : null,
      forumTargeting?.selected_anchor_turn_id ? `selected_anchor=${forumTargeting.selected_anchor_turn_id}` : null,
      forumTargeting?.actual_anchor_turn_id ? `actual_anchor=${forumTargeting.actual_anchor_turn_id}` : null,
      forumTargeting?.final_write_anchor_turn_id ? `final_write_anchor=${forumTargeting.final_write_anchor_turn_id}` : null,
      forumTargeting?.allowed_actions.length ? `allowed_actions=${forumTargeting.allowed_actions.join('|')}` : null,
      resolvedExecutionPlan?.decision_action
        ? `roaming_action=${resolvedExecutionPlan.decision_action}`
        : null,
      resolvedExecutionPlan?.write_action
        ? `frozen_write_action=${resolvedExecutionPlan.write_action}`
        : null,
      resolvedExecutionPlan?.write_thread_id
        ? `frozen_write_thread=${resolvedExecutionPlan.write_thread_id}`
        : null,
      resolvedExecutionPlan?.write_anchor_turn_id
        ? `frozen_write_anchor=${resolvedExecutionPlan.write_anchor_turn_id}`
        : null,
      writeability
        ? `writeability=${writeability.reply_mode}:${writeability.preferred_action}:${writeability.reason_code}`
        : null,
      routeSnapshot ? `route_snapshot=${routeSnapshot.route_type}:${routeSnapshot.route_state}` : null,
      runtimeContext.foundation_skeleton.post.title
        ? `title=${runtimeContext.foundation_skeleton.post.title}`
        : null,
      runtimeContext.post_situation?.current_tension
        ? `tension=${runtimeContext.post_situation.current_tension}`
        : null,
      runtimeContext.focus_thread?.summary
        ? `focus_summary=${runtimeContext.focus_thread.summary}`
        : null,
      runtimeContext.evidence_window?.anchor_turn_id
        ? `evidence_anchor=${runtimeContext.evidence_window.anchor_turn_id}`
        : null,
      runtimeContext.evidence_window?.window_strategy
        ? `evidence_window_strategy=${runtimeContext.evidence_window.window_strategy}`
        : null,
      runtimeContext.perceived_slice?.visible_node_ids.length
        ? `visible_scope=${runtimeContext.perceived_slice.visible_node_ids.join('|')}`
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

function isForumThreadEvent(event: ExecutionContext['event']): boolean {
  return event.event_type === 'ThreadOpened' || event.event_type === 'ThreadTurnAdded'
}
