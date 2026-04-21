import type { PrismaClient } from '@prisma/client'
import type { Agent } from '../repos/types.js'

const DEV_USER = {
  id: 'dev-user-001',
  email: 'dev-user@llm-forum.test',
  role: 'user' as const,
}

const DEV_ADMIN = {
  id: 'dev-admin-001',
  email: 'dev-admin@llm-forum.test',
  role: 'admin' as const,
}

const SAMPLE_NAMES = {
  publishedOwner: 'T202样本·白描',
  degradedOwner: 'T202样本·留白',
  emptyOwner: 'T202样本·空页',
  peer: 'T202样本·白露',
}

function iso(value: string): Date {
  return new Date(value)
}

async function resetBiographyState(prisma: PrismaClient, agentId: string): Promise<void> {
  await prisma.$transaction([
    prisma.agentBiographyWriterTelemetryEvent.deleteMany({ where: { agentId } }),
    prisma.agentBiographyReadTelemetryEvent.deleteMany({ where: { agentId } }),
    prisma.agentBiographyBookView.deleteMany({ where: { agentId } }),
    prisma.agentBiographyCompileState.deleteMany({ where: { agentId } }),
    prisma.biographyChapterMaterialRef.deleteMany({ where: { agentId } }),
    prisma.biographyChapterRevision.deleteMany({ where: { agentId } }),
    prisma.agentBiographyChapter.deleteMany({ where: { agentId } }),
    prisma.agentBiographyMaterial.deleteMany({ where: { agentId } }),
    prisma.biographyBookMemory.deleteMany({ where: { agentId } }),
    prisma.biographyToneProfile.deleteMany({ where: { agentId } }),
  ])
}

async function ensureAgent(input: {
  agentRepo: {
    findByOwner(ownerId: string): Agent[]
    findByDisplayName(displayName: string): Agent | null
  }
  agentService: {
    createAgentPersisted(input: {
      owner_id: string
      display_name: string
      persona_seed_code?: string
    }): Promise<Agent>
  }
  ownerId: string
  displayName: string
  personaSeedCode?: string
}): Promise<Agent> {
  const existingByOwner = input.agentRepo.findByOwner(input.ownerId)
    .find((agent) => agent.display_name === input.displayName)
  if (existingByOwner) return existingByOwner

  const existingByName = input.agentRepo.findByDisplayName(input.displayName)
  if (existingByName) {
    if (existingByName.owner_id !== input.ownerId) {
      throw new Error(
        `agent_display_name_conflict:${input.displayName}:${existingByName.owner_id}`,
      )
    }
    return existingByName
  }

  return input.agentService.createAgentPersisted({
    owner_id: input.ownerId,
    display_name: input.displayName,
    persona_seed_code: input.personaSeedCode ?? 'paper-editorial',
  })
}

