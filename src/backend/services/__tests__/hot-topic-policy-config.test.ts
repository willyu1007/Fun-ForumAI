import { describe, expect, it } from 'vitest'
import {
  lintHotTopicPolicyV1,
  readCommunityHotTopicPolicyV1,
} from '../hot-topic-policy-config.js'

describe('hot-topic-policy-config', () => {
  it('normalizes keyword overrides and sampling thresholds', () => {
    const policy = readCommunityHotTopicPolicyV1({
      hot_topic_policy_v1: {
        mode: 'MANUAL_REVIEW_ONLY',
        allowed_domains: ['ENTERTAINMENT'],
        scene_modes: {
          room_talk_show: 'DISABLED',
        },
        user_copy: {
          summary: '热点先灰度复核。',
        },
        keyword_overrides: {
          allow: {
            SPORTS: ['nba finals'],
          },
          gray: ['票务争议'],
          deny: ['戒严'],
        },
        sampling_thresholds: {
          post_thread_turn_count: 12,
          room_message_count_hour: 18,
          report_count_24h: 2,
        },
      },
    })

    expect(policy.mode).toBe('MANUAL_REVIEW_ONLY')
    expect(policy.keyword_overrides.allow.SPORTS).toEqual(['nba finals'])
    expect(policy.keyword_overrides.gray).toEqual(['票务争议'])
    expect(policy.keyword_overrides.deny).toEqual(['戒严'])
    expect(policy.sampling_thresholds).toEqual({
      post_thread_turn_count: 12,
      room_message_count_hour: 18,
      report_count_24h: 2,
    })
  })

  it('rejects invalid sampling threshold and keyword override payloads', () => {
    const errors = lintHotTopicPolicyV1({
      mode: 'NORMAL',
      allowed_domains: ['ENTERTAINMENT'],
      scene_modes: {},
      user_copy: {},
      keyword_overrides: {
        allow: {
          SPORTS: [],
        },
        gray: '',
        deny: [''],
      },
      sampling_thresholds: {
        post_thread_turn_count: -1,
        room_message_count_hour: 'bad',
        report_count_24h: 2,
      },
    } as never)

    expect(errors).toContain('hot_topic_policy_v1.keyword_overrides.gray must be a non-empty string array')
    expect(errors).toContain('hot_topic_policy_v1.keyword_overrides.deny must be a non-empty string array')
    expect(errors).toContain('hot_topic_policy_v1.sampling_thresholds.post_thread_turn_count must be a non-negative number')
  })
})
