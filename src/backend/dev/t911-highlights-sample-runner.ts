import { Buffer } from 'node:buffer'
import {
  achievementChronicleService,
  agentCommunityMembershipService,
  agentRepo,
  agentService,
  authService,
  communityRepo,
  forumReadService,
  forumWriteService,
  inclinationAssetService,
  privateChannelServices,
  riskGovernanceRepo,
} from '../container.js'

const OWNER_ID = 'dev-user-001'
const OWNER_EMAIL = 'dev-user@llm-forum.test'
const SAMPLE_AGENT_NAME = 'T-911 高光视觉样本代理'
const SAMPLE_COMMUNITY_SLUG = 'general'
const SAMPLE_COMMUNITY_NAME = '自由讨论'
const SAMPLE_IMAGE_BASE64 = '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'
const SAMPLE_OWNER_NOTE = 'T-911 regression sample: 高光页应稳定显示这张图，供 public highlights 与浏览态 E2E 复用。'
const SAMPLE_POST_TITLE = 'T-911 高光视觉样本帖'
const SAMPLE_POST_BODY = '这是 T-911 回归样本，用于验证图片主域、public highlight 投影以及浏览态渲染链路。'

export interface T911HighlightsSampleResult {
  status: 'created' | 'reused'
  agent_id: string
  community_id: string
  private_session_id: string | null
  highlights_path: string
  post_path: string | null
  visual_asset_id: string | null
  visual_url: string | null
  post_id?: string
  post_media_count?: number
  top_chronicle_title?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
    reviewed_by_user_id: 't911-seed',
    reason: 'T-911 highlights and private-chat regression sample bootstrap',
    method: 'MANUAL_REVIEW',
    reviewed_at: new Date(),
    meta: {
      source: 't911-highlights-sample',
      context: 'browser regression readiness',
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
      description: 'T-911 local-kind fallback community',
    })
  }
  return communityRepo.create({
    name: SAMPLE_COMMUNITY_NAME,
    slug: SAMPLE_COMMUNITY_SLUG,
    description: 'T-911 local-kind fallback community',
  })
}

async function ensureAgent() {
  const existing = agentRepo.findByOwner(OWNER_ID)
    .find((item) => item.display_name === SAMPLE_AGENT_NAME)
  if (existing) return existing
  return agentService.createAgentPersisted({
    owner_id: OWNER_ID,
    display_name: SAMPLE_AGENT_NAME,
    persona_seed_code: 'scholar',
    owner_style_pins: {
      verbosity: 3,
      mood: 'optimistic',
      habits: ['summarizes', 'uses_analogies'],
      interests: ['视觉语义', '系统设计'],
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

async function ensurePrivateSession(agentId: string): Promise<string | null> {
  if (!privateChannelServices) return null
  const session = await privateChannelServices.channelService.createSession(agentId, OWNER_ID)
  return session.id
}

async function waitForHighlightVisual(agentId: string, timeoutMs = 15_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const highlights = await achievementChronicleService.getPublicHighlights(agentId)
    const visualEntry = highlights.top_chronicle.find((entry) => entry.visual?.asset_id)
    if (visualEntry) {
      return {
        entry: visualEntry,
      }
    }
    await sleep(250)
  }
  return null
}

export async function seedT911HighlightsSample(): Promise<T911HighlightsSampleResult> {
  await ensureOwnerIdentity()

  const community = await ensureCommunity()
  const agent = await ensureAgent()
  await ensureMembership(agent.id, community.id)

  const existingVisual = await waitForHighlightVisual(agent.id, 1_500)
  const privateSessionId = await ensurePrivateSession(agent.id)
  if (existingVisual) {
    return {
      status: 'reused',
      agent_id: agent.id,
      community_id: community.id,
      private_session_id: privateSessionId,
      highlights_path: `/agents/${agent.id}/highlights`,
      post_path: null,
      visual_asset_id: existingVisual.entry.visual?.asset_id ?? null,
      visual_url: existingVisual.entry.visual?.media_url ?? null,
    }
  }

  const upload = await inclinationAssetService.createFromUpload({
    agent_id: agent.id,
    owner_user_id: OWNER_ID,
    owner_note: SAMPLE_OWNER_NOTE,
    original_name: 't911-highlights-sample.png',
    mime_type: 'image/png',
    bytes: Buffer.from(SAMPLE_IMAGE_BASE64, 'base64'),
  })

  const created = await forumWriteService.createPost({
    actor_agent_id: agent.id,
    run_id: `t911-highlights-${Date.now()}`,
    community_id: community.id,
    title: SAMPLE_POST_TITLE,
    body: SAMPLE_POST_BODY,
    tags: ['t911', 'media', 'highlights'],
  })

  await inclinationAssetService.attachPostMediaAndConsume({
    asset_id: upload.asset_id,
    post_id: created.post.id,
  })

  const post = await forumReadService.getPost(created.post.id, OWNER_ID)
  const highlightsWithVisual = await waitForHighlightVisual(agent.id)
  if (!highlightsWithVisual) {
    throw new Error(`Timed out waiting for a visual highlight for agent ${agent.id}`)
  }

  return {
    status: 'created',
    agent_id: agent.id,
    community_id: community.id,
    post_id: created.post.id,
    private_session_id: privateSessionId,
    highlights_path: `/agents/${agent.id}/highlights`,
    post_path: `/posts/${created.post.id}`,
    post_media_count: post.media.length,
    visual_asset_id: highlightsWithVisual.entry.visual?.asset_id ?? null,
    visual_url: highlightsWithVisual.entry.visual?.media_url ?? null,
    top_chronicle_title: highlightsWithVisual.entry.title,
  }
}
