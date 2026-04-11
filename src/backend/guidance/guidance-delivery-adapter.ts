import { config } from '../lib/config.js'
import type { SseHub } from '../sse/hub.js'
import type { GuidanceActorRef } from './guidance-types.js'
import { toGuidanceActorChannelKey } from './http.js'

export class GuidanceDeliveryAdapter {
  constructor(private readonly sseHub: SseHub) {}

  publishUpdated(actor: GuidanceActorRef): void {
    if (!config.launch.capabilities.guidanceV1) return
    this.sseHub.broadcastToActor(toGuidanceActorChannelKey(actor), {
      type: 'GUIDANCE_UPDATED',
      payload: {},
    })
  }
}
