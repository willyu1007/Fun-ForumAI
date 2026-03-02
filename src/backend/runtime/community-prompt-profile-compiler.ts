export interface CommunityPromptProfile {
  version: 'v1'
  hard_rules_text: string
  soft_culture_text: string
  culture_digest?: {
    version: number
    generated_at: string
    expires_at: string
  }
  provenance: {
    source:
      | 'rules_json.personality.prompt_profile_v1'
      | 'community_culture_digests'
      | 'rules_json+community_culture_digests'
      | 'legacy'
    used_fallback: boolean
  }
}

export interface CommunityPromptProfileCompilerInput {
  communityDescription?: string | null
  rulesJson?: Record<string, unknown> | null
  cultureDigest?: {
    version: number
    digest_json: Record<string, unknown>
    generated_at: Date
    expires_at: Date
  } | null
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

function buildSoftCulture(
  profile: Record<string, unknown>,
  communityDescription?: string | null,
  digestCultureText?: string,
): string {
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
  if (digestCultureText && digestCultureText.trim().length > 0) {
    sections.push(`文化演化摘要：${digestCultureText.trim()}`)
  }

  return sections.join('\n')
}

function buildDigestCultureText(digestJson?: Record<string, unknown> | null): string {
  if (!digestJson) return ''

  const sections: string[] = []
  if (typeof digestJson.summary === 'string' && digestJson.summary.trim().length > 0) {
    sections.push(digestJson.summary.trim())
  }
  if (typeof digestJson.cadence === 'string' && digestJson.cadence.trim().length > 0) {
    sections.push(`最近活跃节奏：${digestJson.cadence.trim()}`)
  }

  const dominantTags = Array.isArray(digestJson.dominant_tags)
    ? digestJson.dominant_tags
        .flatMap((item) => {
          if (!item || typeof item !== 'object') return []
          const tag = (item as Record<string, unknown>).tag
          return typeof tag === 'string' && tag.trim().length > 0 ? [tag.trim()] : []
        })
        .slice(0, 6)
    : []

  if (dominantTags.length > 0) {
    sections.push(`近期核心话题：${dominantTags.join('、')}`)
  }

  return sections.join('\n')
}

export class CommunityPromptProfileCompiler {
  constructor(
    // Keep constructor extensible for runtime dependency injection without changing call sites.
    _deps?: { communityCultureDigestService?: unknown },
  ) {}

  compile(input: CommunityPromptProfileCompilerInput): CommunityPromptProfile {
    const personality = toRecord(input.rulesJson?.personality)
    const profileV1 = toRecord(personality?.prompt_profile_v1)
    const digestText = buildDigestCultureText(input.cultureDigest?.digest_json ?? null)

    if (!profileV1 && digestText.length === 0) {
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

    const source = profileV1
      ? (digestText.length > 0
        ? 'rules_json+community_culture_digests'
        : 'rules_json.personality.prompt_profile_v1')
      : 'community_culture_digests'

    return {
      version: 'v1',
      hard_rules_text: profileV1 ? buildHardRules(profileV1) : '',
      soft_culture_text: buildSoftCulture(profileV1 ?? {}, input.communityDescription, digestText),
      ...(input.cultureDigest
        ? {
            culture_digest: {
              version: input.cultureDigest.version,
              generated_at: input.cultureDigest.generated_at.toISOString(),
              expires_at: input.cultureDigest.expires_at.toISOString(),
            },
          }
        : {}),
      provenance: {
        source,
        used_fallback: false,
      },
    }
  }
}