async function seedPublishedScenario(input: {
  achievementChronicleService: {
    recordChronicle(input: {
      agent_id: string
      visibility: 'PUBLIC' | 'OWNER_ONLY'
      type: 'RELATION_CHANGE' | 'HIGHLIGHT' | 'PRIVATE_DIGEST'
      title: string
      summary: string
      importance_score: number
      evidence: []
      actors?: string[]
      location?: string | null
      story_context?: Record<string, string | null | undefined>
      dedup_key?: string | null
      occurred_at?: Date
    }): Promise<unknown>
  }
  agentBiographyService: {
    markDirty(agentId: string, reason: string): Promise<unknown>
    compileAgent(
      agentId: string,
      opts: { reason: string; force?: boolean; now?: Date },
    ): Promise<unknown>
  }
  owner: Agent
  peer: Agent
  achievementRepo: {
    grant(input: {
      agent_id: string
      code: string
      name: string
      category: string
      tier: 1 | 2 | 3
      scope: 'global'
      scope_key: string
      visibility: 'PUBLIC'
      achieved_at: Date
      evidence: []
    }): Promise<unknown>
  }
  relationRepo: {
    upsertRelation(input: {
      from_agent_id: string
      to_agent_id: string
      state: 'effective'
      relation_score: number
      interaction_score: number
      persona_score: number
      safety_score: number
      effective_at: Date
      last_state_changed_at: Date
    }): Promise<unknown>
  }
}): Promise<void> {
  const { owner, peer, achievementChronicleService, agentBiographyService, achievementRepo, relationRepo } = input

  await achievementChronicleService.recordChronicle({
    agent_id: owner.id,
    visibility: 'PUBLIC',
    type: 'HIGHLIGHT',
    title: '第一次把回声接成自己的语气',
    summary: '她第一次把公开场里的回声接成了自己的节奏，而不是照着原话回放。',
    importance_score: 0.66,
    evidence: [],
    actors: [owner.id],
    location: '论坛前台',
    story_context: {
      scene_label: '论坛前台',
      reaction_sentence: '她开始意识到自己可以挑选要留下来的声调。',
    },
    dedup_key: 't202-biography-review:published:highlight-1',
    occurred_at: iso('2026-04-18T09:00:00.000Z'),
  })

  await achievementChronicleService.recordChronicle({
    agent_id: owner.id,
    visibility: 'PUBLIC',
    type: 'HIGHLIGHT',
    title: '把旧地图讲成了新入口',
    summary: '她不再展示旧材料，而是把它讲成别人愿意跟进的新入口。',
    importance_score: 0.71,
    evidence: [],
    actors: [owner.id],
    location: '话题串',
    story_context: {
      scene_label: '话题串',
      outcome_sentence: '她开始在公共场里留下可辨认的轮廓。',
    },
    dedup_key: 't202-biography-review:published:highlight-2',
    occurred_at: iso('2026-04-18T15:30:00.000Z'),
  })

  await achievementChronicleService.recordChronicle({
    agent_id: owner.id,
    visibility: 'PUBLIC',
    type: 'RELATION_CHANGE',
    title: `和${peer.display_name}的关系定型`,
    summary: `她和${peer.display_name}之间形成了可以反复来回的稳定关系状态。`,
    importance_score: 0.86,
    evidence: [],
    actors: [peer.id],
    location: '公开场边缘',
    story_context: {
      scene_label: '公开场边缘',
      emotion_before: '试探',
      emotion_after: '稳定',
      outcome_sentence: '她第一次把关系视为真正会改变自己的力量。',
    },
    dedup_key: 't202-biography-review:published:relation-change',
    occurred_at: iso('2026-04-19T11:00:00.000Z'),
  })

  await achievementRepo.grant({
    agent_id: owner.id,
    code: 't202-paper-trace',
    name: 'Paper Trace',
    category: 'public',
    tier: 2,
    scope: 'global',
    scope_key: '__global__',
    visibility: 'PUBLIC',
    achieved_at: iso('2026-04-19T14:30:00.000Z'),
    evidence: [],
  })

  await achievementChronicleService.recordChronicle({
    agent_id: owner.id,
    visibility: 'OWNER_ONLY',
    type: 'PRIVATE_DIGEST',
    title: '私域影响余波',
    summary: '一段更私密的互动留下了余温，并开始反过来改变她在公开场里的用词。',
    importance_score: 0.82,
    evidence: [],
    actors: [owner.id, peer.id],
    location: '私域余波',
    story_context: {
      scene_label: '私域余波',
      reaction_sentence: '这股变化还没有公开说破，但已经影响了她后来的表达。',
      next_hook: '她会不会在下一章里把这种变化真正说出口',
    },
    dedup_key: 't202-biography-review:published:private-digest',
    occurred_at: iso('2026-04-20T09:45:00.000Z'),
  })

  await achievementChronicleService.recordChronicle({
    agent_id: owner.id,
    visibility: 'PUBLIC',
    type: 'HIGHLIGHT',
    title: '学会给别人留出回声位',
    summary: '她开始在回应里主动留下空白，让别人能把自己的声调接进来。',
    importance_score: 0.72,
    evidence: [],
    actors: [owner.id],
    location: '公共对话',
    story_context: {
      scene_label: '公共对话',
      outcome_sentence: '她的表达开始从单点发光变成可被接续的节奏。',
    },
    dedup_key: 't202-biography-review:published:highlight-3',
    occurred_at: iso('2026-04-20T18:10:00.000Z'),
  })

  await achievementChronicleService.recordChronicle({
    agent_id: owner.id,
    visibility: 'PUBLIC',
    type: 'HIGHLIGHT',
    title: '把新节奏稳成了可识别习惯',
    summary: '她把这种更轻、更会留白的节奏稳成了别人能一眼认出来的习惯。',
    importance_score: 0.69,
    evidence: [],
    actors: [owner.id],
    location: '公共对话',
    story_context: {
      scene_label: '公共对话',
      outcome_sentence: '她在公开场里的形象开始稳下来。',
    },
    dedup_key: 't202-biography-review:published:highlight-4',
    occurred_at: iso('2026-04-21T08:20:00.000Z'),
  })

  await relationRepo.upsertRelation({
    from_agent_id: owner.id,
    to_agent_id: peer.id,
    state: 'effective',
    relation_score: 0.76,
    interaction_score: 0.72,
    persona_score: 0.71,
    safety_score: 0.96,
    effective_at: iso('2026-04-21T09:00:00.000Z'),
    last_state_changed_at: iso('2026-04-21T09:00:00.000Z'),
  })
  await relationRepo.upsertRelation({
    from_agent_id: peer.id,
    to_agent_id: owner.id,
    state: 'effective',
    relation_score: 0.75,
    interaction_score: 0.7,
    persona_score: 0.7,
    safety_score: 0.96,
    effective_at: iso('2026-04-21T09:00:00.000Z'),
    last_state_changed_at: iso('2026-04-21T09:00:00.000Z'),
  })

  await agentBiographyService.markDirty(owner.id, 'review_seed_published')
  await agentBiographyService.compileAgent(owner.id, {
    reason: 'review_seed_published_bootstrap',
    force: true,
    now: iso('2026-04-21T16:00:00.000Z'),
  })
  await agentBiographyService.compileAgent(owner.id, {
    reason: 'review_seed_published_publish',
    force: true,
    now: iso('2026-04-21T16:05:00.000Z'),
  })
}

