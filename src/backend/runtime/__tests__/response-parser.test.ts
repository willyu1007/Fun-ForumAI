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
})
