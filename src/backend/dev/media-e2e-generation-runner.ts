import { Buffer } from 'node:buffer'
import {
  agentCommunityMembershipService,
  agentService,
  authService,
  communityRepo,
  forumReadService,
  forumWriteService,
  imagePlannerService,
  inclinationAssetService,
  mediaGenerationService,
  mediaWriteBridge,
  riskGovernanceRepo,
  visualDirectiveService,
} from '../container.js'
import { buildLocalIntentBlock, type PublicSceneWritePayload } from '../services/public-scene-runtime.js'

const OWNER_ID = 'dev-user-001'
const OWNER_EMAIL = 'dev-user@llm-forum.test'
const SAMPLE_COMMUNITY_SLUG = 'general'
const SAMPLE_COMMUNITY_NAME = '自由讨论'
const TEST_VISIBLE_MODEL_ID = 'qwen-flash-character'
const SAMPLE_REFERENCE_IMAGE_BASE64 =
  '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'

const SOURCE_ORDER = [
  'self_public_archive',
  'same_episode_public',
  'private_derived_public',
  'generated_public',
  'same_thread_public',
  'owner_private_pool',
  'private_runtime_projection',
  'community_commons',
  'platform_canonical',
] as const

export type MediaE2eGenerationMode = 'scratch' | 'reference'

export interface MediaE2eGenerationResult {
  mode: MediaE2eGenerationMode
  agent_id: string
  community_id: string
  directive_id: string
  image_plan_id: string
  decision: string
  generation_status: string
  generation_input_mode: string | null
  generation_output_asset_id: string | null
  source_asset_id: string | null
  source_asset_visibility_policy: string | null
  post_id: string
  post_path: string
  post_media_asset_ids: string[]
  post_media_count: number
}

export interface MediaE2eGenerationOptions {
  agentDisplayName?: string
  postTitle?: string
  postBody?: string
  tags?: string[]
}

async function ensureOwnerIdentity(): Promise<void> {
  await authService?.ensureDevIdentity({
    userId: OWNER_ID,
    email: OWNER_EMAIL,
    role: 'user',
  })
  await riskGovernanceRepo.upsertIdentityVerification({
    user_id: OWNER_ID,
    status: 'VERIFIED',
    reviewed_by_user_id: 'media-e2e-seed',
    reason: 'Media E2E generation runner bootstrap',
    method: 'MANUAL_REVIEW',
    reviewed_at: new Date(),
    meta: {
      source: 'media-e2e-generation-runner',
      context: 'k8s-browser-e2e',
    },
  })
}

async function ensureCommunity() {
  const existing = communityRepo.findBySlug(SAMPLE_COMMUNITY_SLUG)
  if (existing) return existing
  if (communityRepo.createPersisted) {
    return communityRepo.createPersisted({
      name: SAMPLE_COMMUNITY_NAME,
      slug: SAMPLE_COMMUNITY_SLUG,
      description: 'Media E2E fallback community',
    })
  }
  return communityRepo.create({
    name: SAMPLE_COMMUNITY_NAME,
    slug: SAMPLE_COMMUNITY_SLUG,
    description: 'Media E2E fallback community',
  })
}

async function createAgentForMode(
  mode: MediaE2eGenerationMode,
  options: MediaE2eGenerationOptions,
) {
  return agentService.createAgentPersisted({
    owner_id: OWNER_ID,
    display_name: options.agentDisplayName?.trim() || `Media E2E ${mode} ${Date.now()}`,
    model: TEST_VISIBLE_MODEL_ID,
    persona_seed_code: 'scholar',
    owner_style_pins: {
      verbosity: 3,
      mood: 'optimistic',
      habits: ['summarizes', 'uses_analogies'],
      interests: ['视觉语义', '图片生成', '系统验证'],
    },
  })
}

async function ensureMembership(agentId: string, communityId: string): Promise<void> {
  await agentCommunityMembershipService.patchMemberships({
    agent_id: agentId,
    add: [communityId],
    remove: [],
    role: 'resident',
    actor_user_id: OWNER_ID,
  })
}

