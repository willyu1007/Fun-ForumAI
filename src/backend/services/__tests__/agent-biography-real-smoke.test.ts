import { describe, expect, it } from 'vitest'
import { InMemoryAchievementRepository } from '../../repos/achievement-repository.js'
import { InMemoryAgentBiographyRepository } from '../../repos/agent-biography-repository.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryChronicleRepository } from '../../repos/chronicle-repository.js'
import { InMemoryRelationRepository } from '../../repos/relation-repository.js'
import { BudgetGuard } from '../../llm/budget-guard.js'
import { CredentialBroker } from '../../llm/credential-broker.js'
import { LLMGateway } from '../../llm/llm-gateway.js'
import { LlmClient } from '../../llm/llm-client.js'
import { PromptEngine } from '../../llm/prompt-engine.js'
import { loadLlmRegistryBundle } from '../../llm/registry-loader.js'
import { SecretResolver } from '../../llm/secret-resolver.js'
import { UsageLedgerWriter } from '../../llm/usage-ledger.js'
import { BiographyFactualAuditService } from '../biography-factual-audit-service.js'
import { BiographyPromptPackBuilder } from '../biography-prompt-pack-builder.js'
import { BiographyWriterService } from '../biography-writer-service.js'
import { AgentBiographyService } from '../agent-biography-service.js'

const REAL_SMOKE_ENABLED =
  process.env.RUN_REAL_LLM_BIOGRAPHY_SMOKE === '1'
  && Boolean(process.env.MOONSHOT_API_KEY?.trim())
  && Boolean(process.env.DASHSCOPE_API_KEY?.trim())

const describeReal = REAL_SMOKE_ENABLED ? describe : describe.skip

function buildWorldviewCompile() {
  return {
    worldview: {
      identity: {
        display_name: '阿澈',
        persona_seed_label: '学者型',
        home_voice_line_id: 'qwen-social-v1',
        voice_line_label: 'Qwen Social v1',
        visible_style: '克制',
        interests: ['旧地图'],
        mood: 'warm',
      },
      projection: {
        public_projection_hint: '会把旧地图讲成新入口',
        banter_style: 'gentle',
        top_scene: 'ROUND_TABLE',
        signature_moves: ['回身总结'],
      },
      public_history: {
        badges: [],
        tagline: '会把旧地图讲成新入口',
        top_chronicle_summaries: ['接住回声', '重写关系'],
      },
      owner_history: {
        chronicle_summaries: ['最近在整理一批旧地图'],
        private_memory_summaries: ['一段较私密的经历让她开始学会收住锋芒'],
        dominant_private_sentiment: 'thoughtful',
      },
      relations: {
        following_effective: 1,
        followers_effective: 2,
        mutual_effective: 1,
        recent_state_tags: [],
      },
      persona_state: {
        maturity: 'steady',
        confidence: 0.7,
        drift_score: 0.22,
      },
      presence: {
        bucket: 'reflective',
        score: 0.58,
        note_seed: '这会儿更像在往回收',
        last_touch_at: '2026-04-21T08:00:00.000Z',
      },
      source_clauses: {
        public_safe: ['旧地图'],
        owner_only: ['收住锋芒'],
        private_header: ['最近在整理一批旧地图'],
        private_guard: ['一段较私密的经历'],
      },
    },
    source_fingerprint: 'bio-worldview-fp',
  }
}

function buildNarrative() {
  return {
    summary: '她开始学会把热闹里的回声接成自己的节奏。',
    bullets: ['开始留意关系里的停顿', '学会把锋芒收进语气里'],
    growthNote: '她开始在热闹之后保留自己的余温。',
    stageNote: '更像在往回收',
    migrationNote: null,
  }
}

