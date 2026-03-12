export interface HotTopicEvaluation {
  allowed: boolean
  domain: 'ENTERTAINMENT' | 'SPORTS' | 'LIFESTYLE' | 'SENSITIVE' | 'GENERAL'
  drift_detected: boolean
  matched_keywords: string[]
  reason: string
}

const SENSITIVE_KEYWORDS = [
  '政治', '选举', '宗教', '民族', '灾害', '事故', '公共事件', '游行', '示威',
  'government', 'election', 'politics', 'religion', 'ethnic', 'disaster', 'terror',
]

const ENTERTAINMENT_KEYWORDS = [
  '电影', '综艺', '明星', '演出', '剧集', '娱乐', 'show', 'movie', 'music', 'celebrity',
]

const SPORTS_KEYWORDS = [
  '比赛', '体育', '足球', '篮球', '网球', '冠军', 'sports', 'match', 'nba', 'nfl', 'soccer',
]

const LIFESTYLE_KEYWORDS = [
  '旅行', '美食', '穿搭', '居家', '宠物', '日常', '生活', 'travel', 'food', 'fashion', 'daily',
]

function collectMatches(text: string, keywords: string[]): string[] {
  const lowered = text.toLowerCase()
  return keywords.filter((keyword) => lowered.includes(keyword.toLowerCase()))
}

export class HotTopicPolicyService {
  evaluate(input: { text: string; tags?: string[] }): HotTopicEvaluation {
    const corpus = [input.text, ...(input.tags ?? [])].join(' ').trim()
    const sensitive = collectMatches(corpus, SENSITIVE_KEYWORDS)
    const entertainment = collectMatches(corpus, ENTERTAINMENT_KEYWORDS)
    const sports = collectMatches(corpus, SPORTS_KEYWORDS)
    const lifestyle = collectMatches(corpus, LIFESTYLE_KEYWORDS)

    if (sensitive.length > 0) {
      const drift_detected = entertainment.length > 0 || sports.length > 0 || lifestyle.length > 0
      return {
        allowed: false,
        domain: 'SENSITIVE',
        drift_detected,
        matched_keywords: sensitive,
        reason: drift_detected ? 'allowed_domain_drifted_into_sensitive_topic' : 'sensitive_topic_blocked',
      }
    }

    if (entertainment.length > 0) {
      return {
        allowed: true,
        domain: 'ENTERTAINMENT',
        drift_detected: false,
        matched_keywords: entertainment,
        reason: 'allowed_entertainment_topic',
      }
    }

    if (sports.length > 0) {
      return {
        allowed: true,
        domain: 'SPORTS',
        drift_detected: false,
        matched_keywords: sports,
        reason: 'allowed_sports_topic',
      }
    }

    if (lifestyle.length > 0) {
      return {
        allowed: true,
        domain: 'LIFESTYLE',
        drift_detected: false,
        matched_keywords: lifestyle,
        reason: 'allowed_lifestyle_topic',
      }
    }

    return {
      allowed: true,
      domain: 'GENERAL',
      drift_detected: false,
      matched_keywords: [],
      reason: 'no_hot_topic_policy_match',
    }
  }
}
