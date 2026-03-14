import { describe, expect, it } from 'vitest'
import { ChatroomSceneContractResolver } from '../chatroom-scene-contract-resolver.js'

describe('ChatroomSceneContractResolver', () => {
  it('falls back to deterministic legacy templates when no binding is available', () => {
    const resolver = new ChatroomSceneContractResolver({
      catalogService: {
        getLaunchCatalog: () => null,
      } as never,
    })

    const resolved = resolver.resolve({
      roomId: 'room-1',
      sceneType: 'TALK_SHOW',
    })

    expect(resolved.source).toBe('legacy_fallback')
    expect(resolved.binding).toBeNull()
    expect(resolved.template.template_id).toBe('legacy-chat-room-talk_show')
    expect(resolved.template.director.closing_policy.aftershow_mode).toBe('off')
    expect(resolved.selection_mode).toBe('autonomous_anchored')
  })
})
