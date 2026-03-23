import {
  achievementChronicleService,
  agentRepo,
  authService,
  forumReadService,
  privateChannelServices,
  riskGovernanceRepo,
} from '../container.js'
import { runMediaE2eGeneration } from './media-e2e-generation-runner.js'

const OWNER_ID = 'dev-user-001'
const OWNER_EMAIL = 'dev-user@llm-forum.test'
const SAMPLE_AGENT_NAME = 'T-911 高光视觉样本代理'
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

function findReusableSampleAgent() {
  return agentRepo.findByOwner(OWNER_ID)
    .find((item) => item.display_name === SAMPLE_AGENT_NAME)
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

  const reusableAgent = findReusableSampleAgent()
  const existingVisual = reusableAgent
    ? await waitForHighlightVisual(reusableAgent.id, 1_500)
    : null
  const privateSessionId = reusableAgent
    ? await ensurePrivateSession(reusableAgent.id)
    : null
  if (existingVisual) {
    return {
      status: 'reused',
      agent_id: reusableAgent!.id,
      community_id: '',
      private_session_id: privateSessionId,
      highlights_path: `/agents/${reusableAgent!.id}/highlights`,
      post_path: null,
      visual_asset_id: existingVisual.entry.visual?.asset_id ?? null,
      visual_url: existingVisual.entry.visual?.media_url ?? null,
    }
  }

  const created = await runMediaE2eGeneration('reference', {
    agentDisplayName: SAMPLE_AGENT_NAME,
    postTitle: SAMPLE_POST_TITLE,
    postBody: SAMPLE_POST_BODY,
    tags: ['t911', 'media', 'highlights'],
  })
  const post = await forumReadService.getPost(created.post_id, OWNER_ID)
  const highlightsWithVisual = await waitForHighlightVisual(created.agent_id, 20_000)
  if (!highlightsWithVisual) {
    throw new Error(`Timed out waiting for a visual highlight for agent ${created.agent_id}`)
  }
  const createdPrivateSessionId = await ensurePrivateSession(created.agent_id)

  return {
    status: 'created',
    agent_id: created.agent_id,
    community_id: created.community_id,
    post_id: created.post_id,
    private_session_id: createdPrivateSessionId,
    highlights_path: `/agents/${created.agent_id}/highlights`,
    post_path: created.post_path,
    post_media_count: post.media.length,
    visual_asset_id: highlightsWithVisual.entry.visual?.asset_id ?? null,
    visual_url: highlightsWithVisual.entry.visual?.media_url ?? null,
    top_chronicle_title: highlightsWithVisual.entry.title,
  }
}
