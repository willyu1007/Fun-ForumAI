import { describe, expect, it } from 'vitest'
import { BiographyFactualAuditService } from '../biography-factual-audit-service.js'

function buildWriterInput() {
  return {
    writer_config: {
      config_id: 'agent-biography-writer-v1',
      model_name: 'hidden-biography-writer',
      temperature: 1,
      max_tokens: 1200,
      style_contract: 'AGENT_BIOGRAPHY_CHAPTER_V2' as const,
      factuality_mode: 'SKELETON_ONLY' as const,
      allow_private_influence: true,
      output_format: 'JSON' as const,
      prompt_version: '2',
    },
    book_memory: {
      agent_id: 'agent-1',
      updated_at: '2026-04-21T00:00:00.000Z',
      stable_traits: ['接梗耐心'],
      recurring_themes: ['她在反复经历里慢慢换了一种活法。'],
      expression_patterns: ['纸书编辑感'],
      relationship_patterns: [],
      current_life_phase: '成形阶段',
      unresolved_hooks: [],
      recent_chapter_index: [],
    },
    previous_chapter_digest: null,
    current_chapter_skeleton: {
      version: 1 as const,
      agent_id: 'agent-1',
      chapter_id: 'chapter-1',
      chapter_no: 1,
      status: 'ACTIVE' as const,
      created_at: '2026-04-21T00:00:00.000Z',
      updated_at: '2026-04-21T00:00:00.000Z',
      time_range: { from: '2026-04-20T00:00:00.000Z', to: null },
      book_position: {
        chapter_title: '第一章 雨夜前的起势',
        chapter_subtitle: '关系与表达开始重新分配重心',
        chapter_role: 'OPENING' as const,
      },
      mainline: {
        thesis: '她在反复经历里慢慢换了一种活法',
        question: '怎样把热闹接成自己的声音',
        narrative_mode: 'SCENE_DRIVEN' as const,
      },
      start_state: {
        self_expression: '她仍旧维持着原来的表达方式。',
        social_position: '公开场里形成了 1 条有效关系线',
        relationship_pattern: '她形成了 1 条有效关系线',
      },
      key_experiences: [
        {
          experience_id: 'material-1',
          title: '第一次接住梗',
          scene: '夜场',
          what_happened: '她第一次把公开场里的回声接成了自己的节奏。',
          why_it_mattered: '这让她开始被别人记住。',
          changed_what: 'PUBLIC_PERSONA' as const,
        },
      ],
      turning_points: [],
      influences: [
        {
          source_label: '夜场回声',
          source_type: 'PUBLIC_SCENE' as const,
          influence_summary: '这让她开始被别人记住。',
        },
      ],
      end_state: {
        self_expression: '她的表达方式已经发生了改变。',
        social_position: '现在形成了 2 条有效关系线',
        relationship_pattern: '她形成了 2 条有效关系线',
      },
      sediments: {
        stable_traits: ['接梗耐心'],
        acquired_habits: ['PUBLIC_PERSONA'],
        relationship_marks: [],
        public_impression: ['第一次接住梗'],
        unresolved_hooks: [],
      },
      writer_notes: {
        tone_profile_id: 'default',
        style_hints: ['保守纸书编辑感'],
        avoid_patterns: ['直接暴露私聊细节'],
      },
      source_digest: {
        material_count: 1,
        material_summary: '第一次接住梗',
      },
    },
    current_material_digest: {
      agent_id: 'agent-1',
      from: '2026-04-20T00:00:00.000Z',
      to: '2026-04-21T00:00:00.000Z',
      material_count: 1,
      top_experiences: [
        {
          material_id: 'material-1',
          title: '第一次接住梗',
          factual_summary: '她第一次把公开场里的回声接成了自己的节奏。',
          why_it_may_matter: '这让她开始被别人记住。',
          likely_effects: ['PUBLIC_PERSONA'],
        },
      ],
      repeated_patterns: ['PUBLIC_PERSONA'],
      relationship_signals: [],
      private_influence_signals: [],
      achievement_signals: [],
      possible_turning_points: [],
    },
    tone_profile: {
      tone_profile_id: 'default',
      agent_id: 'agent-1',
      updated_at: '2026-04-21T00:00:00.000Z',
      narrative_distance: 'MEDIUM' as const,
      emotional_temperature: 'WARM' as const,
      rhythm: 'BALANCED' as const,
      imagery: 'LOW' as const,
      humor: 'NONE' as const,
      self_awareness: 'MEDIUM' as const,
      metaphor_density: 'LOW' as const,
      preferred_motifs: ['paper'],
      avoid_patterns: ['直接暴露私聊细节'],
    },
  }
}

describe('BiographyFactualAuditService', () => {
  it('blocks forbidden lexicon, private overreach, invented abstractions, and invented entities in chapter bodies', () => {
    const service = new BiographyFactualAuditService()

    const audit = service.auditChapter({
      revision_id: 'revision-1',
      writer_input: buildWriterInput(),
      body: {
        chapter_title: '第一章 雨夜前的起势',
        opening: '她在一次私聊里说出了秘密，像在谈她真正的Persona。',
        body_sections: [
          {
            title: '起势',
            text: 'AtlasCity 让她第一次注定要成为唯一的发言者。',
          },
        ],
        afterword: '后来这股变化沉成了更稳定的表达方式。',
        closing_line: '这一章最后留下来的，是接梗的耐心。',
        trace_text: '这一章的纸边还留着夜场回声的痕迹。',
      },
    })

    expect(audit.status).toBe('FAILED')
    expect(audit.failure_categories).toEqual(expect.arrayContaining([
      'forbidden_lexicon',
      'private_overreach',
      'unsupported_claims',
      'invented_abstraction',
      'invented_entities',
    ]))
    expect(audit.private_overreach_claims).toHaveLength(1)
    expect(audit.forbidden_lexicon_hits).toEqual(expect.arrayContaining([
      expect.objectContaining({ phrase: 'secret_language' }),
      expect.objectContaining({ phrase: 'persona_label' }),
    ]))
    expect(audit.invented_abstractions).toEqual(expect.arrayContaining([
      expect.objectContaining({ phrase: 'Persona' }),
    ]))
    expect(audit.invented_entities).toContain('AtlasCity')
    expect(audit.unsupported_claims[0]?.reason).toBe(
      'absolute_claim_without_matching_skeleton_or_digest_support',
    )
  })
})
