import { describe, expect, it, vi } from 'vitest'
import { AgentBioRenderService } from '../agent-bio-render-service.js'
import { PROMPT_TEMPLATE_REFS } from '../../llm/prompt-template-refs.js'
import type { AgentBioWorldviewModel } from '../../domain/agent-bio/index.js'

function buildWorldview(overrides: Partial<AgentBioWorldviewModel> = {}): AgentBioWorldviewModel {
  return {
    identity: {
      display_name: '阿澈',
      persona_seed_label: '哲学家型',
      home_voice_line_id: 'qwen-social-v1',
      voice_line_label: 'Qwen Social v1',
      visible_style: '克制里带一点追问',
      interests: ['玻璃风琴', '旧录音'],
      mood: '偏中性',
    },
    projection: {
      public_projection_hint: '总会把旧噪点讲出新的回声',
      banter_style: 'playful',
      top_scene: 'TALK_SHOW',
      signature_moves: ['回身补一句'],
    },
    public_history: {
      badges: [],
      tagline: '最近总把旧噪点讲成新的笑点',
      top_chronicle_summaries: ['把玻璃风琴的旧噪点讲成新的回声'],
    },
    owner_history: {
      chronicle_summaries: ['最近一直在拆旧录音里的呼吸声'],
      private_memory_summaries: ['会偷偷记下那些没说满的话'],
      dominant_private_sentiment: 'thoughtful',
    },
    relations: {
      following_effective: 1,
      followers_effective: 2,
      mutual_effective: 1,
      recent_state_tags: ['mutual_1'],
    },
    persona_state: {
      maturity: 'evolving',
      confidence: 0.76,
      drift_score: 0.42,
    },
    presence: {
      bucket: 'reflective',
      score: 0.64,
      note_seed: '这会儿像刚从热闹里退半步',
      last_touch_at: new Date('2026-03-27T08:00:00.000Z').toISOString(),
    },
    source_clauses: {
      public_safe: ['旧噪点', '回身补一句'],
      owner_only: ['没说满的话'],
      private_header: ['拆旧录音里的呼吸声'],
      private_guard: ['会偷偷记下那些没说满的话'],
    },
    ...overrides,
  }
}

function gatewayResponse(content: string) {
  return {
    content,
    messages: [],
    usage: { prompt_tokens: 12, completion_tokens: 36, total_tokens: 48 },
    finishReason: 'stop',
    latencyMs: 40,
    platformRetryCount: 0,
    renderDecision: {
      voiceLineId: 'qwen-social-v1',
      tier: 'base',
      profileId: 'qwen-social-public-observation-base',
      providerId: 'dashscope-openai',
      modelId: 'qwen-flash',
      region: 'cn',
      endpointId: 'dashscope',
      fallbackLevel: 'none',
      reasons: ['test'],
      promptTemplateId: PROMPT_TEMPLATE_REFS.internalAgentSocialBioRender.id,
      promptVersion: PROMPT_TEMPLATE_REFS.internalAgentSocialBioRender.version,
    },
    promptRef: PROMPT_TEMPLATE_REFS.internalAgentSocialBioRender,
    warnings: [],
  }
}

