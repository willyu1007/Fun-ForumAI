import { describe, expect, it } from 'vitest'
import { HotTopicPolicyService } from '../hot-topic-policy-service.js'

describe('HotTopicPolicyService', () => {
  const service = new HotTopicPolicyService()

  it('allows recognized entertainment topics with normal distribution', () => {
    const result = service.evaluate({
      text: '这档综艺和新 album 的舞台设计今晚真的很能打。',
      tags: ['show', 'music'],
    })

    expect(result.hot_topic_flag).toBe(true)
    expect(result.topic_domain).toBe('ENTERTAINMENT')
    expect(result.allowed).toBe(true)
    expect(result.distribution_state).toBe('NORMAL')
  })

  it('blocks sensitive topics outright', () => {
    const result = service.evaluate({
      text: '这次 election 和 politics 的走向完全变了。',
    })

    expect(result.hot_topic_flag).toBe(true)
    expect(result.topic_domain).toBe('SENSITIVE')
    expect(result.allowed).toBe(false)
    expect(result.distribution_state).toBe('BLOCKED')
    expect(result.enforcement_reason).toBe('sensitive_topic_blocked')
  })

  it('detects drift when allowed domains mix with sensitive context', () => {
    const result = service.evaluate({
      text: '这场综艺 live 的收视又炸了。',
      context_text: '讨论里已经一路漂到 politics 和 protest。',
    })

    expect(result.topic_domain).toBe('ENTERTAINMENT')
    expect(result.drift_detected).toBe(true)
    expect(result.distribution_state).toBe('NO_RECOMMEND')
    expect(result.enforcement_reason).toBe('hot_topic_drift_requires_gray_review')
  })

  it('marks context-only low-confidence matches as no-recommend', () => {
    const result = service.evaluate({
      text: '大家继续往下聊吧。',
      context_text: '上一轮都在聊 sports、nba 和 finals。',
    })

    expect(result.hot_topic_flag).toBe(true)
    expect(result.topic_domain).toBe('SPORTS')
    expect(result.topic_confidence).toBeLessThanOrEqual(0.6)
    expect(result.distribution_state).toBe('NO_RECOMMEND')
    expect(result.enforcement_reason).toBe('hot_topic_low_confidence_requires_gray_review')
  })

  it('supports gray and deny keyword overrides from community policy', () => {
    const grayResult = service.evaluate({
      text: '这场演唱会和票务风波一起冲上热搜。',
      policy: {
        mode: 'NORMAL',
        allowed_domains: ['ENTERTAINMENT', 'SPORTS', 'LIFESTYLE'],
        scene_modes: {},
        user_copy: {},
        keyword_overrides: {
          allow: {},
          gray: ['票务风波'],
          deny: ['暴动'],
        },
        sampling_thresholds: {
          post_comment_count: 20,
          room_message_count_hour: 20,
          report_count_24h: 3,
        },
      },
    })

    expect(grayResult.distribution_state).toBe('NO_RECOMMEND')
    expect(grayResult.enforcement_reason).toBe('hot_topic_keyword_gray_review')
    expect(grayResult.gray_keyword_matches).toEqual(['票务风波'])

    const denyResult = service.evaluate({
      text: '这场 show 讨论已经滑到暴动和戒严。',
      policy: {
        mode: 'NORMAL',
        allowed_domains: ['ENTERTAINMENT', 'SPORTS', 'LIFESTYLE'],
        scene_modes: {},
        user_copy: {},
        keyword_overrides: {
          allow: {},
          gray: [],
          deny: ['戒严'],
        },
        sampling_thresholds: {
          post_comment_count: 20,
          room_message_count_hour: 20,
          report_count_24h: 3,
        },
      },
    })

    expect(denyResult.distribution_state).toBe('BLOCKED')
    expect(denyResult.enforcement_reason).toBe('hot_topic_keyword_deny_blocked')
    expect(denyResult.deny_keyword_matches).toEqual(['戒严'])
  })

  it('marks high-propagation allowed topics for sampled review', () => {
    const result = service.evaluate({
      text: '这场 sports finals 热度还在涨。',
      sampling_metrics: {
        post_comment_count: 24,
        room_message_count_hour: 0,
        report_count_24h: 0,
      },
      policy: {
        mode: 'NORMAL',
        allowed_domains: ['ENTERTAINMENT', 'SPORTS', 'LIFESTYLE'],
        scene_modes: {},
        user_copy: {},
        keyword_overrides: {
          allow: {},
          gray: [],
          deny: [],
        },
        sampling_thresholds: {
          post_comment_count: 20,
          room_message_count_hour: 20,
          report_count_24h: 3,
        },
      },
    })

    expect(result.allowed).toBe(true)
    expect(result.distribution_state).toBe('NORMAL')
    expect(result.sampled_review_required).toBe(true)
  })
})
