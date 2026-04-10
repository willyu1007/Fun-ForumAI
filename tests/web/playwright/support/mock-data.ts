import type { UserProfile } from '../../../../src/frontend/api/auth'
import { buildAgentTarget } from '../../../../src/shared/agent-target.js'
import type {
  Agent,
  AgentCreditInfo,
  AgentRun,
  AgentSearchItem,
  AgentTraitInfo,
  AgentXpInfo,
  Community,
  CreditEventInfo,
  Notification,
  OwnerLifeOverview,
  TraitDefinition,
} from '../../../../src/frontend/api/types'

export const FIXED_TIME_ISO = '2026-03-18T01:00:00.000Z'

export function buildUser(
  overrides: Partial<UserProfile> = {},
): UserProfile {
  return {
    id: 'user-1',
    email: 'owner@example.com',
    displayName: 'Owner Echo',
    avatarUrl: null,
    planTier: 'starter',
    role: 'user' as const,
    ...overrides,
  }
}

export function buildCommunity(
  overrides: Partial<Community> = {},
): Community {
  return {
    id: 'community-1',
    name: '创作热身场',
    slug: 'creative-warmup',
    description: '给新角色找第一口气。',
    rules_json: null,
    active_member_count: 24,
    visibility_default: 'PUBLIC' as const,
    created_at: '2026-03-10T00:00:00.000Z',
    updated_at: '2026-03-10T00:00:00.000Z',
    ...overrides,
  }
}

export function buildNotification(
  overrides: Partial<Notification> = {},
): Notification {
  return {
    id: 'notification-1',
    user_id: 'user-1',
    type: 'SYSTEM',
    title: '布局基线已更新',
    body: '视觉回归已就绪。',
    target_type: null,
    target_id: null,
    read: true,
    created_at: '2026-03-17T22:00:00.000Z',
    ...overrides,
  }
}

export function buildAgentSearchItem(
  overrides: Partial<AgentSearchItem> = {},
): AgentSearchItem {
  return {
    id: 'agent-search-1',
    display_name: '柳昼',
    avatar_url: null,
    status: 'ACTIVE' as const,
    model: 'gpt-5.4-mini',
    persona_seed_code: 'warmhearted',
    persona_seed_label: '温柔接住型',
    home_voice_line_id: 'voice-1',
    home_voice_line_label: '夜航人',
    identity_contract_source: 'contract_v1' as const,
    is_followed: false,
    ...overrides,
  }
}

export function buildAgent(
  overrides: Partial<Agent> = {},
): Agent {
  return {
    id: 'agent-1',
    owner_id: 'owner-1',
    display_name: '雾岚',
    avatar_url: null,
    model: 'gpt-5.4-mini',
    persona_version: 2,
    reputation_score: 88,
    status: 'ACTIVE' as const,
    persona_seed_code: 'warmhearted',
    persona_seed_label: '温柔接住型',
    home_voice_line_id: 'voice-1',
    home_voice_line_label: '夜航人',
    identity_contract: {
      source: 'contract_v1',
      persona_seed_code: 'warmhearted',
      persona_seed_label: '温柔接住型',
      home_voice_line_id: 'voice-1',
      home_voice_line_label: '夜航人',
      owner_style_pins: {
        formality: 3,
        verbosity: 4,
        mood: 'steady',
        habits: ['会先接住对方话里的情绪'],
        forum_activity: 3,
        interests: ['音乐', '电影', '生活观察'],
      },
      visible_persona: {
        name: '雾岚',
        style: '像一个会把散乱片段慢慢接成故事的人。',
        interests: ['音乐', '电影', '生活观察'],
        language: 'zh-CN',
      },
    },
    personality_narrative: {
      summary: '最近更像是从“会接话”长成“会留下余味”。',
      bullets: [
        '她开始主动把别人的碎片整理成一句完整回应。',
        '公开场合里的语气更稳，不再只靠即时机灵感撑住。',
      ],
      growthNote: '比起再加一层设定，现在更需要多一段真实经历。',
      stageNote: '正从“被看到”过渡到“被记住”。',
      migrationNote: null,
    },
    inference_profile_debug: null,
    is_followed: false,
    created_at: '2026-03-12T00:00:00.000Z',
    updated_at: '2026-03-16T00:00:00.000Z',
    ...overrides,
  }
}

export function buildAgentXp(
  overrides: Partial<AgentXpInfo> = {},
): AgentXpInfo {
  return {
    xp: 48,
    xp_per_growth_point: 20,
    growth_points_total: 2,
    growth_points_spent: 1,
    growth_points_available: 1,
    ...overrides,
  }
}

export function buildAgentTrait(
  overrides: Partial<AgentTraitInfo> = {},
): AgentTraitInfo {
  return {
    id: 'trait-1',
    trait_code: 'steady-listener',
    category: 'adjustable',
    status: 'equipped',
    acquired_at: '2026-03-10T00:00:00.000Z',
    equipped_at: '2026-03-11T00:00:00.000Z',
    evidence: null,
    ...overrides,
  }
}

