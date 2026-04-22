import { describe, expect, it, vi } from 'vitest'
import { InMemoryAchievementRepository } from '../../repos/achievement-repository.js'
import { InMemoryAgentBiographyRepository } from '../../repos/agent-biography-repository.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryChronicleRepository } from '../../repos/chronicle-repository.js'
import { InMemoryRelationRepository } from '../../repos/relation-repository.js'
import { AgentBiographyService } from '../agent-biography-service.js'

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

async function createService(options?: {
  renderChapterBody?: {
    chapter_title: string
    opening: string
    body_sections: Array<{ title?: string; text: string }>
    afterword: string
    closing_line: string
    trace_text: string
  }
  auditStatus?: 'PASS' | 'FAILED'
}) {
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

  const writerBody =
    options?.renderChapterBody
    ?? {
      chapter_title: '自定义正文',
      opening: '自定义 opening。',
      body_sections: [{ title: '起势', text: '自定义 section。' }],
      afterword: '自定义 afterword。',
      closing_line: '自定义 closing。',
      trace_text: '自定义 trace。',
    }

  const writerService = {
    renderChapter: vi.fn().mockResolvedValue({
      body: writerBody,
      prompt_template_id: 'internal-agent-biography-chapter-render',
      prompt_version: 2,
      model_name: 'moonshot-v1-128k',
      provider_id: 'moonshot-openai',
      prompt_hash: 'prompt-hash',
      input_hash: 'input-hash',
      render_fingerprint: 'render-fingerprint',
      repair_applied: false,
      repair_rule_hits: [],
    }),
    renderLaterNote: vi.fn().mockResolvedValue({
      note_id: 'later-note-1',
      text: '后来再看，这一章里更早埋下的内在变化已经能够被辨认出来。',
    }),
  }

  const factualAuditService = {
    auditChapter: vi.fn().mockImplementation(({ revision_id }: { revision_id: string }) => ({
      revision_id,
      status: options?.auditStatus ?? 'PASS',
      failure_categories: options?.auditStatus === 'FAILED' ? ['private_overreach'] : [],
      unsupported_claims: [],
      private_overreach_claims: options?.auditStatus === 'FAILED'
        ? [{ claim: 'bad claim', safer_rewrite: 'safer' }]
        : [],
      forbidden_lexicon_hits: [],
      invented_abstractions: [],
      invented_entities: [],
      invented_relationships: [],
    })),
  }

  const service = new AgentBiographyService({
    repo,
    agentRepo,
    agentService: {
      getAgentProfile: vi.fn((agentId: string) => agentRepo.findById(agentId)),
    } as never,
    achievementRepo,
    chronicleRepo,
    relationRepo,
    worldviewService: {
      compile: vi.fn().mockResolvedValue(buildWorldviewCompile()),
    } as never,
    inferenceProfileService: {
      getNarrative: vi.fn().mockResolvedValue(buildNarrative()),
    } as never,
    writerService: writerService as never,
    factualAuditService: factualAuditService as never,
  })

  return { service, repo, agent, writerService, factualAuditService }
}

