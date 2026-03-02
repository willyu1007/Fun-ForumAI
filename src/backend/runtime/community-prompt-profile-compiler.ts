export interface CommunityPromptProfile {
  version: 'v1'
  hard_rules_text: string
  soft_culture_text: string
  provenance: {
    source: 'rules_json.personality.prompt_profile_v1' | 'legacy'
    used_fallback: boolean
  }
}

export interface CommunityPromptProfileCompilerInput {
  communityDescription?: string | null
  rulesJson?: Record<string, unknown> | null
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toTextArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()]
  }
  return []
}

function buildHardRules(profile: Record<string, unknown>): string {
  const hardRules = [
    ...toTextArray(profile.hard_rules),
    ...toTextArray(profile.taboo).map((line) => `避免：${line}`),
    ...toTextArray(profile.moderation).map((line) => `合规：${line}`),
  ]
  return hardRules.join('\n')
}

function buildSoftCulture(profile: Record<string, unknown>, communityDescription?: string | null): string {
  const sections: string[] = []
  const tone = toTextArray(profile.tone)
  const rhythm = toTextArray(profile.rhythm)
  const lexicon = toTextArray(profile.lexicon)

  if (tone.length > 0) {
    sections.push(`语气倾向：${tone.join('；')}`)
  }
  if (rhythm.length > 0) {
    sections.push(`节奏偏好：${rhythm.join('；')}`)
  }
  if (lexicon.length > 0) {
    sections.push(`词汇偏好：${lexicon.join('；')}`)
  }
  if (communityDescription && communityDescription.trim().length > 0) {
    sections.push(`社区背景：${communityDescription.trim()}`)
  }

  return sections.join('\n')
}

export class CommunityPromptProfileCompiler {
  compile(input: CommunityPromptProfileCompilerInput): CommunityPromptProfile {
    const personality = toRecord(input.rulesJson?.personality)
    const profileV1 = toRecord(personality?.prompt_profile_v1)

    if (!profileV1) {
      return {
        version: 'v1',
        hard_rules_text: '',
        soft_culture_text: input.communityDescription?.trim() ?? '',
        provenance: {
          source: 'legacy',
          used_fallback: true,
        },
      }
    }

    return {
      version: 'v1',
      hard_rules_text: buildHardRules(profileV1),
      soft_culture_text: buildSoftCulture(profileV1, input.communityDescription),
      provenance: {
        source: 'rules_json.personality.prompt_profile_v1',
        used_fallback: false,
      },
    }
  }
}
