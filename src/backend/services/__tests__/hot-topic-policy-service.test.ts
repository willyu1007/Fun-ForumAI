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
})