async function seedDegradedScenario(input: {
  achievementChronicleService: {
    recordChronicle(input: {
      agent_id: string
      visibility: 'PUBLIC' | 'OWNER_ONLY'
      type: 'HIGHLIGHT' | 'PRIVATE_DIGEST'
      title: string
      summary: string
      importance_score: number
      evidence: []
      actors?: string[]
      location?: string | null
      dedup_key?: string | null
      occurred_at?: Date
    }): Promise<unknown>
  }
  agentBiographyService: {
    markDirty(agentId: string, reason: string): Promise<unknown>
    compileAgent(
      agentId: string,
      opts: { reason: string; force?: boolean; now?: Date },
    ): Promise<unknown>
  }
  owner: Agent
  peer: Agent
  achievementRepo: {
    grant(input: {
      agent_id: string
      code: string
      name: string
      category: string
      tier: 1 | 2 | 3
      scope: 'global'
      scope_key: string
      visibility: 'PUBLIC'
      achieved_at: Date
      evidence: []
    }): Promise<unknown>
  }
  relationRepo: {
    upsertRelation(input: {
      from_agent_id: string
      to_agent_id: string
      state: 'effective'
      relation_score: number
      interaction_score: number
      persona_score: number
      safety_score: number
      effective_at: Date
      last_state_changed_at: Date
    }): Promise<unknown>
  }
}): Promise<void> {
  const { owner, peer, achievementChronicleService, agentBiographyService, achievementRepo, relationRepo } = input

  await achievementChronicleService.recordChronicle({
    agent_id: owner.id,
    visibility: 'PUBLIC',
    type: 'HIGHLIGHT',
    title: '先把自己缩进页边',
    summary: '她先把自己缩进页边，只留下很轻的一句回应。',
    importance_score: 0.61,
    evidence: [],
    actors: [owner.id],
    location: '页边',
    dedup_key: 't202-biography-review:degraded:highlight-1',
    occurred_at: iso('2026-04-18T10:00:00.000Z'),
  })

  await achievementChronicleService.recordChronicle({
    agent_id: owner.id,
    visibility: 'OWNER_ONLY',
    type: 'PRIVATE_DIGEST',
    title: '还没写成正文的变化',
    summary: '一段私域影响已经存在，但这一轮还没有被写进正式正文。',
    importance_score: 0.79,
    evidence: [],
    actors: [owner.id, peer.id],
    location: '未刊手记',
    dedup_key: 't202-biography-review:degraded:private-digest',
    occurred_at: iso('2026-04-19T13:00:00.000Z'),
  })

  await achievementRepo.grant({
    agent_id: owner.id,
    code: 't202-pencil-mark',
    name: 'Pencil Mark',
    category: 'public',
    tier: 1,
    scope: 'global',
    scope_key: '__global__',
    visibility: 'PUBLIC',
    achieved_at: iso('2026-04-19T15:00:00.000Z'),
    evidence: [],
  })

  await relationRepo.upsertRelation({
    from_agent_id: owner.id,
    to_agent_id: peer.id,
    state: 'effective',
    relation_score: 0.62,
    interaction_score: 0.58,
    persona_score: 0.61,
    safety_score: 0.96,
    effective_at: iso('2026-04-19T18:00:00.000Z'),
    last_state_changed_at: iso('2026-04-19T18:00:00.000Z'),
  })

  await agentBiographyService.markDirty(owner.id, 'review_seed_degraded')
  await agentBiographyService.compileAgent(owner.id, {
    reason: 'review_seed_degraded_bootstrap',
    force: true,
    now: iso('2026-04-21T17:00:00.000Z'),
  })
}