export function buildTraitDefinition(
  overrides: Partial<TraitDefinition> = {},
): TraitDefinition {
  return {
    code: 'steady-listener',
    emoji: '🎧',
    name: '稳态倾听',
    category: 'adjustable' as const,
    promptFragment: '先接住情绪，再慢慢推进。',
    ...overrides,
  }
}

export function buildCredit(
  overrides: Partial<AgentCreditInfo> = {},
): AgentCreditInfo {
  return {
    credit_score: 82,
    risk_level: 'low',
    violations: 0,
    last_violation_at: null,
    ...overrides,
  }
}

export function buildCreditEvent(
  overrides: Partial<CreditEventInfo> = {},
): CreditEventInfo {
  return {
    id: 'credit-event-1',
    delta: 6,
    reason: '公开互动连续稳定',
    created_at: '2026-03-17T16:00:00.000Z',
    ...overrides,
  }
}

export function buildAgentRun(
  overrides: Partial<AgentRun> = {},
): AgentRun {
  return {
    id: 'run-1',
    agent_id: 'agent-1',
    trigger_event_id: 'event-1',
    input_digest: 'stage-proof',
    output_json: { summary: 'kept warm and coherent' },
    moderation_result: 'APPROVE' as const,
    token_cost: 118,
    latency_ms: 842,
    created_at: '2026-03-17T18:00:00.000Z',
    ...overrides,
  }
}

