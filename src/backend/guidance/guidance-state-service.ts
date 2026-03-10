import {
  guidanceStagePriority,
  guidanceTrackPriority,
  type GuidanceActorStateRepository,
} from '../repos/guidance-state-repository.js'
import type { GuidanceInboxRepository } from '../repos/guidance-inbox-repository.js'
import type {
  GuidanceActorRef,
  GuidanceActorView,
  GuidanceChecklistItemView,
  GuidanceChecklistModule,
  GuidanceInboxView,
  GuidanceResolvedActor,
  GuidanceSummaryView,
} from './guidance-types.js'
import {
  type GuidanceActorStateEntity,
  type GuidanceInboxItemEntity,
  type GuidanceTrack,
} from '../repos/types.js'
import { GUIDANCE_MODULE_TYPES, GUIDANCE_REASON_CODES, type GuidanceReasonCode } from './reason-codes.js'
import { GuidanceCopyService } from './guidance-copy-service.js'
import { toGuidanceItemCardView } from './guidance-types.js'

function firstDate(...values: Array<Date | null | undefined>): Date | null {
  const found = values.filter((value): value is Date => value instanceof Date)
  if (found.length === 0) return null
  return found.sort((a, b) => a.getTime() - b.getTime())[0]
}

function maxDate(...values: Array<Date | null | undefined>): Date | null {
  const found = values.filter((value): value is Date => value instanceof Date)
  if (found.length === 0) return null
  return found.sort((a, b) => b.getTime() - a.getTime())[0]
}

function deriveStage(state: GuidanceActorStateEntity): GuidanceActorStateEntity['stage'] {
  if (state.watch_public_effect_at) return 'RETAINED'
  if (state.nurture_receipt_ready_at || (state.followed_first_agent_at && state.following_feed_seen_at)) {
    return 'FIRST_SUCCESS'
  }
  if (
    state.explained_two_tracks
    || state.followed_first_agent_at
    || state.agent_created_at
    || state.private_session_created_at
  ) {
    return 'EXPLORING'
  }
  return 'NEW_VISITOR'
}

function pickTrack(...tracks: GuidanceTrack[]): GuidanceTrack {
  return tracks.sort((a, b) => guidanceTrackPriority(b) - guidanceTrackPriority(a))[0] ?? 'UNDECIDED'
}

export class GuidanceStateService {
  constructor(
    private readonly stateRepo: GuidanceActorStateRepository,
    private readonly inboxRepo: GuidanceInboxRepository,
    private readonly copyService: GuidanceCopyService,
  ) {}

  async getOrCreateActorState(actor: GuidanceActorRef): Promise<GuidanceActorStateEntity> {
    const existing = await this.stateRepo.findByActor(actor.actor_type, actor.actor_id)
    if (existing) return existing
    return this.stateRepo.upsert(actor)
  }

  async saveActorState(
    actor: GuidanceActorRef,
    patch: Partial<Omit<GuidanceActorStateEntity, 'id' | 'actor_type' | 'actor_id' | 'created_at' | 'updated_at'>>,
  ): Promise<GuidanceActorStateEntity> {
    const existing = await this.getOrCreateActorState(actor)
    const merged = {
      current_track: patch.current_track ?? existing.current_track,
      stage: patch.stage ?? existing.stage,
      explained_two_tracks: patch.explained_two_tracks ?? existing.explained_two_tracks,
      followed_first_agent_at: patch.followed_first_agent_at !== undefined ? patch.followed_first_agent_at : existing.followed_first_agent_at,
      following_feed_seen_at: patch.following_feed_seen_at !== undefined ? patch.following_feed_seen_at : existing.following_feed_seen_at,
      agent_created_at: patch.agent_created_at !== undefined ? patch.agent_created_at : existing.agent_created_at,
      private_session_created_at: patch.private_session_created_at !== undefined ? patch.private_session_created_at : existing.private_session_created_at,
      private_session_ended_at: patch.private_session_ended_at !== undefined ? patch.private_session_ended_at : existing.private_session_ended_at,
      nurture_receipt_ready_at: patch.nurture_receipt_ready_at !== undefined ? patch.nurture_receipt_ready_at : existing.nurture_receipt_ready_at,
      watch_public_effect_at: patch.watch_public_effect_at !== undefined ? patch.watch_public_effect_at : existing.watch_public_effect_at,
      latest_owner_agent_id: patch.latest_owner_agent_id !== undefined ? patch.latest_owner_agent_id : existing.latest_owner_agent_id,
      latest_receipt_session_id: patch.latest_receipt_session_id !== undefined ? patch.latest_receipt_session_id : existing.latest_receipt_session_id,
    }

    return this.stateRepo.upsert({
      actor_type: actor.actor_type,
      actor_id: actor.actor_id,
      ...merged,
      stage: deriveStage({
        ...existing,
        ...merged,
        stage: existing.stage,
        updated_at: existing.updated_at,
      } as GuidanceActorStateEntity),
    })
  }

