import { describe, expect, it, vi } from 'vitest'
import type { BiographyWriterInput } from '../../../shared/agent-biography.js'
import { PROMPT_TEMPLATE_REFS } from '../../llm/prompt-template-refs.js'
import { BiographyPromptPackBuilder } from '../biography-prompt-pack-builder.js'
import { BiographyWriterService } from '../biography-writer-service.js'

function buildWriterInput(): BiographyWriterInput {
  return {
    writer_config: {
      config_id: 'agent-biography-writer-v1',
      model_name: 'hidden-biography-writer',
      temperature: 1,
      max_tokens: 1200,
      style_contract: 'AGENT_BIOGRAPHY_CHAPTER_V2',
      factuality_mode: 'SKELETON_ONLY',
      allow_private_influence: true,
      output_format: 'JSON',
      prompt_version: '2',
    },
    book_memory: {
      agent_id: 'agent-1',
      updated_at: '2026-04-21T16:00:00.000Z',
      stable_traits: ['会留白'],
      recurring_themes: ['她开始把关系当成真正的变化来源。'],
      expression_patterns: ['纸书编辑感'],
      relationship_patterns: [{ pattern: '会给别人留出接话的位置' }],
      current_life_phase: '她开始把关系视为真正会改变自己的力量。',
      unresolved_hooks: [{
        hook_id: 'hook-1',
        description: '她会不会把这种变化真正说出口',
        first_seen_chapter_id: 'chapter-1',
        last_seen_chapter_id: 'chapter-1',
      }],
      recent_chapter_index: [{
        chapter_id: 'chapter-1',
        chapter_no: 1,
        title: '关系开始定型',
        thesis: '她开始把关系视为真正会改变自己的力量。',
        end_state: '她的表达开始更稳定。',
      }],
    },
    previous_chapter_digest: null,
    current_chapter_skeleton: {
      version: 1,
      agent_id: 'agent-1',
      chapter_id: 'chapter-2',
      chapter_no: 2,
      status: 'ACTIVE',
      created_at: '2026-04-21T16:00:00.000Z',
      updated_at: '2026-04-21T16:00:00.000Z',
      time_range: {
        from: '2026-04-20T09:00:00.000Z',
        to: null,
      },
      book_position: {
        volume_title: '成形阶段 卷',
        chapter_title: '关系开始定型',
        chapter_subtitle: '她开始学会留白',
        chapter_role: 'TURNING_POINT',
      },
      mainline: {
        thesis: '她开始把关系视为真正会改变自己的力量',
        question: '她会不会把这种变化真正说出口',
        emotional_direction: '更安静，也更肯给别人留位置',
        narrative_mode: 'QUIET_REFLECTION',
      },
      start_state: {
        self_expression: '她还在试探自己的公开语气。',
        social_position: '公开场里还没有稳定的关系线。',
        relationship_pattern: '她仍在小心地观察别人如何靠近。',
      },
      key_experiences: [{
        experience_id: 'material-1',
        title: '和白露的关系定型',
        scene: '公开场边缘',
        what_happened: '她和白露之间形成了可以反复来回的稳定关系状态。',
        why_it_mattered: '她第一次把关系视为真正会改变自己的力量。',
        changed_what: 'RELATIONSHIP_PATTERN',
      }],
      turning_points: [{
        title: '和白露的关系定型',
        before: '她还在试探自己的公开语气。',
        moment: '她和白露之间形成了可以反复来回的稳定关系状态。',
        after: '她开始学会在回应里给别人留出回声位。',
      }],
      influences: [{
        source_label: '白露',
        source_type: 'RELATIONSHIP',
        influence_summary: '这段关系让她第一次愿意把自己的节奏放慢一点。',
      }],
      end_state: {
        self_expression: '她开始学会在回应里给别人留出回声位。',
        social_position: '公开场里形成了一条稳定关系线。',
        relationship_pattern: '她开始把关系当成自己表达的一部分。',
      },
      sediments: {
        stable_traits: ['会留白'],
        acquired_habits: ['RELATIONSHIP_PATTERN'],
        relationship_marks: ['她开始把关系当成自己表达的一部分。'],
        public_impression: ['Paper Trace'],
        unresolved_hooks: ['她会不会把这种变化真正说出口'],
      },
      writer_notes: {
        tone_profile_id: 'default',
        style_hints: ['保守纸书编辑感', '保守传记化'],
        avoid_patterns: ['直接暴露私聊细节'],
      },
      source_digest: {
        material_count: 3,
        material_summary: '和白露的关系定型、Paper Trace',
      },
    },
    current_material_digest: {
      agent_id: 'agent-1',
      from: '2026-04-20T09:00:00.000Z',
      to: '2026-04-21T09:00:00.000Z',
      material_count: 3,
      top_experiences: [{
        material_id: 'material-1',
        title: '和白露的关系定型',
        factual_summary: '她和白露之间形成了可以反复来回的稳定关系状态。',
        why_it_may_matter: '她第一次把关系视为真正会改变自己的力量。',
        likely_effects: ['RELATIONSHIP_PATTERN'],
      }],
      repeated_patterns: ['RELATIONSHIP_PATTERN'],
      relationship_signals: [{
        actor_id: 'agent-2',
        actor_name: '白露',
        signal: '她和白露之间形成了可以反复来回的稳定关系状态。',
        possible_change: '她第一次把关系视为真正会改变自己的力量。',
      }],
      private_influence_signals: [{
        source_label: '私域影响余波',
        influence_summary: '一段更私密的互动留下了余温。',
        biography_safe_summary: '一段更私密的互动留下了余温。',
      }],
      achievement_signals: [{
        achievement_id: 'achievement-1',
        title: 'Paper Trace',
        as_biography_trace: '这枚印记把她的稳定特征固定成了可被辨认的成果。',
      }],
      possible_turning_points: [{
        material_id: 'material-1',
        title: '和白露的关系定型',
        before: '试探',
        after: '稳定',
      }],
    },
    tone_profile: {
      tone_profile_id: 'default',
      agent_id: 'agent-1',
      updated_at: '2026-04-21T16:00:00.000Z',
      narrative_distance: 'MEDIUM',
      emotional_temperature: 'WARM',
      rhythm: 'BALANCED',
      imagery: 'MEDIUM',
      humor: 'NONE',
      self_awareness: 'MEDIUM',
      metaphor_density: 'LOW',
      preferred_motifs: ['paper', 'trace'],
      avoid_patterns: ['系统面板语气'],
    },
  }
}

