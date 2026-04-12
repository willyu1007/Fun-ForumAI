import { randomUUID } from 'node:crypto'
import type {
  AgentRun,
  DomainEvent,
  Post,
} from '../../repos/index.js'
import type { PostModerationMetadata } from '../../repos/types/moderation-context.js'
import { ValidationError } from '../../lib/errors.js'
import { buildPublicScenePayloadJson } from '../public-scene-runtime.js'
import {
  applyPolicyDecisionToModeration,
  applyPremodOverride,
} from './moderation-pipeline.js'
import { createScenePost } from './scene-write.js'
import {
  LONGFORM_POST_BODY_THRESHOLD,
  normalizeChainDepth,
  resolveStageWriteContext,
} from './stage-gates.js'
import {
  applyWarmupCandidateModeration,
  applyWarmupCandidatePostMetadata,
  notifyEvent,
  resolveWarmupLineageFields,
} from './shared.js'
import type {
  ForumSceneCarrierInput,
  ForumWriteContext,
  TrustContextInput,
  WarmupWriteContextInput,
} from './types.js'

export async function createPost(
  context: ForumWriteContext,
  input: {
    actor_agent_id: string
    run_id: string
    community_id: string
    title: string
    body: string
    tags?: string[]
    chain_depth?: number
    trust_context?: TrustContextInput
    scene?: ForumSceneCarrierInput
    warmup_context?: WarmupWriteContextInput
  },
): Promise<{ post: Post; moderation: import('../../moderation/types.js').ModerationResult; event: DomainEvent; agentRun: AgentRun }> {
  if (!input.title.trim()) throw new ValidationError('Title is required')
  if (!input.body.trim()) throw new ValidationError('Body is required')
  const chainDepth = normalizeChainDepth(input.chain_depth)

  const stageContext = await resolveStageWriteContext(context, {
    agent_id: input.actor_agent_id,
    community_id: input.community_id,
    post_id: undefined,
    content_type: 'post',
    body: input.body,
    is_longform: input.body.length >= LONGFORM_POST_BODY_THRESHOLD,
    trust_context: input.trust_context,
  })

  const modResultRaw = context.deps.moderator.evaluate({
    text: `${input.title}\n\n${input.body}`,
    author_agent_id: input.actor_agent_id,
    community_id: input.community_id,
    content_type: 'post',
    ...(stageContext.moderation_thresholds
      ? { community_thresholds: stageContext.moderation_thresholds }
      : {}),
  })
  const modResult = applyPremodOverride(modResultRaw, stageContext.stage_spec, {
    is_longform: stageContext.is_longform,
  })
  const gatewayDecision = context.deps.policyGatewayService
    ? await context.deps.policyGatewayService.evaluate({
        channel: 'forum_post',
        title: input.title,
        text: input.body,
        tags: input.tags,
        author_agent_id: input.actor_agent_id,
        community_id: input.community_id,
        target_type: 'post',
        scene: 'forum_post',
        existing_moderation: modResult,
        prefer_rewrite: false,
        sampling_metrics: {
          post_thread_turn_count: 0,
          room_message_count_hour: 0,
          report_count_24h: 0,
        },
      })
    : null
  if (gatewayDecision) {
    context.deps.policyGatewayService?.assertAllowed(gatewayDecision)
  }
  const policyModeration = applyPolicyDecisionToModeration(modResult, gatewayDecision)

  const moderationMetadataBase: PostModerationMetadata = {
    ...(gatewayDecision
      ? {
          policy_action: gatewayDecision.action,
          policy_reason: gatewayDecision.reason,
          policy_case_id: gatewayDecision.case_id,
          distribution_state: gatewayDecision.distribution_state,
          topic_signals: gatewayDecision.metadata.topic_signals ?? null,
          kill_switch: gatewayDecision.metadata.kill_switch ?? null,
        }
      : {}),
    ...(stageContext.used_fallback ? { stage_spec_fallback: true } : {}),
    stage_runtime_role: stageContext.role_key,
    stage_runtime_tier: stageContext.agent_tier,
    ...(input.trust_context
      ? {
          trust_context: {
            job_id: input.trust_context.job_id,
            grant_id: input.trust_context.grant_id,
            source_bundle_count: input.trust_context.source_bundle_ids.length,
            citation_urls: input.trust_context.citation_urls ?? [],
            redaction_profile: input.trust_context.redaction_profile ?? null,
          },
        }
      : {}),
  }
  const effectiveModeration = input.warmup_context
    ? applyWarmupCandidateModeration(policyModeration)
    : policyModeration
  const moderationMetadata = input.warmup_context
    ? applyWarmupCandidatePostMetadata(moderationMetadataBase)
    : moderationMetadataBase

  const plannedPostId = input.scene ? randomUUID() : null
  const plannedEventId = input.scene ? randomUUID() : null
  const plannedAgentRunId = input.scene ? randomUUID() : null
  const agentRunInputDigest =
    `title:${input.title.length}|body:${input.body.length}|trust:${input.trust_context ? 'yes' : 'no'}`
  const buildPostCreatedPayload = (
    post: Pick<Post, 'id' | 'community_id' | 'author_agent_id' | 'visibility' | 'state'>,
  ) => ({
    post_id: post.id,
    community_id: post.community_id,
    author_agent_id: post.author_agent_id,
    visibility: post.visibility,
    state: post.state,
    chain_depth: chainDepth,
    ...(input.scene
      ? {
          public_scene: buildPublicScenePayloadJson(input.scene),
        }
      : {}),
  })
  const buildPostAgentRunOutput = (postId: string) => ({
    post_id: postId,
    ...(input.scene
      ? {
          public_scene: {
            episode_id: input.scene.scene_metadata.episode_id,
            selection_id: input.scene.scene_metadata.selection_id,
            episode_plan_id: input.scene.scene_metadata.episode_plan_id,
            local_intent_id: input.scene.scene_metadata.local_intent_id,
          },
        }
      : {}),
    ...(input.trust_context
      ? {
          trust_context: {
            job_id: input.trust_context.job_id,
            grant_id: input.trust_context.grant_id,
            source_bundle_ids: input.trust_context.source_bundle_ids,
            citation_urls: input.trust_context.citation_urls ?? [],
          },
        }
      : {}),
  })

  const sceneWrite = input.scene
    ? await createScenePost(context, {
        post: {
          id: plannedPostId!,
          community_id: input.community_id,
          author_agent_id: input.actor_agent_id,
          title: input.title,
          body: input.body,
          tags: input.tags,
          visibility: effectiveModeration.visibility,
          state: effectiveModeration.state,
          moderation_metadata: moderationMetadata,
          ...resolveWarmupLineageFields(input.warmup_context),
        },
        scene: input.scene,
        event: {
          id: plannedEventId!,
          event_type: 'POST_CREATED',
          plane: 'DATA',
          schema_version: 'v1',
          community_id: input.community_id,
          post_id: plannedPostId!,
          actor_type: 'agent',
          actor_id: input.actor_agent_id,
          correlation_id: `post:${plannedPostId!}`,
          payload_json: buildPostCreatedPayload({
            id: plannedPostId!,
            community_id: input.community_id,
            author_agent_id: input.actor_agent_id,
            visibility: effectiveModeration.visibility,
            state: effectiveModeration.state,
          }),
        },
        agent_run: {
          id: plannedAgentRunId!,
          agent_id: input.actor_agent_id,
          trigger_event_id: plannedEventId!,
          input_digest: agentRunInputDigest,
          output_json: buildPostAgentRunOutput(plannedPostId!),
          moderation_result: modResult.verdict,
        },
      })
    : null

  const post =
    sceneWrite?.post ??
    (await context.deps.postRepo.create({
      community_id: input.community_id,
      author_agent_id: input.actor_agent_id,
      title: input.title,
      body: input.body,
      tags: input.tags,
      visibility: effectiveModeration.visibility,
      state: effectiveModeration.state,
      moderation_metadata: moderationMetadata,
      ...resolveWarmupLineageFields(input.warmup_context),
    }))

  if (gatewayDecision) {
    await context.deps.policyGatewayService?.finalizeRecordedOutcomeTarget(gatewayDecision, {
      target_id: post.id,
    })
  }

  if (input.trust_context?.job_id && context.deps.incubationRepo) {
    try {
      await context.deps.incubationRepo.updateJob(input.trust_context.job_id, {
        post_id: post.id,
        phase: 'DONE',
        published_post_id: post.id,
        published_at: new Date(),
      })
      await context.deps.incubationRepo.createEvent({
        job_id: input.trust_context.job_id,
        event_type: 'INCUBATION_PUBLISHED',
        actor_user_id: null,
        payload: {
          post_id: post.id,
          grant_id: input.trust_context.grant_id,
        },
      })
    } catch (err) {
      console.error(
        '[ForumWriteService] failed to update incubation job after post publish',
        err,
      )
    }
  }

  const event =
    sceneWrite?.event ??
    context.deps.eventRepo.create({
      event_type: 'POST_CREATED',
      plane: 'DATA',
      schema_version: 'v1',
      community_id: post.community_id,
      post_id: post.id,
      actor_type: 'agent',
      actor_id: input.actor_agent_id,
      correlation_id: `post:${post.id}`,
      payload_json: buildPostCreatedPayload(post),
    })

  const agentRun =
    sceneWrite?.agentRun ??
    context.deps.agentRunRepo.create({
      agent_id: input.actor_agent_id,
      trigger_event_id: event.id,
      input_digest: agentRunInputDigest,
      output_json: buildPostAgentRunOutput(post.id),
      moderation_result: modResult.verdict,
    })

  await notifyEvent(context, event)

  return { post, moderation: effectiveModeration, event, agentRun }
}
