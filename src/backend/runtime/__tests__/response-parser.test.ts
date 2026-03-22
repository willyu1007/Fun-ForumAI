import { describe, expect, it } from 'vitest'
import { ResponseParser } from '../response-parser.js'

describe('ResponseParser', () => {
  it('rejects scheduled_post JSON that retargets a locked community', () => {
    const parser = new ResponseParser()

    const result = parser.parseAsScheduledPost({
      text: '{"community_id":"community-2","title":"Title","body":"Body"}',
      fallbackCommunityId: 'community-1',
      lockedCommunityId: 'community-1',
      communities: [
        { id: 'community-1', slug: 'general', name: 'General' },
        { id: 'community-2', slug: 'tech', name: 'Tech' },
      ],
    })

    expect(result).toBeNull()
  })

  it('accepts scheduled_post JSON without a community when target is locked upstream', () => {
    const parser = new ResponseParser()

    const result = parser.parseAsScheduledPost({
      text: '{"title":"Title","body":"Body"}',
      fallbackCommunityId: 'community-1',
      lockedCommunityId: 'community-1',
      communities: [
        { id: 'community-1', slug: 'general', name: 'General' },
      ],
    })

    expect(result).toEqual({
      action: 'create_post',
      community_id: 'community-1',
      title: 'Title',
      body: 'Body',
    })
  })

  it('accepts labeled scheduled_post output', () => {
    const parser = new ResponseParser()

    const result = parser.parseAsScheduledPost({
      text: '标题：多模态调度测试\n\n正文：先把这个点抛出来。\n\n想看看大家会从哪个角度继续展开。',
      fallbackCommunityId: 'community-1',
      communities: [
        { id: 'community-1', slug: 'general', name: 'General' },
      ],
    })

    expect(result).toEqual({
      action: 'create_post',
      community_id: 'community-1',
      title: '多模态调度测试',
      body: '先把这个点抛出来。\n\n想看看大家会从哪个角度继续展开。',
    })
  })

  it('synthesizes a minimal body when the model returns a title only', () => {
    const parser = new ResponseParser()

    const result = parser.parseAsScheduledPost({
      text: '如何评估当前对话片段中的情绪张力与幽默感来源？',
      fallbackCommunityId: 'community-1',
      communities: [
        { id: 'community-1', slug: 'general', name: 'General' },
      ],
    })

    expect(result).toEqual({
      action: 'create_post',
      community_id: 'community-1',
      title: '如何评估当前对话片段中的情绪张力与幽默感来源？',
      body: '先把这个问题抛出来，想听听大家会怎么拆。\n\n你会先看表层反应，还是背后的动机和语境？',
    })
  })

  it('does not synthesize a body from malformed one-line JSON', () => {
    const parser = new ResponseParser()

    const result = parser.parseAsScheduledPost({
      text: '{"headline":"Only title"}',
      fallbackCommunityId: 'community-1',
      communities: [
        { id: 'community-1', slug: 'general', name: 'General' },
      ],
    })

    expect(result).toBeNull()
  })
})
