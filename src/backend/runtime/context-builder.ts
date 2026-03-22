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
import { resolveAgentIdentity } from '../identity/agent-identity.js'

export interface ContextBuilderDeps {
  forumReadService: ForumReadService
  agentService: AgentService
  promptOrchestrator?: PromptOrchestrator | null
  communityPromptProfileCompiler?: CommunityPromptProfileCompiler | null
  communityCultureDigestService?: CommunityCultureDigestService | null
  forumSceneContinuityService?: ForumSceneContinuityService | null
  chatService?: ChatService | null
  chatroomRuntimeContextBuilder?: ChatroomRuntimeContextBuilder | null
}

const DEFAULT_PERSONA: AgentPersona = {
  name: '匿名智能体',
  style: '中立客观，简洁明了',
  interests: ['通用话题'],
  language: 'zh-CN',
}

export class ContextBuilder {
  constructor(private readonly deps: ContextBuilderDeps) {}

  async build(event: EventPayload, agent: SelectedAgent): Promise<ExecutionContext> {
    const persona = this.loadPersona(agent.agent_id)

    const community = await this.loadCommunity(event.community_id)

    const ctx: ExecutionContext = { event, agent, persona, community }

    if (event.post_id) {
      ctx.post = await this.loadPost(event.post_id)
      ctx.comments = await this.loadComments(event.post_id)
    }

    if (event.event_type === 'NewCommentCreated' && ctx.comments?.length) {
      const targetId = event.comment_id
      if (targetId) {
        ctx.targetComment = ctx.comments.find((c) => c.id === targetId)
      } else {
        ctx.targetComment = ctx.comments[ctx.comments.length - 1]
      }
    }

    if (
      this.deps.forumSceneContinuityService
      && (event.event_type === 'NewPostCreated' || event.event_type === 'NewCommentCreated')
    ) {
      const continuity = await this.deps.forumSceneContinuityService.resolve({
        event,
        post_author_agent_id: ctx.post?.author_agent_id,
        target_comment_author_agent_id: ctx.targetComment?.author_agent_id,
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
      : ctx.targetComment
        ? 'forum_comment'
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
        currentUserText: ctx.targetComment?.body,
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
        : ctx.targetComment
          ? '你正在论坛评论线程中回复具体观点'
          : '你正在论坛帖子下参与公开讨论',
      shortTermState: ctx.chatContext
        ? `recent_messages=${ctx.chatContext.recent_messages.length}`
        : ctx.event.event_type === 'NewMessageCreated'
          ? 'recent_messages=0'
        : ctx.comments
          ? `thread_comments=${ctx.comments.length}`
          : '',
      threadComments: ctx.comments?.map((c) => ({
        id: c.id,
        author_agent_id: c.author_agent_id,
        body: c.body,
      })),
      targetCommentId: ctx.targetComment?.id,
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
    if (ctx.targetComment) {
      const thread = ctx.comments?.map((c) => c.body).join(' ') ?? ''
      return `${thread} ${ctx.targetComment.body}`.trim()
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

  private async loadComments(postId: string): Promise<ExecutionContext['comments']> {
    try {
      const result = await this.deps.forumReadService.getComments(postId, { limit: 20 })
      return result.items.map((c) => ({
        id: c.id,
        body: c.body,
        author_agent_id: c.author_agent_id,
        author_name: this.getAgentName(c.author_agent_id),
      }))
    } catch {
      return []
    }
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

    if (ctx.targetComment) {
      const commentWords = ctx.targetComment.body
        .split(/[\s,，、；;：:。.!！?？]+/)
        .filter((w) => w.length >= 2)
        .slice(0, 3)
      hints.push(...commentWords)
    }

    return [...new Set(hints)].slice(0, 10)
  }

  private buildCurrentContextSources(
    ctx: ExecutionContext,
    scene: import('./types.js').PromptScene,
  ): CurrentContextSource[] {
    const sources: CurrentContextSource[] = []
    if (ctx.post) {
      sources.push({
        kind: 'post_body',
        text: [`标题：${ctx.post.title}`, `正文：${ctx.post.body}`].join('\n'),
        priority: 'critical',
        source_id: ctx.post.id,
      })
    }
    if (ctx.comments?.length) {
      sources.push({
        kind: 'thread_excerpt',
        text: ctx.comments
          .slice(-6)
          .map((comment) => `${comment.author_name}：${comment.body}`)
          .join('\n'),
        priority: scene === 'forum_comment' ? 'high' : 'medium',
        source_id: ctx.post?.id,
      })
    }
    if (ctx.targetComment) {
      sources.push({
        kind: 'target_comment',
        text: `${ctx.targetComment.author_name}：${ctx.targetComment.body}`,
        priority: 'critical',
        source_id: ctx.targetComment.id,
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
      route_wrapper_tokens: scene === 'forum_comment' ? 120 : 100,
      tool_tokens: 0,
      current_user_input_tokens: currentUserInputTokens,
      output_reserve: 0,
      model_capability_ref: null,
    }
  }
}
