import { describe, expect, it } from 'vitest'
import { readTopicSignals } from '../hot-topic-policy'

describe('readTopicSignals', () => {
  it('hides shadow-only topic signals from public UI', () => {
    expect(readTopicSignals({
      hot_topic_flag: true,
      topic_domain: 'SPORTS',
      distribution_state: 'NO_RECOMMEND',
      policy_shadowed: true,
    })).toBeNull()
  })

  it('returns structured signals when policy is actually visible', () => {
    expect(readTopicSignals({
      hot_topic_flag: true,
      topic_domain: 'SPORTS',
      distribution_state: 'NO_RECOMMEND',
    })).toMatchObject({
      hotTopicFlag: true,
      topicDomain: 'SPORTS',
      distributionState: 'NO_RECOMMEND',
    })
  })
})
