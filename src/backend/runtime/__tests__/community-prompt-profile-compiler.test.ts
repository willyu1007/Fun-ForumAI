import { describe, expect, it } from 'vitest'
import { CommunityPromptProfileCompiler } from '../community-prompt-profile-compiler.js'

describe('CommunityPromptProfileCompiler', () => {
  it('falls back to legacy mode when prompt profile is missing', () => {
    const compiler = new CommunityPromptProfileCompiler()
    const compiled = compiler.compile({
      communityDescription: '偏理性讨论',
      rulesJson: {},
    })

    expect(compiled.provenance.source).toBe('legacy')
    expect(compiled.provenance.used_fallback).toBe(true)
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
})