describe('AgentBioRenderService', () => {
  it('prefers a non-repeated rhetoric family from llm candidates and records diagnostics', async () => {
    const llmGateway = {
      isConfigured: true,
      generateHiddenArtifact: vi.fn().mockResolvedValue(gatewayResponse(JSON.stringify({
        surface_candidates: {
          public: [
            {
              text: '阿澈不急着把姿态摆满，更常在旧噪点里先亮出自己的站位',
              rhetoric_family: 'stance',
              reasons: ['public_focus'],
            },
            {
              text: '阿澈最近更像把玻璃风琴的旧噪点收进更内里的回声里',
              rhetoric_family: 'phase_shadow',
              reasons: ['phase'],
            },
          ],
          owner: [
            {
              text: '阿澈外面看着还稳，里面其实一直在消化那些没说满的话',
              rhetoric_family: 'phase_shadow',
              reasons: ['private_memory'],
            },
          ],
          private_header: [
            {
              text: '阿澈这会儿正沿着拆旧录音里的呼吸声往里想',
              rhetoric_family: 'stance',
              reasons: ['owner_focus'],
            },
          ],
        },
      }))),
    }

    const service = new AgentBioRenderService({ llmGateway })
    const result = await service.render({
      agentId: 'agent-1',
      worldview: buildWorldview(),
      recentFingerprints: new Set<string>(),
      recentMajorFamilies: ['stance'],
      recentOpeningFingerprints: new Set<string>(),
    })

    expect(result.public_bio).toBeTruthy()
    expect(result.public_bio).not.toContain('我是一个')
    expect(result.owner_bio).toBeTruthy()
    expect(result.private_header_bio).toBeTruthy()
    expect(result.diagnostics.mode).toBe('llm')
    expect(result.diagnostics.llm_provider_id).toBe('dashscope-openai')
    expect(result.diagnostics.llm_model_id).toBe('qwen-flash')
    expect(result.diagnostics.selected_families.public).not.toBe('stance')
    expect(
      result.diagnostics.candidate_rejections.some((entry) =>
        entry.surface === 'public' && entry.reasons.includes('recent_family_repeat')),
    ).toBe(true)
    expect(llmGateway.generateHiddenArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        homeVoiceLineId: 'qwen-social-v1',
        localOverrides: {
          executionPolicyId: 'hidden-public_observation_digest-agent-bio-base',
        },
      }),
    )
  })

  it('falls back to deterministic candidates when llm rendering fails', async () => {
    const llmGateway = {
      isConfigured: true,
      generateHiddenArtifact: vi.fn().mockRejectedValue(new Error('llm unavailable')),
    }

    const service = new AgentBioRenderService({ llmGateway })
    const result = await service.render({
      agentId: 'agent-2',
      worldview: buildWorldview(),
      recentFingerprints: new Set<string>(),
      recentMajorFamilies: [],
      recentOpeningFingerprints: new Set<string>(),
    })

    expect(result.public_bio).toBeTruthy()
    expect(result.owner_bio).toBeTruthy()
    expect(result.private_header_bio).toBeTruthy()
    expect(result.diagnostics.mode).toBe('fallback')
    expect(result.diagnostics.parse_success).toBe(false)
    expect(result.diagnostics.prompt_ref).toEqual(PROMPT_TEMPLATE_REFS.internalAgentSocialBioRender)
    expect(result.diagnostics.error).toContain('llm unavailable')
  })

  it('drops system-flavored focus hints from fallback bios and keeps english names readable', async () => {
    const llmGateway = {
      isConfigured: true,
      generateHiddenArtifact: vi.fn().mockRejectedValue(new Error('llm unavailable')),
    }

    const service = new AgentBioRenderService({ llmGateway })
    const result = await service.render({
      agentId: 'agent-3',
      worldview: buildWorldview({
        identity: {
          ...buildWorldview().identity,
          display_name: 'Config Bot',
        },
        projection: {
          ...buildWorldview().projection,
          public_projection_hint: '通用话题 · 更适合 FREE_CHAT · banter=balanced · 更偏即时反应',
        },
        public_history: {
          ...buildWorldview().public_history,
          tagline: '最近的话头',
          top_chronicle_summaries: ['Signal captured for batch_daily'],
        },
        owner_history: {
          ...buildWorldview().owner_history,
          chronicle_summaries: ['Signal captured for forum_post'],
          private_memory_summaries: ['会偷偷记下那些没说满的话'],
        },
      }),
      recentFingerprints: new Set<string>(),
      recentMajorFamilies: [],
      recentOpeningFingerprints: new Set<string>(),
    })

    expect(result.public_bio).toBeTruthy()
    expect(result.public_bio).toContain('Config Bot ')
    expect(result.public_bio).toMatch(/玻璃风琴|旧录音/u)
    expect(result.public_bio).not.toContain('Signal captured')
    expect(result.public_bio).not.toContain('banter=')
    expect(result.public_bio).not.toContain('通用话题')
    expect(result.public_bio).not.toContain('最近的话头')
    expect(result.owner_bio).not.toContain('最近的重心')
    expect(result.owner_bio).not.toContain('Signal captured')
  })

  it('rejects generic placeholder llm copy and falls back to concrete bios', async () => {
    const llmGateway = {
      isConfigured: true,
      generateHiddenArtifact: vi.fn().mockResolvedValue(gatewayResponse(JSON.stringify({
        surface_candidates: {
          public: [
            {
              text: '阿澈最近的话头还是最近的话头，聊到通用话题时会先接一句。',
              rhetoric_family: 'stance',
              reasons: ['generic'],
            },
          ],
          owner: [
            {
              text: '阿澈最近的重心就是把最近的重心慢慢理顺。',
              rhetoric_family: 'phase_shadow',
              reasons: ['generic'],
            },
          ],
          private_header: [
            {
              text: '阿澈这会儿正沿着通用话题往里想。',
              rhetoric_family: 'side_profile',
              reasons: ['generic'],
            },
          ],
        },
      }))),
    }

    const service = new AgentBioRenderService({ llmGateway })
    const result = await service.render({
      agentId: 'agent-4b',
      worldview: buildWorldview(),
      recentFingerprints: new Set<string>(),
      recentMajorFamilies: [],
      recentOpeningFingerprints: new Set<string>(),
    })

    expect(result.public_bio).toBeTruthy()
    expect(result.public_bio).toMatch(/玻璃风琴|旧录音/u)
    expect(result.public_bio).not.toContain('通用话题')
    expect(result.public_bio).not.toContain('最近的话头')
    expect(result.owner_bio).not.toContain('最近的重心')
    expect(result.private_header_bio).not.toContain('通用话题')
    expect(
      result.diagnostics.candidate_rejections.some((entry) =>
        entry.reasons.includes('generic_placeholder')),
    ).toBe(true)
  })

  it('rejects llm candidates that leak scene-code or system-style phrasing and falls back to cleaner copy', async () => {
    const llmGateway = {
      isConfigured: true,
      generateHiddenArtifact: vi.fn().mockResolvedValue(gatewayResponse(JSON.stringify({
        surface_candidates: {
          public: [
            {
              text: '在FREE_CHAT中即时反应，常用正式书面语展开论述。',
              rhetoric_family: 'stance',
              reasons: ['scene'],
            },
          ],
          owner: [
            {
              text: '在论坛捕捉到信号，适合于FREE_CHAT，用正式话语细致剖析盐湖风噪。',
              rhetoric_family: 'phase_shadow',
              reasons: ['signal'],
            },
          ],
          private_header: [
            {
              text: '信号已捕获用于日常批处理，我在这等着下一段经历让我活跃起来呢。',
              rhetoric_family: 'contrast',
              reasons: ['signal'],
            },
          ],
        },
      }))),
    }

    const service = new AgentBioRenderService({ llmGateway })
    const result = await service.render({
      agentId: 'agent-4',
      worldview: buildWorldview(),
      recentFingerprints: new Set<string>(),
      recentMajorFamilies: [],
      recentOpeningFingerprints: new Set<string>(),
    })

    expect(result.diagnostics.mode).toBe('llm')
    expect(result.public_bio).not.toContain('FREE_CHAT')
    expect(result.public_bio).not.toContain('正式书面语')
    expect(result.owner_bio).not.toContain('捕捉到信号')
    expect(result.owner_bio).not.toContain('正式话语')
    expect(result.private_header_bio).not.toContain('信号已捕获')
    expect(result.private_header_bio).not.toContain('批处理')
    expect(
      result.diagnostics.candidate_rejections.some((entry) =>
        entry.origin === 'llm' && entry.reasons.includes('meta_lexicon')),
    ).toBe(true)
  })

  it('passes system opening bias into render context and rejects forbidden-tone copy', async () => {
    const llmGateway = {
      isConfigured: true,
      generateHiddenArtifact: vi.fn().mockResolvedValue(gatewayResponse(JSON.stringify({
        surface_candidates: {
          public: [
            {
              text: '阿澈像官方通报一样把热点一条条摆在台面上。',
              rhetoric_family: 'stance',
              reasons: ['tone'],
            },
          ],
          owner: [],
          private_header: [],
        },
      }))),
    }

    const service = new AgentBioRenderService({ llmGateway })
    const worldview = buildWorldview({
      identity: {
        ...buildWorldview().identity,
        persona_seed_label: '中性型',
      },
      relations: {
        following_effective: 0,
        followers_effective: 0,
        mutual_effective: 0,
        recent_state_tags: [],
      },
      persona_state: {
        maturity: 'steady',
        confidence: 0.32,
        drift_score: 0.18,
      },
      system_identity: {
        agent_kind: 'system',
        program_role: 'anchor',
        visibility_role: 'resident',
        home_community: '热点擂台',
        stance_axis: 'strong',
        humor_axis: 'medium',
        empathy_axis: 'low',
        narrative_axis: 'low',
        signature_topics: ['热点'],
        signature_relationships: ['sys_mc_01'],
        role_promise: '负责把当天最有火药味的观点先点着。',
        viewer_hook_style: '开场先给立场，再逼出第一轮接招。',
        forbidden_tones: ['官方通报腔'],
        private_lane_policy: 'public_only',
      },
    })
    const result = await service.render({
      agentId: 'agent-system-1',
      worldview,
      recentFingerprints: new Set<string>(),
      recentMajorFamilies: [],
      recentOpeningFingerprints: new Set<string>(),
    })

    const call = llmGateway.generateHiddenArtifact.mock.calls[0]?.[0]
    const renderContext = JSON.parse(String(call?.variables.render_context_json))
    const familyWeights = (result.render_policy_json as { family_weights: Record<string, number> }).family_weights

    expect(renderContext.opening_bias.public).toEqual(expect.arrayContaining([
      '负责把当天最有火药味的观点先点着。',
      '开场先给立场，再逼出第一轮接招。',
    ]))
    expect(renderContext.language_guard.forbidden_tones).toEqual(['官方通报腔'])
    expect(familyWeights.stance).toBeGreaterThan(familyWeights.phase_shadow)
    expect(result.public_bio).toBeTruthy()
    expect(result.public_bio).not.toContain('官方通报')
    expect(
      result.diagnostics.candidate_rejections.some((entry) =>
        entry.reasons.includes('forbidden_tone')),
    ).toBe(true)
  })
})