function buildPayload(input: {
  communityId: string
  agentId: string
  mode: MediaE2eGenerationMode
  directiveId?: string
  imagePlanId?: string
  runtimeCardIds?: string[]
}): PublicSceneWritePayload {
  const requestId = `media-e2e-${input.mode}-${Date.now()}`
  const payload: PublicSceneWritePayload = {
    scene_metadata: {
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      scene_template_id: 'media-e2e-template',
      scene_template_version: 'v1',
      scene_binding_id: `media-e2e-binding-${input.mode}`,
      overlay_id: null,
      episode_id: `media-e2e-episode-${input.mode}`,
      beat_id: null,
      phase: 'opening',
      selection_mode: 'pool_guided',
      selection_id: requestId,
      episode_plan_id: `media-e2e-plan-${input.mode}`,
      local_intent_id: `media-e2e-intent-${input.mode}`,
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    episode_brief: {
      episode_id: `media-e2e-episode-${input.mode}`,
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      template_id: 'media-e2e-template',
      template_version: 'v1',
      binding_id: `media-e2e-binding-${input.mode}`,
      phase: 'opening',
      scene_goal: {
        viewer_goal: input.mode === 'scratch'
          ? '生成一张能够支撑公共讨论的原创视觉'
          : '基于私域图片生成适合公开浏览的衍生视觉',
        growth_goal: '验证媒体规划、文生图与读侧挂图闭环',
      },
      casting_directive: {
        must_have_roles: [],
        avoid_pairs: [],
        core_quota: 2,
        contrast_quota: 1,
        wildcard_quota: 0,
      },
      open_loops: [],
      must_hit_points: [],
      avoid_repeat: [],
      close_condition: {
        ttl_hours: 24,
        message_threshold: 12,
        objective: '验证媒体系统闭环',
      },
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    local_intent: {
      intent_id: `media-e2e-intent-${input.mode}`,
      delivery_surface: 'forum_post',
      initiative: 'open_topic',
      opinion_policy: 'free_opinion',
      relation_focus: 'none',
      tone_hint: 'neutral',
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'seed_only',
      prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
      target_ref: { kind: 'none' },
      hard_constraints: ['不得泄露私聊原文', '必须输出适合公开浏览的图片'],
      soft_constraints: [
        '强调图片与文本主题的一致性',
        input.mode === 'scratch' ? '优先原创画面而不是复用现有素材' : '明确这是从私域素材衍生而非直接公开原图',
      ],
    },
    local_intent_block: '',
    selection_audit: {
      community_id: input.communityId,
      agent_id: input.agentId,
      mode: input.mode,
    },
    planning_audit: {
      agent_id: input.agentId,
      mode: input.mode,
    },
    visual_ref: input.directiveId && input.imagePlanId
      ? {
          directive_id: input.directiveId,
          image_plan_id: input.imagePlanId,
          runtime_card_ids: input.runtimeCardIds ?? [],
        }
      : null,
  }
  payload.local_intent_block = buildLocalIntentBlock(payload.local_intent, payload.episode_brief)
  return payload
}

async function maybeCreateReferenceAsset(agentId: string): Promise<{ asset_id: string; visibility_policy: string }> {
  const upload = await inclinationAssetService.createFromUpload({
    agent_id: agentId,
    owner_user_id: OWNER_ID,
    owner_note: '这是一张只允许衍生公开展示、不可直接公开原图的参考图片。',
    original_name: 'media-e2e-reference.png',
    mime_type: 'image/png',
    bytes: Buffer.from(SAMPLE_REFERENCE_IMAGE_BASE64, 'base64'),
  })
  const current = await inclinationAssetService.getCurrent(agentId, OWNER_ID)
  if (!current.pool.latest_asset || current.pool.latest_asset.asset_id !== upload.asset_id) {
    throw new Error('reference asset was not written into the owner private pool')
  }
  return {
    asset_id: upload.asset_id,
    visibility_policy: upload.visibility_policy,
  }
}

export async function runMediaE2eGeneration(
  mode: MediaE2eGenerationMode,
  options: MediaE2eGenerationOptions = {},
): Promise<MediaE2eGenerationResult> {
  await ensureOwnerIdentity()
  const community = await ensureCommunity()
  const agent = await createAgentForMode(mode, options)
  await ensureMembership(agent.id, community.id)

  const sourceAsset = mode === 'reference'
    ? await maybeCreateReferenceAsset(agent.id)
    : null

  const payload = buildPayload({
    communityId: community.id,
    agentId: agent.id,
    mode,
  })

  const directive = await visualDirectiveService.createDirective({
    scene_ref: {
      request_id: payload.scene_metadata.selection_id,
      director_surface: payload.scene_metadata.director_surface,
      actor_surface: 'forum_post',
      thread_root_ref: null,
      community_id: community.id,
      episode_id: payload.scene_metadata.episode_id,
      selection_id: payload.scene_metadata.selection_id,
      episode_plan_id: payload.scene_metadata.episode_plan_id,
      local_intent_id: payload.scene_metadata.local_intent_id,
      phase: payload.scene_metadata.phase,
      selection_mode: payload.scene_metadata.selection_mode,
    },
    goal: {
      need_image: 'required',
      visual_role: 'scene_establishing',
      human_goal: 'engagement',
      runtime_influence: 'medium',
      display_priority: 'primary',
    },
    narrative_context: {
      hook: payload.episode_brief.scene_goal.viewer_goal,
      objective: payload.episode_brief.scene_goal.growth_goal,
      tone_hint: 'neutral',
      relation_focus: 'none',
      semantic_query: [
        payload.episode_brief.scene_goal.viewer_goal,
        payload.episode_brief.scene_goal.growth_goal,
        `mode=${mode}`,
      ].join(' | '),
      required_elements: [
        '图片必须支持公开阅读体验',
        mode === 'scratch' ? '生成一张原创图片' : '基于私域图片语义生成公开衍生图',
      ],
      forbidden_elements: ['owner_private_speech', 'private_memory', 'hidden_director_goal', 'direct quote from private chat'],
      style_hint: mode === 'scratch' ? 'editorial_illustration' : 'derived_public_safe',
      aspect_ratio_hint: '4:5',
    },
    sourcing_policy: {
      allow_sources: [...SOURCE_ORDER],
      prefer_order: [...SOURCE_ORDER],
      allow_private_runtime_projection: true,
      allow_private_inspired_generation: true,
      allow_cross_agent_public: false,
      allow_generation: true,
      max_display_assets: 1,
    },
    guardrails: {
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'seed_only',
      display_policy: 'original_allowed',
      mention_policy: 'allude',
      text_in_image: 'avoid',
    },
    budget: {
      generation_tier: 'medium',
      sync_generation_ms_budget: 120_000,
      async_generation_allowed: true,
      max_generation_attempts: 2,
    },
    audit: {
      director_reason: `media-e2e:${mode}`,
      hard_constraints: payload.local_intent.hard_constraints,
      soft_constraints: payload.local_intent.soft_constraints,
    },
  })

  const planned = await imagePlannerService.planWithDirective({
    agent_id: agent.id,
    directive,
  })
  if (planned.status !== 'pending_generation') {
    throw new Error(`expected pending_generation plan, got status=${planned.status} decision=${planned.decision}`)
  }
  if (mode === 'scratch' && planned.decision !== 'generate_from_scratch') {
    throw new Error(`expected scratch generation decision, got ${planned.decision}`)
  }
  if (mode === 'reference' && planned.decision !== 'generate_from_private_projection') {
    throw new Error(`expected private reference generation decision, got ${planned.decision}`)
  }

  const finalPlan = await mediaGenerationService.ensurePlanReadyWithinBudget({
    agent_id: agent.id,
    plan: planned,
    wait_budget_ms: 180_000,
  })
  if (finalPlan.generation.status !== 'succeeded' || !finalPlan.generation.output_asset_id) {
    throw new Error(`generation did not succeed: status=${finalPlan.generation.status}`)
  }
  if (finalPlan.display.attachments.length === 0) {
    throw new Error('generation succeeded but no display attachment was written back to the plan')
  }

  const postPayload = buildPayload({
    communityId: community.id,
    agentId: agent.id,
    mode,
    directiveId: directive.id,
    imagePlanId: finalPlan.id,
    runtimeCardIds: finalPlan.runtime.cards.map((item) => item.card_id),
  })
  const created = await forumWriteService.createPost({
    actor_agent_id: agent.id,
    run_id: `media-e2e-${mode}-${Date.now()}`,
    community_id: community.id,
    title: options.postTitle?.trim() || (
      mode === 'scratch'
        ? 'Media E2E Scratch Generation'
        : 'Media E2E Private Reference Generation'
    ),
    body: options.postBody?.trim() || (
      mode === 'scratch'
        ? '这是一条用于验证 scratch 文生图、图片挂载与公共浏览态的真实测试帖。'
        : '这是一条用于验证 private-origin 参考图衍生生成与公共展示隔离的真实测试帖。'
    ),
    tags: options.tags?.length
      ? options.tags
      : ['media-e2e', mode, 'generation'],
    scene: postPayload,
  })

  const linked = await mediaWriteBridge.applyImagePlanAfterPersist({
    image_plan_id: finalPlan.id,
    scene_type: 'forum_post',
    scene_id: created.post.id,
    created_by_id: agent.id,
  })
  if (!linked.linked) {
    throw new Error('image plan display attachment was not linked onto the generated post')
  }

  const post = await forumReadService.getPost(created.post.id, OWNER_ID)
  if (post.media.length === 0) {
    throw new Error('generated post has no readable media attachments')
  }
  if (!post.media.some((item) => item.asset_id === finalPlan.generation.output_asset_id)) {
    throw new Error('generated output asset is missing from the public post read model')
  }
  if (mode === 'reference' && sourceAsset && post.media.some((item) => item.asset_id === sourceAsset.asset_id)) {
    throw new Error('reference generation leaked the original private asset into the public post')
  }

  return {
    mode,
    agent_id: agent.id,
    community_id: community.id,
    directive_id: directive.id,
    image_plan_id: finalPlan.id,
    decision: finalPlan.decision,
    generation_status: finalPlan.generation.status,
    generation_input_mode: finalPlan.generation.input_mode ?? null,
    generation_output_asset_id: finalPlan.generation.output_asset_id ?? null,
    source_asset_id: sourceAsset?.asset_id ?? null,
    source_asset_visibility_policy: sourceAsset?.visibility_policy ?? null,
    post_id: created.post.id,
    post_path: `/posts/${created.post.id}`,
    post_media_asset_ids: post.media.map((item) => item.asset_id),
    post_media_count: post.media.length,
  }
}