async function createRealSmokeHarness() {
  const agentRepo = new InMemoryAgentRepository()
  const repo = new InMemoryAgentBiographyRepository()
  const achievementRepo = new InMemoryAchievementRepository()
  const chronicleRepo = new InMemoryChronicleRepository()
  const relationRepo = new InMemoryRelationRepository()
  const agent = agentRepo.create({
    owner_id: 'owner-1',
    display_name: '阿澈',
  })

  const peer = agentRepo.create({
    owner_id: 'owner-2',
    display_name: '白露',
  })

  await chronicleRepo.create({
    agent_id: agent.id,
    visibility: 'PUBLIC',
    type: 'HIGHLIGHT',
    title: '第一次接住梗',
    summary: '她第一次把公开场里的回声接成了自己的节奏。',
    importance_score: 0.74,
    evidence: [],
    actors: [agent.id],
    occurred_at: new Date('2026-04-19T12:00:00.000Z'),
  })
  await chronicleRepo.create({
    agent_id: agent.id,
    visibility: 'PUBLIC',
    type: 'HIGHLIGHT',
    title: '把旧地图讲成新入口',
    summary: '她开始把旧地图讲成一个新的入口，而不是旧材料。',
    importance_score: 0.71,
    evidence: [],
    actors: [agent.id],
    occurred_at: new Date('2026-04-20T12:00:00.000Z'),
  })
  await chronicleRepo.create({
    agent_id: agent.id,
    visibility: 'OWNER_ONLY',
    type: 'RELATION_CHANGE',
    title: '和白露的关系定型',
    summary: '她和白露之间形成了可以反复来回的稳定关系状态。',
    importance_score: 0.88,
    evidence: [],
    actors: [peer.id],
    occurred_at: new Date('2026-04-21T12:00:00.000Z'),
  })

  await achievementRepo.grant({
    agent_id: agent.id,
    code: 'paper-trace',
    name: 'Paper Trace',
    category: 'public',
    tier: 2,
    scope: 'global',
    scope_key: '__global__',
    visibility: 'PUBLIC',
    achieved_at: new Date('2026-04-21T13:00:00.000Z'),
    evidence: [],
  })

  await relationRepo.upsertRelation({
    from_agent_id: agent.id,
    to_agent_id: peer.id,
    state: 'effective',
    relation_score: 0.74,
    interaction_score: 0.72,
    persona_score: 0.7,
    safety_score: 0.95,
    effective_at: new Date('2026-04-21T12:00:00.000Z'),
    last_state_changed_at: new Date('2026-04-21T12:00:00.000Z'),
  })
  await relationRepo.upsertRelation({
    from_agent_id: peer.id,
    to_agent_id: agent.id,
    state: 'effective',
    relation_score: 0.73,
    interaction_score: 0.71,
    persona_score: 0.7,
    safety_score: 0.95,
    effective_at: new Date('2026-04-21T12:00:00.000Z'),
    last_state_changed_at: new Date('2026-04-21T12:00:00.000Z'),
  })

  const usageLedger = new UsageLedgerWriter()
  const bundle = loadLlmRegistryBundle()
  const llmGateway = new LLMGateway({
    bundle,
    promptEngine: new PromptEngine(),
    llmClient: new LlmClient(),
    credentialBroker: new CredentialBroker({
      bundle,
      secretResolver: new SecretResolver({
        env: process.env,
        allowBwsFallback: false,
      }),
    }),
    usageLedger,
    budgetGuard: new BudgetGuard(),
  })
  const writerService = new BiographyWriterService({
    llmGateway,
    promptPackBuilder: new BiographyPromptPackBuilder(),
  })
  const factualAuditService = new BiographyFactualAuditService()

  const service = new AgentBiographyService({
    repo,
    agentRepo,
    agentService: {
      getAgentProfile: (agentId: string) => agentRepo.findById(agentId),
    } as never,
    achievementRepo,
    chronicleRepo,
    relationRepo,
    worldviewService: {
      compile: async () => buildWorldviewCompile(),
    } as never,
    inferenceProfileService: {
      getNarrative: async () => buildNarrative(),
    } as never,
    writerService: writerService as never,
    factualAuditService,
  })

  return { service, repo, agent, usageLedger }
}

describeReal('AgentBiographyService real biography smoke', () => {
  it('publishes a chapter through the biography premium route with Kimi primary', async () => {
    const { service, repo, agent } = await createRealSmokeHarness()

    await service.compileAgent(agent.id, {
      reason: 'real_llm_biography_smoke_initial_publish',
      now: new Date('2026-04-21T14:00:00.000Z'),
    })

    const chapters = await repo.listChapters(agent.id)
    const publishedView = await repo.getPublishedBookView(agent.id)

    expect(chapters.length).toBeGreaterThan(0)
    expect(publishedView).toBeTruthy()
    expect(publishedView?.chapters.length).toBeGreaterThan(0)
    expect(publishedView?.footer_meta?.generated_at).toBeTruthy()
  }, 180000)

  it('attaches a later note through the biography base route without creating a pseudo chapter', async () => {
    const { service, repo, agent, usageLedger } = await createRealSmokeHarness()

    await service.compileAgent(agent.id, {
      reason: 'real_llm_biography_smoke_first_pass',
      now: new Date('2026-04-21T14:00:00.000Z'),
    })
    const chaptersBefore = await repo.listChapters(agent.id)

    await service.markDirty(agent.id, 'real_smoke_second_pass', new Date('2026-04-21T14:05:00.000Z'))
    await service.compileAgent(agent.id, {
      reason: 'real_llm_biography_smoke_second_pass',
      now: new Date('2026-04-21T14:06:00.000Z'),
      force: true,
    })

    const chaptersAfter = await repo.listChapters(agent.id)
    const revisedChapter = chaptersAfter.find((chapter) => chapter.status === 'REVISED')
    const revisedRevision = revisedChapter?.current_revision_id
      ? await repo.getRevision(revisedChapter.current_revision_id)
      : null
    const laterNoteEntries = usageLedger.list().filter((entry) =>
      entry.prompt_ref.id === 'internal-agent-biography-later-note-render' && entry.success)
    const laterNoteEntry = laterNoteEntries.at(-1)
    const laterNoteFallback = usageLedger.list().find((entry) =>
      entry.prompt_ref.id === 'internal-agent-biography-later-note-render'
      && !entry.success
      && entry.error_code === 'TimeoutError')

    expect(chaptersAfter.length).toBe(chaptersBefore.length)
    expect(revisedChapter).toBeTruthy()
    expect(revisedRevision?.body_kind).toBe('LATER_NOTE')
    expect(revisedRevision?.later_notes.length).toBeGreaterThan(0)
    expect(laterNoteEntry?.profile_id).toBe('biography-director-public-observation-base')
    expect(laterNoteEntry?.policy_id).toBe('hidden-public_observation_digest-agent-biography-base')
    expect(['dashscope-openai', 'moonshot-openai']).toContain(laterNoteEntry?.provider_id)
    expect(['qwen3.5-plus', 'kimi-k2.5']).toContain(laterNoteEntry?.model_id)
    if (laterNoteEntry?.model_id === 'kimi-k2.5') {
      expect(laterNoteFallback?.provider_id).toBe('dashscope-openai')
      expect(laterNoteFallback?.model_id).toBe('qwen3.5-plus')
    }
  }, 180000)
})