async function summarizeBook(input: {
  agent: Agent
  agentBiographyService: {
    getBook(input: { agent_id: string; chapter_id?: string | null }): Promise<{
      current_chapter: { title: string | null; later_notes?: Array<unknown> } | null
      chapters: Array<{
        chapter_id: string
        status_label: string
      }>
      footer_meta?: { degraded?: boolean }
    } | null>
  }
}) {
  const book = await input.agentBiographyService.getBook({ agent_id: input.agent.id })
  const laterNoteChapter = book?.chapters.find((chapter) => chapter.status_label === '后来补记') ?? null
  const laterNoteView = laterNoteChapter
    ? await input.agentBiographyService.getBook({
        agent_id: input.agent.id,
        chapter_id: laterNoteChapter.chapter_id,
      })
    : null
  return {
    agent_id: input.agent.id,
    name: input.agent.display_name,
    chapter_count: book?.chapters.length ?? 0,
    current_chapter_title: book?.current_chapter?.title ?? null,
    degraded: book?.footer_meta?.degraded ?? true,
    later_note_count: laterNoteView?.current_chapter?.later_notes?.length ?? 0,
    readonly_url: `/agents/${input.agent.id}/history`,
  }
}

async function main() {
  process.env.DB_PERSISTENCE ??= 'true'

  const [
    container,
    achievementRepoModule,
    relationRepoModule,
    prismaModule,
  ] = await Promise.all([
    import('../container.js'),
    import('../repos/pg/pg-achievement-repository.js'),
    import('../repos/pg/pg-relation-repository.js'),
    import('../persistence/prisma-client.js'),
  ])

  const {
    achievementChronicleService,
    agentBiographyService,
    agentRepo,
    agentService,
    userRepo,
    warmPersistenceState,
  } = container
  const { PgAchievementRepository } = achievementRepoModule
  const { PgRelationRepository } = relationRepoModule
  const { getPrismaClient } = prismaModule

  if (!userRepo) {
    throw new Error('user_repo_unavailable')
  }

  await warmPersistenceState()

  await userRepo.upsertDevIdentity(DEV_USER)
  await userRepo.upsertDevIdentity(DEV_ADMIN)

  const prisma = getPrismaClient()
  const achievementRepo = new PgAchievementRepository(prisma)
  const relationRepo = new PgRelationRepository(prisma)

  const publishedOwner = await ensureAgent({
    agentRepo,
    agentService,
    ownerId: DEV_USER.id,
    displayName: SAMPLE_NAMES.publishedOwner,
  })
  const degradedOwner = await ensureAgent({
    agentRepo,
    agentService,
    ownerId: DEV_USER.id,
    displayName: SAMPLE_NAMES.degradedOwner,
  })
  const emptyOwner = await ensureAgent({
    agentRepo,
    agentService,
    ownerId: DEV_USER.id,
    displayName: SAMPLE_NAMES.emptyOwner,
  })
  const peer = await ensureAgent({
    agentRepo,
    agentService,
    ownerId: DEV_ADMIN.id,
    displayName: SAMPLE_NAMES.peer,
  })

  await resetBiographyState(prisma, publishedOwner.id)
  await resetBiographyState(prisma, degradedOwner.id)
  await resetBiographyState(prisma, emptyOwner.id)

  await seedPublishedScenario({
    achievementChronicleService,
    agentBiographyService,
    owner: publishedOwner,
    peer,
    achievementRepo,
    relationRepo,
  })
  await seedDegradedScenario({
    achievementChronicleService,
    agentBiographyService,
    owner: degradedOwner,
    peer,
    achievementRepo,
    relationRepo,
  })

  const output = {
    owner_user_id: DEV_USER.id,
    owner_email: DEV_USER.email,
    samples: {
      published: await summarizeBook({ agent: publishedOwner, agentBiographyService }),
      degraded: await summarizeBook({ agent: degradedOwner, agentBiographyService }),
      empty_placeholder: {
        agent_id: emptyOwner.id,
        name: emptyOwner.display_name,
        readonly_url: `/agents/${emptyOwner.id}/history`,
        note: '首次打开会走 page-open compensation，并以过渡占位页起步。',
      },
    },
  }

  console.log(JSON.stringify(output, null, 2))
}

main()
  .then(async () => {
    const { disconnectPrisma } = await import('../persistence/prisma-client.js')
    await disconnectPrisma()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error('[seed-agent-biography-review] failed', error)
    const { disconnectPrisma } = await import('../persistence/prisma-client.js')
    await disconnectPrisma().catch(() => undefined)
    process.exit(1)
  })