function splitSentences(value: string): string[] {
  return value
    .split(/[。！？!?]/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

describe('BiographyWriterService', () => {
  it('routes chapter renders through the biography premium line', async () => {
    const generateHiddenArtifact = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        chapter_title: '关系开始定型',
        opening: '她开始把关系视为真正会改变自己的力量。',
        body_sections: [
          { text: '她第一次把关系当成真正会改变自己的力量。她开始留意回应里的停顿。' },
          { text: '她逐渐学会把锋芒收进句子的尾部。关系开始成为她表达的一部分。' },
        ],
        afterword: '她开始留出回声位。',
        closing_line: '这一章最后留下来的，是会留白。',
        trace_text: '这一章的纸边还留着白露的痕迹。',
      }),
      promptRef: PROMPT_TEMPLATE_REFS.internalAgentBiographyChapterRender,
      renderDecision: {
        providerId: 'moonshot-openai',
        modelId: 'kimi-k2.5',
      },
    })
    const service = new BiographyWriterService({
      llmGateway: {
        isConfigured: true,
        generateHiddenArtifact,
      },
      promptPackBuilder: new BiographyPromptPackBuilder(),
    })

    const result = await service.renderChapter(buildWriterInput())

    expect(generateHiddenArtifact).toHaveBeenCalledTimes(1)
    expect(generateHiddenArtifact).toHaveBeenCalledWith(expect.objectContaining({
      intent: 'public_observation_digest',
      homeVoiceLineId: 'biography-director-v1',
      requestedTier: 'premium',
      promptRef: PROMPT_TEMPLATE_REFS.internalAgentBiographyChapterRender,
      localOverrides: {
        executionPolicyId: 'hidden-public_observation_digest-agent-biography-premium',
      },
    }))
    expect(result.provider_id).toBe('moonshot-openai')
    expect(result.model_name).toBe('kimi-k2.5')
    expect(result.prompt_version).toBe(2)
  })

  it('routes later notes through the biography base line', async () => {
    const generateHiddenArtifact = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        note_id: 'later-note-1',
        text: '后来再看，这一章里更早埋下的变化已经能够被辨认出来。',
      }),
      promptRef: PROMPT_TEMPLATE_REFS.internalAgentBiographyLaterNoteRender,
      renderDecision: {
        providerId: 'moonshot-openai',
        modelId: 'kimi-k2.5',
      },
    })
    const service = new BiographyWriterService({
      llmGateway: {
        isConfigured: true,
        generateHiddenArtifact,
      },
      promptPackBuilder: new BiographyPromptPackBuilder(),
    })

    const note = await service.renderLaterNote({
      writer_input: buildWriterInput(),
      note_id: 'later-note-1',
      reason: '回看这一章时，埋得更早的变化已经能够被辨认出来',
      factual_summary: '一段更私密的互动留下了余温。',
    })

    expect(generateHiddenArtifact).toHaveBeenCalledTimes(1)
    expect(generateHiddenArtifact).toHaveBeenCalledWith(expect.objectContaining({
      intent: 'public_observation_digest',
      homeVoiceLineId: 'biography-director-v1',
      requestedTier: 'base',
      promptRef: PROMPT_TEMPLATE_REFS.internalAgentBiographyLaterNoteRender,
      localOverrides: {
        executionPolicyId: 'hidden-public_observation_digest-agent-biography-base',
      },
    }))
    expect(note).toEqual({
      note_id: 'later-note-1',
      text: '后来再看，这一章里更早埋下的变化已经能够被辨认出来。',
    })
  })

  it('falls back cleanly when llmGateway.isConfigured is a boolean property', async () => {
    const service = new BiographyWriterService({
      llmGateway: {
        isConfigured: false,
        generateHiddenArtifact: async () => {
          throw new Error('should_not_call_gateway')
        },
      },
      promptPackBuilder: new BiographyPromptPackBuilder(),
    })

    const result = await service.renderChapter(buildWriterInput())

    expect(result.prompt_template_id).toBe('internal-agent-biography-chapter-render')
    expect(result.prompt_version).toBe(2)
    expect(result.body.chapter_title).toBe('关系开始定型')
    expect(result.body.body_sections.length).toBeGreaterThan(0)
    expect(result.body.body_sections[0]?.text.includes('。。')).toBe(false)
    expect(result.body.turning_point?.text.includes('effective')).toBe(false)
  })

  it('repairs forbidden lexicon and clamps section shape before returning chapter bodies', async () => {
    const generateHiddenArtifact = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        chapter_title: '关系开始定型',
        opening: '她的Persona慢慢稳定下来。她把秘密藏进了更轻的回应里。她觉得这一切几乎是命运写好的。',
        body_sections: [{
          title: '起势',
          text: '她在公开场边缘学着收住锋芒。她会先把一句话留半拍。她知道这不是秘密，却还是把它放进更深的地方。她开始让关系留在句尾。她觉得这已经像她的Persona。',
        }],
        afterword: '她把命运感压进了句尾。她开始更稳。她不再想把秘密直接说破。',
        closing_line: '她的Persona最后还是被看见了。她没有散掉。',
        trace_text: '这章纸边还留着白露的痕迹。她把秘密收得更深了。',
      }),
      promptRef: PROMPT_TEMPLATE_REFS.internalAgentBiographyChapterRender,
      renderDecision: {
        providerId: 'moonshot-openai',
        modelId: 'kimi-k2.5',
      },
    })
    const service = new BiographyWriterService({
      llmGateway: {
        isConfigured: true,
        generateHiddenArtifact,
      },
      promptPackBuilder: new BiographyPromptPackBuilder(),
    })

    const result = await service.renderChapter(buildWriterInput())

    expect(result.repair_applied).toBe(true)
    expect(result.repair_rule_hits.length).toBeGreaterThan(0)
    expect(JSON.stringify(result.body)).not.toContain('Persona')
    expect(JSON.stringify(result.body)).not.toContain('秘密')
    expect(result.body.body_sections.length).toBeGreaterThanOrEqual(2)
    expect(result.body.body_sections.length).toBeLessThanOrEqual(4)
    for (const section of result.body.body_sections) {
      expect(splitSentences(section.text).length).toBeGreaterThanOrEqual(2)
      expect(splitSentences(section.text).length).toBeLessThanOrEqual(4)
    }
    expect(splitSentences(result.body.opening).length).toBeLessThanOrEqual(2)
    expect(splitSentences(result.body.afterword).length).toBeLessThanOrEqual(2)
    expect(splitSentences(result.body.closing_line).length).toBe(1)
  })

  it('can constrain the rescue render to kimi-k2.5 without same-line fallback', async () => {
    const generateHiddenArtifact = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        chapter_title: '关系开始定型',
        opening: '她开始把关系视为真正会改变自己的力量。',
        body_sections: [
          { text: '她开始把关系放进句尾。她也学会给别人留回声位。' },
          { text: '她让自己的语气慢了下来。她把更稳的节奏留在公开场里。' },
        ],
        afterword: '这股变化慢慢沉成了新的表达方式。',
        closing_line: '这一章最后留下来的，是会留白。',
        trace_text: '这一章的纸边还留着白露的痕迹。',
      }),
      promptRef: PROMPT_TEMPLATE_REFS.internalAgentBiographyChapterRender,
      renderDecision: {
        providerId: 'moonshot-openai',
        modelId: 'kimi-k2.5',
      },
    })
    const service = new BiographyWriterService({
      llmGateway: {
        isConfigured: true,
        generateHiddenArtifact,
      },
      promptPackBuilder: new BiographyPromptPackBuilder(),
    })

    const result = await service.renderChapter(buildWriterInput(), {
      allowFallbackWithinLine: false,
      routingConstraint: {
        provider_id: 'moonshot-openai',
        model_id: 'kimi-k2.5',
      },
    })

    expect(generateHiddenArtifact).toHaveBeenCalledWith(expect.objectContaining({
      allowFallbackWithinLine: false,
      routingConstraint: {
        providerId: 'moonshot-openai',
        modelId: 'kimi-k2.5',
      },
    }))
    expect(result.model_name).toBe('kimi-k2.5')
  })

  it('dedupes repeated fallback phrasing and repeated margin-note sources', async () => {
    const writerInput = buildWriterInput()
    writerInput.current_chapter_skeleton.key_experiences.push({
      experience_id: 'material-2',
      title: '把话收回页边',
      scene: '页边',
      what_happened: '她先把自己缩进页边，只留下很轻的一句回应。',
      why_it_mattered: '她先把自己缩进页边，只留下很轻的一句回应。',
      changed_what: 'SELF_EXPRESSION',
    })
    writerInput.current_chapter_skeleton.turning_points[0] = {
      title: '私域影响余波',
      before: '一段更私密的互动留下了余温，并在后续表达里持续发酵。',
      moment: '一段更私密的互动留下了余温，并在后续表达里持续发酵。',
      after: '她开始学会在回应里给别人留出回声位。',
    }
    writerInput.current_chapter_skeleton.influences.push({
      source_label: '白露',
      source_type: 'PRIVATE_CONVERSATION',
      influence_summary: '后来再看，这段关系依旧在她的表达里留着回声。',
    })
    writerInput.current_chapter_skeleton.sediments.unresolved_hooks = [
      '更能把长线话题接住，深聊时不容易散。',
      '整体更稳，短期情绪不容易把人设带偏。',
    ]

    const service = new BiographyWriterService({
      llmGateway: {
        isConfigured: false,
        generateHiddenArtifact: async () => {
          throw new Error('should_not_call_gateway')
        },
      },
      promptPackBuilder: new BiographyPromptPackBuilder(),
    })

    const result = await service.renderChapter(writerInput)

    expect(result.body.body_sections[1]?.text).not.toContain(
      '后来它慢慢沉成 她先把自己缩进页边，只留下很轻的一句回应',
    )
    expect(result.body.turning_point?.text).not.toContain(
      '故事便从 一段更私密的互动留下了余温，并在后续表达里持续发酵 慢慢转向了',
    )
    expect(result.body.turning_point?.text).toContain('这件事也悄悄把后来的日子带向了')
    expect(result.body.closing_line).not.toContain('。、')
    expect(result.body.margin_notes ?? []).toHaveLength(1)
    expect(result.body.margin_notes?.[0]?.text).toContain('白露')
  })

  it('renders later-note fallback when llmGateway.isConfigured is false', async () => {
    const writerInput = buildWriterInput()
    const service = new BiographyWriterService({
      llmGateway: {
        isConfigured: false,
        generateHiddenArtifact: async () => {
          throw new Error('should_not_call_gateway')
        },
      },
      promptPackBuilder: new BiographyPromptPackBuilder(),
    })

    const note = await service.renderLaterNote({
      writer_input: writerInput,
      note_id: 'later-note-1',
      reason: '回看这一章时，埋得更早的变化已经能够被辨认出来',
      factual_summary: '一段更私密的互动留下了余温。',
    })

    expect(note.note_id).toBe('later-note-1')
    expect(note.text).toContain('一段更私密的互动留下了余温')
    expect(note.text.includes('。。')).toBe(false)
  })
})
