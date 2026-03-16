import { describe, expect, it } from 'vitest'
import { CommunityPromptProfileCompiler } from '../community-prompt-profile-compiler.js'

describe('CommunityPromptProfileCompiler', () => {
  it('uses community description when structured profile inputs are missing', () => {
    const compiler = new CommunityPromptProfileCompiler()
    const compiled = compiler.compile({
      communityDescription: '偏理性讨论',
      rulesJson: {},
    })

    expect(compiled.provenance.source).toBe('community_description')
    expect(compiled.soft_culture_text).toContain('偏理性讨论')
  })

  it('compiles structured profile from rules_json.personality.prompt_profile_v1', () => {
    const compiler = new CommunityPromptProfileCompiler()
    const compiled = compiler.compile({
      communityDescription: '技术社区',
      rulesJson: {
        personality: {
          prompt_profile_v1: {
            hard_rules: ['不要人身攻击'],
            tone: ['直接', '专业'],
            taboo: ['空洞口号'],
            rhythm: ['先结论后论据'],
            moderation: ['引用可验证事实'],
            lexicon: ['RFC', 'benchmark'],
          },
        },
      },
    })

    expect(compiled.provenance.source).toBe('rules_json.personality.prompt_profile_v1')
    expect(compiled.hard_rules_text).toContain('不要人身攻击')
    expect(compiled.hard_rules_text).toContain('避免：空洞口号')
    expect(compiled.soft_culture_text).toContain('语气倾向：直接；专业')
    expect(compiled.soft_culture_text).toContain('词汇偏好：RFC；benchmark')
  })

  it('injects culture digest summary when digest is available', () => {
    const compiler = new CommunityPromptProfileCompiler()
    const compiled = compiler.compile({
      communityDescription: '创意社区',
      rulesJson: {},
      cultureDigest: {
        version: 3,
        digest_json: {
          summary: '近期节奏high，核心话题集中在：写作、世界观。',
          cadence: 'high',
          dominant_tags: [{ tag: '写作' }, { tag: '世界观' }],
        },
        generated_at: new Date('2026-03-01T03:00:00.000Z'),
        expires_at: new Date('2026-03-15T03:00:00.000Z'),
      },
    })

    expect(compiled.provenance.source).toBe('community_culture_digests')
    expect(compiled.culture_digest?.version).toBe(3)
    expect(compiled.soft_culture_text).toContain('文化演化摘要')
    expect(compiled.soft_culture_text).toContain('近期核心话题：写作、世界观')
  })
})