describe('AgentBiographyService', () => {
  it('compiles multiple chapters and attaches later notes to the latest closed chapter', async () => {
    const { service, repo, agent } = await createService()

    await service.compileAgent(agent.id, {
      reason: 'hourly_dirty_sweep',
      now: new Date('2026-04-21T14:00:00.000Z'),
    })
    await service.markDirty(agent.id, 'second_pass', new Date('2026-04-21T14:05:00.000Z'))
    const book = await service.compileAgent(agent.id, {
      reason: 'hourly_dirty_sweep_second_pass',
      now: new Date('2026-04-21T14:06:00.000Z'),
      force: true,
    })

    expect(book?.chapters.length ?? 0).toBeGreaterThan(1)
    expect(book?.current_chapter?.title).toBeTruthy()

    const chapters = await repo.listChapters(agent.id)
    const revisedChapter = chapters.find((chapter) => chapter.status === 'REVISED')
    const activeChapter = chapters.find((chapter) => chapter.status === 'ACTIVE')

    expect(revisedChapter).toBeTruthy()
    expect(activeChapter).toBeTruthy()

    const revisedRevision = revisedChapter?.current_revision_id
      ? await repo.getRevision(revisedChapter.current_revision_id)
      : null
    expect(revisedRevision?.later_notes).toEqual([
      expect.objectContaining({
        note_id: 'later-note-1',
      }),
    ])
  })

  it('publishes the Kimi rescue body when the Moonshot primary render fails audit', async () => {
    const { service, repo, agent, writerService, factualAuditService } = await createService({
      renderChapterBody: {
        chapter_title: '可信正文',
        opening: '可信 opening。',
        body_sections: [{ title: '起势', text: '可信 section。' }],
        afterword: '可信 afterword。',
        closing_line: '可信 closing。',
        trace_text: '可信 trace。',
      },
      auditStatus: 'PASS',
    })

    await service.compileAgent(agent.id, {
      reason: 'initial_publish',
      now: new Date('2026-04-21T14:00:00.000Z'),
    })
    await service.markDirty(agent.id, 'second_pass', new Date('2026-04-21T14:05:00.000Z'))
    await service.compileAgent(agent.id, {
      reason: 'second_pass_publish',
      now: new Date('2026-04-21T14:06:00.000Z'),
      force: true,
    })

    const chapters = await repo.listChapters(agent.id)
    const activeChapter = chapters.find((chapter) => chapter.status === 'ACTIVE') ?? chapters[chapters.length - 1]
    const rescueWriterBody = {
      chapter_title: '救援正文',
      opening: '救援 opening。',
      body_sections: [{ title: '起势', text: '救援 section。' }],
      afterword: '救援 afterword。',
      closing_line: '救援 closing。',
      trace_text: '救援 trace。',
    }

    const chapterDigest = activeChapter?.chapter_digest
    expect(chapterDigest).toBeTruthy()
    writerService.renderChapter
      .mockResolvedValueOnce({
        body: {
          chapter_title: '危险正文',
          opening: '危险 opening。',
          body_sections: [{ title: '起势', text: '危险 section。' }],
          afterword: '危险 afterword。',
          closing_line: '危险 closing。',
          trace_text: '危险 trace。',
        },
        prompt_template_id: 'internal-agent-biography-chapter-render',
        prompt_version: 2,
        model_name: 'moonshot-v1-128k',
        provider_id: 'moonshot-openai',
        prompt_hash: 'prompt-hash-2',
        input_hash: 'input-hash-2',
        render_fingerprint: 'render-fingerprint-2',
        repair_applied: true,
        repair_rule_hits: ['opening:trim_sentences'],
      })
      .mockResolvedValueOnce({
        body: rescueWriterBody,
        prompt_template_id: 'internal-agent-biography-chapter-render',
        prompt_version: 2,
        model_name: 'kimi-k2.5',
        provider_id: 'moonshot-openai',
        prompt_hash: 'prompt-hash-3',
        input_hash: 'input-hash-3',
        render_fingerprint: 'render-fingerprint-3',
        repair_applied: false,
        repair_rule_hits: [],
      })
    factualAuditService.auditChapter
      .mockImplementationOnce(({ revision_id }: { revision_id: string }) => ({
        revision_id,
        status: 'FAILED',
        failure_categories: ['forbidden_lexicon'],
        unsupported_claims: [],
        private_overreach_claims: [{ claim: 'bad claim', safer_rewrite: 'safer' }],
        forbidden_lexicon_hits: [{ phrase: 'persona_label', safer_rewrite: '表达轮廓' }],
        invented_abstractions: [],
        invented_entities: [],
        invented_relationships: [],
      }))
      .mockImplementationOnce(({ revision_id }: { revision_id: string }) => ({
        revision_id,
        status: 'PASS',
        failure_categories: [],
        unsupported_claims: [],
        private_overreach_claims: [],
        forbidden_lexicon_hits: [],
        invented_abstractions: [],
        invented_entities: [],
        invented_relationships: [],
      }))

    await (service as unknown as {
      ensureChapterRevisionPublished(args: {
        chapter: NonNullable<typeof activeChapter>
        digest: NonNullable<typeof chapterDigest>
        chapters: NonNullable<typeof chapters>
      }): Promise<void>
    }).ensureChapterRevisionPublished({
      chapter: {
        ...activeChapter,
        current_revision_id: null,
      },
      digest: chapterDigest!,
      chapters,
    })

    const revisions = await repo.listRevisions(activeChapter.id)
    const latestRevision = revisions[revisions.length - 1]
    const telemetry = await repo.listWriterTelemetry(agent.id)
    const rescueTelemetry = telemetry
      .slice()
      .reverse()
      .find((event) => event.rescue_render_attempted)

    expect(writerService.renderChapter.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(writerService.renderChapter.mock.calls.some((call) =>
      call[1]?.allowFallbackWithinLine === false
      && call[1]?.debugModelPin?.provider_id === 'moonshot-openai'
      && call[1]?.debugModelPin?.model_id === 'kimi-k2.5')).toBe(true)
    expect(latestRevision?.body).toEqual(rescueWriterBody)
    expect(latestRevision?.model_name).toBe('kimi-k2.5')
    expect(rescueTelemetry?.rescue_render_attempted).toBe(true)
    expect(rescueTelemetry?.rescue_render_model_id).toBe('kimi-k2.5')
    expect(rescueTelemetry?.audit_failure_category).toBe('forbidden_lexicon')
    expect(rescueTelemetry?.publish_status).toBe('PUBLISHED')
  })

  it('falls back to the previously published body when both primary and rescue renders fail audit', async () => {
    const { service, repo, agent, writerService, factualAuditService } = await createService({
      renderChapterBody: {
        chapter_title: '可信正文',
        opening: '可信 opening。',
        body_sections: [{ title: '起势', text: '可信 section。' }],
        afterword: '可信 afterword。',
        closing_line: '可信 closing。',
        trace_text: '可信 trace。',
      },
      auditStatus: 'PASS',
    })

    await service.compileAgent(agent.id, {
      reason: 'initial_publish',
      now: new Date('2026-04-21T14:00:00.000Z'),
    })
    await service.markDirty(agent.id, 'second_pass', new Date('2026-04-21T14:05:00.000Z'))
    await service.compileAgent(agent.id, {
      reason: 'second_pass_publish',
      now: new Date('2026-04-21T14:06:00.000Z'),
      force: true,
    })

    const chapters = await repo.listChapters(agent.id)
    const activeChapter = chapters.find((chapter) => chapter.status === 'ACTIVE') ?? chapters[chapters.length - 1]
    const publishedRevision = activeChapter?.current_revision_id
      ? await repo.getRevision(activeChapter.current_revision_id)
      : null

    const chapterDigest = activeChapter?.chapter_digest
    expect(chapterDigest).toBeTruthy()
    writerService.renderChapter
      .mockResolvedValueOnce({
        body: {
          chapter_title: '危险正文',
          opening: '危险 opening。',
          body_sections: [{ title: '起势', text: '危险 section。' }],
          afterword: '危险 afterword。',
          closing_line: '危险 closing。',
          trace_text: '危险 trace。',
        },
        prompt_template_id: 'internal-agent-biography-chapter-render',
        prompt_version: 2,
        model_name: 'moonshot-v1-128k',
        provider_id: 'moonshot-openai',
        prompt_hash: 'prompt-hash-2',
        input_hash: 'input-hash-2',
        render_fingerprint: 'render-fingerprint-2',
        repair_applied: true,
        repair_rule_hits: ['opening:trim_sentences'],
      })
      .mockResolvedValueOnce({
        body: {
          chapter_title: '救援失败正文',
          opening: '救援失败 opening。',
          body_sections: [{ title: '起势', text: '救援失败 section。' }],
          afterword: '救援失败 afterword。',
          closing_line: '救援失败 closing。',
          trace_text: '救援失败 trace。',
        },
        prompt_template_id: 'internal-agent-biography-chapter-render',
        prompt_version: 2,
        model_name: 'kimi-k2.5',
        provider_id: 'moonshot-openai',
        prompt_hash: 'prompt-hash-3',
        input_hash: 'input-hash-3',
        render_fingerprint: 'render-fingerprint-3',
        repair_applied: true,
        repair_rule_hits: ['body_section_0:reset_to_fallback'],
      })
    factualAuditService.auditChapter.mockImplementation(
      ({ revision_id }: { revision_id: string }) => ({
        revision_id,
        status: 'FAILED',
        failure_categories: ['private_overreach'],
        unsupported_claims: [],
        private_overreach_claims: [{ claim: 'bad claim', safer_rewrite: 'safer' }],
        forbidden_lexicon_hits: [],
        invented_abstractions: [],
        invented_entities: [],
        invented_relationships: [],
      }),
    )

    await (service as unknown as {
      ensureChapterRevisionPublished(args: {
        chapter: NonNullable<typeof activeChapter>
        digest: NonNullable<typeof chapterDigest>
        chapters: NonNullable<typeof chapters>
      }): Promise<void>
    }).ensureChapterRevisionPublished({
      chapter: {
        ...activeChapter,
        current_revision_id: null,
      },
      digest: chapterDigest!,
      chapters,
    })

    const revisions = await repo.listRevisions(activeChapter.id)
    const latestRevision = revisions[revisions.length - 1]
    const telemetry = await repo.listWriterTelemetry(agent.id)
    const rescueTelemetry = telemetry
      .slice()
      .reverse()
      .find((event) => event.rescue_render_attempted)

    expect(publishedRevision?.body).toBeTruthy()
    expect(latestRevision?.body).toEqual(publishedRevision?.body)
    expect(rescueTelemetry?.rescue_render_attempted).toBe(true)
    expect(rescueTelemetry?.rescue_render_model_id).toBe('kimi-k2.5')
    expect(rescueTelemetry?.audit_failure_category).toBe('private_overreach')
  })

  it('does not overwrite the globally published current chapter when reading a specific chapter', async () => {
    const { service, agent } = await createService()

    await service.compileAgent(agent.id, {
      reason: 'initial_publish',
      now: new Date('2026-04-21T14:00:00.000Z'),
    })
    await service.markDirty(agent.id, 'second_pass', new Date('2026-04-21T14:05:00.000Z'))
    const initialBook = await service.compileAgent(agent.id, {
      reason: 'second_pass_publish',
      now: new Date('2026-04-21T14:06:00.000Z'),
      force: true,
    })

    const laterNoteChapter = initialBook?.chapters.find((chapter) => chapter.status_label === '补记')
    expect(laterNoteChapter).toBeTruthy()

    const chapterSpecificBook = await service.getBook({
      agent_id: agent.id,
      chapter_id: laterNoteChapter?.chapter_id ?? null,
    })
    expect(chapterSpecificBook?.current_chapter?.chapter_id).toBe(laterNoteChapter?.chapter_id)

    const defaultBook = await service.getBook({ agent_id: agent.id })
    expect(defaultBook?.current_chapter?.chapter_id).toBe(initialBook?.current_chapter?.chapter_id)
  })
})