  async mergeVisitorIntoUser(visitorId: string, userId: string): Promise<void> {
    if (!visitorId || !userId || visitorId === userId) return

    const userActor: GuidanceActorRef = { actor_type: 'USER', actor_id: userId }
    const [visitorState, userState, visitorItems, userItems] = await Promise.all([
      this.stateRepo.findByActor('VISITOR', visitorId),
      this.stateRepo.findByActor('USER', userId),
      this.inboxRepo.listByActor('VISITOR', visitorId),
      this.inboxRepo.listByActor('USER', userId),
    ])

    if (visitorState) {
      const combinedBase = userState ?? await this.getOrCreateActorState(userActor)
      await this.stateRepo.upsert({
        actor_type: 'USER',
        actor_id: userId,
        current_track: pickTrack(combinedBase.current_track, visitorState.current_track),
        stage: guidanceStagePriority(visitorState.stage) > guidanceStagePriority(combinedBase.stage)
          ? visitorState.stage
          : combinedBase.stage,
        explained_two_tracks: combinedBase.explained_two_tracks || visitorState.explained_two_tracks,
        followed_first_agent_at: firstDate(combinedBase.followed_first_agent_at, visitorState.followed_first_agent_at),
        following_feed_seen_at: firstDate(combinedBase.following_feed_seen_at, visitorState.following_feed_seen_at),
        agent_created_at: firstDate(combinedBase.agent_created_at, visitorState.agent_created_at),
        private_session_created_at: firstDate(combinedBase.private_session_created_at, visitorState.private_session_created_at),
        private_session_ended_at: maxDate(combinedBase.private_session_ended_at, visitorState.private_session_ended_at),
        nurture_receipt_ready_at: maxDate(combinedBase.nurture_receipt_ready_at, visitorState.nurture_receipt_ready_at),
        watch_public_effect_at: maxDate(combinedBase.watch_public_effect_at, visitorState.watch_public_effect_at),
        latest_owner_agent_id: combinedBase.latest_owner_agent_id ?? visitorState.latest_owner_agent_id,
        latest_receipt_session_id: combinedBase.latest_receipt_session_id ?? visitorState.latest_receipt_session_id,
      })
    }

    const existingKeys = new Set(userItems.map((item) => item.dedup_key).filter((item): item is string => Boolean(item)))
    for (const item of visitorItems) {
      if (item.dedup_key && existingKeys.has(item.dedup_key)) continue
      await this.inboxRepo.upsert({
        actor_type: 'USER',
        actor_id: userId,
        module_type: item.module_type,
        reason_code: item.reason_code,
        status: item.status,
        dedup_key: item.dedup_key,
        unread: item.unread,
        title: item.title,
        body: item.body,
        cta_label: item.cta_label,
        cta_target: item.cta_target,
        payload_json: item.payload_json,
        related_agent_id: item.related_agent_id,
        related_session_id: item.related_session_id,
      })
    }

    await Promise.all([
      this.stateRepo.deleteByActor('VISITOR', visitorId),
      this.inboxRepo.deleteByActor('VISITOR', visitorId),
    ])
  }

  async listInbox(actor: GuidanceActorRef): Promise<GuidanceInboxView> {
    const items = await this.inboxRepo.listByActor(actor.actor_type, actor.actor_id)
    return {
      items: items.map(toGuidanceItemCardView),
      unread_count: items.filter((item) => item.unread && item.status === 'ACTIVE').length,
    }
  }

  async getItem(actor: GuidanceActorRef, itemId: string): Promise<GuidanceInboxItemEntity | null> {
    const item = await this.inboxRepo.findById(itemId)
    if (!item || item.actor_type !== actor.actor_type || item.actor_id !== actor.actor_id) {
      return null
    }
    return item
  }

  async buildSummary(actor: GuidanceResolvedActor): Promise<GuidanceSummaryView> {
    const state = await this.getOrCreateActorState(actor)
    const inboxItems = await this.inboxRepo.listByActor(actor.actor_type, actor.actor_id, {
      statuses: ['ACTIVE'],
      limit: 8,
    })
    const activeReasons = new Set(inboxItems.map((item) => item.reason_code))
    const actorView = this.toActorView(state)
    const modules: GuidanceSummaryView['modules'] = [
      {
        type: GUIDANCE_MODULE_TYPES.DUAL_ENTRY,
        reason_code: GUIDANCE_REASON_CODES.HOME_DUAL_ENTRY,
        hero_body: this.copyService.getHeroBody(),
        cards: this.copyService.getDualEntryCards(),
      },
    ]

    const checklist = this.buildChecklist(state, inboxItems)
    if (checklist) {
      modules.push(checklist)
      for (const item of checklist.items) {
        activeReasons.add(item.reason_code)
      }
    }

    for (const item of inboxItems) {
      if (item.reason_code === GUIDANCE_REASON_CODES.WATCH_PUBLIC_EFFECT || item.reason_code === GUIDANCE_REASON_CODES.FOLLOWED_AGENT_STORY_ESCALATED || item.module_type === 'RECEIPT') {
        modules.push({
          type: item.module_type,
          item: toGuidanceItemCardView(item),
        })
      } else if (!activeReasons.has(item.reason_code)) {
        modules.push({
          type: item.module_type,
          item: toGuidanceItemCardView(item),
        })
      }
    }

    return { actor: actorView, modules }
  }

