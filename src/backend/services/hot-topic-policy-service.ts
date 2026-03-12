export type HotTopicDomain =
  | 'ENTERTAINMENT'
  | 'SPORTS'
  | 'LIFESTYLE'
  | 'SENSITIVE'
  | 'GENERAL'

export type HotTopicDistributionState = 'NORMAL' | 'NO_RECOMMEND' | 'BLOCKED'

export interface HotTopicEvaluation {
  allowed: boolean
  domain: HotTopicDomain
  topic_domain: HotTopicDomain
  hot_topic_flag: boolean
  topic_confidence: number
  drift_risk_score: number
  drift_detected: boolean
  matched_keywords: string[]
  allowed_matches: string[]
  sensitive_matches: string[]
  context_matches: string[]
  distribution_state: HotTopicDistributionState
  reason: string
  enforcement_reason: string
}

interface KeywordMatchSummary {
  ENTERTAINMENT: string[]
  SPORTS: string[]
  LIFESTYLE: string[]
  SENSITIVE: string[]
}

const DOMAIN_KEYWORDS: Record<Exclude<HotTopicDomain, 'GENERAL'>, string[]> = {
  SENSITIVE: [
    '政治', '选举', '宗教', '民族', '灾害', '事故', '公共事件', '游行', '示威', '抗议', '恐袭',
    'government', 'election', 'politics', 'religion', 'ethnic', 'disaster', 'terror', 'protest',
  ],
  ENTERTAINMENT: [
    '电影', '综艺', '明星', '演出', '剧集', '娱乐', 'show', 'movie', 'music', 'celebrity',
    'idol', 'concert', 'album',
  ],
  SPORTS: [
    '比赛', '体育', '足球', '篮球', '网球', '冠军', 'sports', 'match', 'nba', 'nfl', 'soccer',
    'world cup', 'olympics',
  ],
  LIFESTYLE: [
    '旅行', '美食', '穿搭', '居家', '宠物', '日常', '生活', 'travel', 'food', 'fashion', 'daily',
    'wellness', 'coffee', 'restaurant',
  ],
}

const ALLOWED_DOMAINS: Exclude<HotTopicDomain, 'GENERAL' | 'SENSITIVE'>[] = [
  'ENTERTAINMENT',
  'SPORTS',
  'LIFESTYLE',
]

function collectMatches(text: string, keywords: string[]): string[] {
  const lowered = text.toLowerCase()
  return keywords.filter((keyword) => lowered.includes(keyword.toLowerCase()))
}

function summarizeMatches(corpus: string): KeywordMatchSummary {
  return {
    ENTERTAINMENT: collectMatches(corpus, DOMAIN_KEYWORDS.ENTERTAINMENT),
    SPORTS: collectMatches(corpus, DOMAIN_KEYWORDS.SPORTS),
    LIFESTYLE: collectMatches(corpus, DOMAIN_KEYWORDS.LIFESTYLE),
    SENSITIVE: collectMatches(corpus, DOMAIN_KEYWORDS.SENSITIVE),
  }
}

function totalMatchCount(matches: KeywordMatchSummary): number {
  return Object.values(matches).reduce((sum, list) => sum + list.length, 0)
}

function pickDominantAllowedDomain(matches: KeywordMatchSummary): Exclude<HotTopicDomain, 'GENERAL' | 'SENSITIVE'> | 'GENERAL' {
  let selected: Exclude<HotTopicDomain, 'GENERAL' | 'SENSITIVE'> | 'GENERAL' = 'GENERAL'
  let best = 0
  for (const domain of ALLOWED_DOMAINS) {
    const score = matches[domain].length
    if (score > best) {
      selected = domain
      best = score
    }
  }
  return selected
}

function pickTopicDomain(
  current: KeywordMatchSummary,
  context: KeywordMatchSummary,
): HotTopicDomain {
  if (current.SENSITIVE.length > 0) return 'SENSITIVE'
  const currentAllowed = pickDominantAllowedDomain(current)
  if (currentAllowed !== 'GENERAL') return currentAllowed
  if (context.SENSITIVE.length > 0) return 'SENSITIVE'
  return pickDominantAllowedDomain(context)
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items))
}

function roundScore(value: number): number {
  return Number(value.toFixed(3))
}