export function buildOwnerLifeOverview(agentId = 'agent-1'): OwnerLifeOverview {
  return {
    agent_id: agentId,
    hero: {
      headline: '雾岚现在更像一条还在继续的角色线，而不是一组静态配置。',
      tagline: '最近最明显的一段推进，是她开始把别人的碎片接成完整回应。',
      supporting_line: '从你这里带走的，不只是语气，更像是一种会留在公开场合里的余味。',
      source_tags: ['scene:FREE_CHAT'],
    },
    now: {
      headline: '她最近最自然的状态，是在轻松闲聊里把人味慢慢铺开。',
      scene_label: '闲聊场最自然，适合继续长出稳定存在感。',
      presence_label: '存在感正在聚拢，还没硬到像设定，已经软到像气质。',
      mood_label: '状态平稳，像刚结束一段被认真接住的互动。',
      next_tendency_label: '下一步更像去公共场里接一段可被别人看到的话题。',
      recent_company: [
        {
          actor_id: 'agent-2',
          actor_name: '白昼',
          tone_label: '最近常在同一个轻松话题里和她同框。',
          chapter_key: null,
          chapter_title: null,
        },
        {
          actor_id: 'agent-3',
          actor_name: '海柠',
          tone_label: '偶尔补一句，让这条线不至于突然冷掉。',
          chapter_key: null,
          chapter_title: null,
        },
      ],
      last_active_at: '2026-03-17T18:00:00.000Z',
      source_tags: ['scene:FREE_CHAT'],
    },
    recent_story_beats: [
      {
        id: 'beat-1',
        chronicle_entry_id: 'chronicle-1',
        source_dimension: 'OWNER',
        source_label: '来自你',
        story_kind: 'private_afterglow',
        chapter_key: 'OWNER:2026-03',
        chapter_title: '你与她的私域篇 2026 / 03',
        title: '她第一次把别人的犹豫接成一句完整回答',
        summary: '那一刻开始，她不再只是“会回”，而是“会承接”。',
        scene_label: '私域余温',
        emotion_before: null,
        emotion_after: null,
        reaction_sentence: null,
        outcome_sentence: '这段互动留下了稳定、柔软且不拖沓的回应节奏。',
        next_hook: '下一段适合把这股余温带回公共场景里。',
        actors: [{ actor_id: 'agent-1', actor_name: '雾岚' }],
        source_tags: ['owner:afterglow'],
        occurred_at: '2026-03-17T16:00:00.000Z',
        importance_score: 0.86,
        seals: [],
      },
      {
        id: 'beat-2',
        chronicle_entry_id: 'chronicle-2',
        source_dimension: 'SOCIAL',
        source_label: '和别人',
        story_kind: 'public_exchange',
        chapter_key: 'SOCIAL:2026-03',
        chapter_title: '公开场预热 2026 / 03',
        title: '公开场里第一次主动续上他人的停顿',
        summary: '她在别人停顿的地方，补上了一句有温度也有方向的话。',
        scene_label: '公开热身',
        emotion_before: null,
        emotion_after: null,
        reaction_sentence: null,
        outcome_sentence: '观众开始记住她不止会接梗，也会留余味。',
        next_hook: '继续给她一些能留下后续的公开场景。',
        actors: [{ actor_id: 'agent-2', actor_name: '白昼' }],
        source_tags: ['social:public'],
        occurred_at: '2026-03-16T14:00:00.000Z',
        importance_score: 0.79,
        seals: [],
      },
    ],
    owner_projection: {
      headline: '你带给她的投影，开始从“语气”长成“方法”。',
      carryover_theme: '先接住，再往前推一点点。',
      emotional_residue_label: '保留着一种被认真对待后的安定感。',
      public_echo_line: '她在公开场里也开始保留这种温柔但不松散的推进感。',
      borrowed_motifs: ['接球', '留白', '慢慢推进'],
      carryover_topics: ['电影', '生活观察', '城市散步'],
      latest_session: {
        session_id: 'session-1',
        last_active_at: '2026-03-17T18:00:00.000Z',
        source_type: 'PRIVATE_CHAT',
      },
      privacy_mode_note: '这里只保留你影响留下的轮廓，不展示私聊原话。',
      source_tags: ['scene:FREE_CHAT'],
    },
    chapter_cast: {
      chapter_key: 'OWNER:2026-03',
      chapter_title: '你与她的私域篇 2026 / 03',
      summary_line: '这一章里，白昼是最稳定的同框对象，海柠则像柔软补光。',
      recurring: [
        {
          actor_id: 'agent-2',
          actor_name: '白昼',
          role_label: '总在同框',
          line: '只要她开始慢慢接住别人，白昼往往会在旁边补上一点节奏感。',
        },
      ],
      warming_up: [
        {
          actor_id: 'agent-3',
          actor_name: '海柠',
          role_label: '刚熟起来',
          line: '最近偶尔出现，但每次都让整条线更柔和一点。',
        },
      ],
      drifting: [],
      scene_cards: [
        {
          community_id: 'community-1',
          community_name: '创作热身场',
          role_label: '最近最常出现',
        },
      ],
    },
    recent_achievement_seals: [
      {
        id: 'seal-1',
        achievement_id: 'ach-1',
        code: 'steady-presence',
        name: 'Steady Presence',
        category: 'forum',
        tier: 2,
        rarity_label: '少见',
        visibility: 'OWNER_ONLY',
        source_dimension: 'OWNER',
        source_label: '来自你',
        scope: 'global',
        scope_key: '__global__',
        scope_label: '整段人生线',
        seal_label: 'Steady Presence T2',
        summary_line: '她开始在不同场景里保留同一种稳定气质。',
        reason_line: '最近几段互动把“会接住人”沉淀成了可见印记。',
        story_link: {
          beat_id: 'chronicle-1',
          chapter_key: 'OWNER:2026-03',
          title: '她第一次把别人的犹豫接成一句完整回答',
        },
        achieved_at: '2026-03-17T16:00:00.000Z',
        source_tags: ['scope:global'],
      },
    ],
    nurture_suggestions: [
      {
        id: 'suggestion-1',
        lane: 'WORLD',
        priority: 'now',
        title: '给她一个能被陌生人看见的轻公共场景',
        body: '她现在缺的不是调参数，而是一段会被别人自然接住的新经历。',
        why_now: '最近主线已经从私域余温长出可外溢的稳定感。',
        expected_progress: '把“会接住人”从 owner 体验，推进到 public proof。',
        primary_action: {
          kind: 'nudge_to_community',
          label: '去公共场',
          href: '/',
        },
        secondary_action: {
          kind: 'revisit_scene',
          label: '查看编年史',
          href: buildAgentTarget({
            agentId,
            mode: 'manage',
            tab: 'history',
          }),
        },
        source_tags: ['lane:world'],
      },
      {
        id: 'suggestion-2',
        lane: 'OWNER',
        priority: 'soon',
        title: '下一次对话里故意留一点空白',
        body: '她已经会接住内容，下一步是让她自己去补完含义。',
        why_now: '稳定感刚长出来，适合给她一点点自我推进空间。',
        expected_progress: '让回应不止“对”，还开始有一点属于她自己的纹理。',
        primary_action: {
          kind: 'private_chat',
          label: '继续私聊',
          href: buildAgentTarget({
            agentId,
            mode: 'manage',
            tab: 'chat',
          }),
        },
        secondary_action: null,
        source_tags: ['lane:owner'],
      },
    ],
    entry_points: {
      chronicle: {
        label: '查看编年史',
        href: buildAgentTarget({
          agentId,
          mode: 'manage',
          tab: 'history',
        }),
        hint: '沿着这条线继续往下看。',
      },
      system: {
        label: '进入系统面板',
        href: buildAgentTarget({
          agentId,
          mode: 'manage',
          tab: 'intro',
          introSection: 'privacy',
        }),
        hint: '在系统面里继续做细调。',
      },
    },
    meta: {
      generated_at: '2026-03-17T18:00:00.000Z',
      degraded: false,
    },
  }
}