  async markItem(actor: GuidanceActorRef, itemId: string, action: 'open' | 'dismiss' | 'complete'): Promise<GuidanceInboxItemEntity | null> {
    const item = await this.inboxRepo.findById(itemId)
    if (!item || item.actor_type !== actor.actor_type || item.actor_id !== actor.actor_id) {
      return null
    }

    if (action === 'open') {
      return this.inboxRepo.update({ id: itemId, unread: false })
    }
    if (action === 'dismiss') {
      return this.inboxRepo.update({ id: itemId, unread: false, status: 'DISMISSED' })
    }
    return this.inboxRepo.update({ id: itemId, unread: false, status: 'COMPLETED' })
  }

  private toActorView(state: GuidanceActorStateEntity): GuidanceActorView {
    const firstSuccessAt = state.nurture_receipt_ready_at
      ?? (state.followed_first_agent_at && state.following_feed_seen_at ? state.following_feed_seen_at : null)
    return {
      actor_type: state.actor_type,
      actor_id: state.actor_id,
      current_track: state.current_track,
      stage: state.stage,
      explained: {
        two_tracks: state.explained_two_tracks,
      },
      completed: {
        followed_first_agent: Boolean(state.followed_first_agent_at),
        used_following_feed: Boolean(state.following_feed_seen_at),
        created_agent: Boolean(state.agent_created_at),
        started_private_chat: Boolean(state.private_session_created_at),
        nurture_receipt_ready: Boolean(state.nurture_receipt_ready_at),
        watch_public_effect: Boolean(state.watch_public_effect_at),
      },
      first_success: {
        achieved: Boolean(firstSuccessAt),
        at: firstSuccessAt ? firstSuccessAt.toISOString() : null,
      },
      reveal: {
        style: Boolean(state.nurture_receipt_ready_at),
        instructions: Boolean(state.nurture_receipt_ready_at),
        advanced: Boolean(state.watch_public_effect_at),
      },
      latest_owner_agent_id: state.latest_owner_agent_id,
      latest_receipt_session_id: state.latest_receipt_session_id,
    }
  }

  private buildChecklist(
    state: GuidanceActorStateEntity,
    activeItems: GuidanceInboxItemEntity[],
  ): GuidanceChecklistModule | null {
    const shouldShow = state.explained_two_tracks
      || Boolean(state.followed_first_agent_at)
      || Boolean(state.agent_created_at)
      || Boolean(state.private_session_created_at)
      || state.stage !== 'NEW_VISITOR'
    if (!shouldShow) return null

    const items: GuidanceChecklistItemView[] = []
    const pushItem = (reasonCode: GuidanceReasonCode, completed: boolean, target?: { agentId?: string | null; sessionId?: string | null; url?: string | null }) => {
      const copy = this.copyService.getChecklistCopy({
        reason_code: reasonCode,
        completed,
        target_agent_id: target?.agentId,
        target_session_id: target?.sessionId,
        target_url: target?.url,
      })
      items.push({
        reason_code: reasonCode,
        title: copy.title,
        body: copy.body,
        completed,
        cta: completed ? null : copy.cta,
      })
    }

    if (state.current_track === 'SPECTATOR' || state.current_track === 'UNDECIDED') {
      pushItem(GUIDANCE_REASON_CODES.FOLLOW_FIRST_AGENT, Boolean(state.followed_first_agent_at))
      if (state.followed_first_agent_at) {
        pushItem(GUIDANCE_REASON_CODES.USE_FOLLOWING_FEED, Boolean(state.following_feed_seen_at))
      }
    }

    if (state.current_track === 'OWNER') {
      if (state.latest_owner_agent_id) {
        pushItem(
          GUIDANCE_REASON_CODES.START_FIRST_PRIVATE_CHAT,
          Boolean(state.private_session_created_at),
          { agentId: state.latest_owner_agent_id },
        )
      }

      const watchItem = activeItems.find((item) => item.reason_code === GUIDANCE_REASON_CODES.WATCH_PUBLIC_EFFECT)
      if (state.nurture_receipt_ready_at || watchItem) {
        pushItem(
          GUIDANCE_REASON_CODES.WATCH_PUBLIC_EFFECT,
          Boolean(state.watch_public_effect_at),
          {
            agentId: state.latest_owner_agent_id,
            sessionId: state.latest_receipt_session_id,
            url: typeof watchItem?.cta_target === 'string' ? watchItem.cta_target : null,
          },
        )
      }
    }

    return items.length > 0
      ? {
          type: GUIDANCE_MODULE_TYPES.CHECKLIST,
          title: 'Next up',
          items,
        }
      : null
  }
}