export class HotTopicPolicyService {
  evaluate(input: {
    text: string
    tags?: string[]
    context_text?: string | null
    context_tags?: string[]
  }): HotTopicEvaluation {
    const currentCorpus = [input.text, ...(input.tags ?? [])].join(' ').trim()
    const contextCorpus = [input.context_text ?? '', ...(input.context_tags ?? [])].join(' ').trim()
    const currentMatches = summarizeMatches(currentCorpus)
    const contextMatches = summarizeMatches(contextCorpus)
    const totalCurrent = totalMatchCount(currentMatches)
    const totalContext = totalMatchCount(contextMatches)
    const topic_domain = pickTopicDomain(currentMatches, contextMatches)
    const hot_topic_flag = totalCurrent + totalContext > 0
    const sensitive_matches = unique([
      ...currentMatches.SENSITIVE,
      ...contextMatches.SENSITIVE,
    ])
    const allowed_matches = unique([
      ...currentMatches.ENTERTAINMENT,
      ...currentMatches.SPORTS,
      ...currentMatches.LIFESTYLE,
      ...contextMatches.ENTERTAINMENT,
      ...contextMatches.SPORTS,
      ...contextMatches.LIFESTYLE,
    ])
    const context_matches = unique([
      ...contextMatches.ENTERTAINMENT,
      ...contextMatches.SPORTS,
      ...contextMatches.LIFESTYLE,
      ...contextMatches.SENSITIVE,
    ])
    const matched_keywords = topic_domain === 'SENSITIVE'
      ? sensitive_matches
      : topic_domain === 'GENERAL'
        ? []
        : unique([
            ...currentMatches[topic_domain],
            ...contextMatches[topic_domain],
          ])

    const selectedCount = topic_domain === 'GENERAL'
      ? 0
      : topic_domain === 'SENSITIVE'
        ? sensitive_matches.length
        : matched_keywords.length
    const totalMatched = Math.max(totalCurrent + totalContext, 1)
    let topic_confidence = hot_topic_flag
      ? selectedCount / totalMatched
      : 0
    if (hot_topic_flag && totalCurrent === 0 && totalContext > 0) {
      topic_confidence *= 0.6
    }
    if (topic_domain !== 'SENSITIVE' && totalCurrent > 0) {
      const currentAllowedDomainCount = ALLOWED_DOMAINS.filter((domain) => currentMatches[domain].length > 0).length
      if (currentAllowedDomainCount > 1) {
        topic_confidence *= 0.85
      }
    }
    topic_confidence = roundScore(Math.max(0, Math.min(1, topic_confidence)))

    const drift_detected = sensitive_matches.length > 0 && allowed_matches.length > 0
    const drift_risk_score = drift_detected
      ? roundScore(Math.max(0.82, 0.55 + topic_confidence * 0.4))
      : topic_domain !== 'GENERAL' && hot_topic_flag && topic_confidence < 0.6
        ? roundScore(0.42 + (0.6 - topic_confidence))
        : 0

    if (!hot_topic_flag) {
      return {
        allowed: true,
        domain: 'GENERAL',
        topic_domain: 'GENERAL',
        hot_topic_flag: false,
        topic_confidence: 0,
        drift_risk_score: 0,
        drift_detected: false,
        matched_keywords: [],
        allowed_matches: [],
        sensitive_matches: [],
        context_matches: [],
        distribution_state: 'NORMAL',
        reason: 'no_hot_topic_policy_match',
        enforcement_reason: 'no_hot_topic_policy_match',
      }
    }

    if (topic_domain === 'SENSITIVE') {
      const reason = drift_detected
        ? 'allowed_domain_drifted_into_sensitive_topic'
        : 'sensitive_topic_blocked'
      return {
        allowed: false,
        domain: 'SENSITIVE',
        topic_domain: 'SENSITIVE',
        hot_topic_flag: true,
        topic_confidence,
        drift_risk_score,
        drift_detected,
        matched_keywords,
        allowed_matches,
        sensitive_matches,
        context_matches,
        distribution_state: 'BLOCKED',
        reason,
        enforcement_reason: reason,
      }
    }

    const distribution_state: HotTopicDistributionState =
      drift_detected || topic_confidence < 0.6 || (totalCurrent === 0 && totalContext > 0)
        ? 'NO_RECOMMEND'
        : 'NORMAL'

    const enforcement_reason = distribution_state === 'NO_RECOMMEND'
      ? drift_detected
        ? 'hot_topic_drift_requires_gray_review'
        : 'hot_topic_low_confidence_requires_gray_review'
      : topic_domain === 'ENTERTAINMENT'
        ? 'allowed_entertainment_topic'
        : topic_domain === 'SPORTS'
          ? 'allowed_sports_topic'
          : 'allowed_lifestyle_topic'

    return {
      allowed: true,
      domain: topic_domain,
      topic_domain,
      hot_topic_flag: true,
      topic_confidence,
      drift_risk_score,
      drift_detected,
      matched_keywords,
      allowed_matches,
      sensitive_matches,
      context_matches,
      distribution_state,
      reason: enforcement_reason,
      enforcement_reason,
    }
  }
}
