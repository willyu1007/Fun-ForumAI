import type { EvidenceRef } from '../repos/types/common.js'
import type {
  MediaContextProjectionRepository,
} from '../repos/media-context-projection-repository.js'
import type {
  SceneMediaBindingRepository,
} from '../repos/scene-media-binding-repository.js'
import type {
  SceneMediaBinding,
  SurfaceMediaAttachmentView,
} from '../repos/types.js'
import {
  buildCommunityCommonsPoolSceneId,
  buildPlatformCanonicalPoolSceneId,
} from './media-reuse-governance-service.js'
import { resolveBrowserMediaUrl } from './media-url.js'

type AttachmentSceneType =
  | 'forum_post'
  | 'forum_thread'
  | 'forum_turn'
  | 'chat_room_message'
  | 'achievement_card'
  | 'episode_prop'
  | 'media_pool'

interface SurfaceAttachmentDeps {
  sceneMediaBindingRepo: SceneMediaBindingRepository
  mediaContextProjectionRepo: MediaContextProjectionRepository
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function toSurfaceMediaAttachmentView(payload: unknown): SurfaceMediaAttachmentView | null {
  if (!isRecord(payload)) return null
  if (
    typeof payload.asset_id !== 'string'
    || typeof payload.media_url !== 'string'
    || typeof payload.mime_type !== 'string'
  ) {
    return null
  }

  return {
    asset_id: payload.asset_id,
    media_url: resolveBrowserMediaUrl(payload.media_url),
    mime_type: payload.mime_type,
    width: typeof payload.width === 'number' ? payload.width : null,
    height: typeof payload.height === 'number' ? payload.height : null,
    alt_text: typeof payload.alt_text === 'string' && payload.alt_text.trim().length > 0
      ? payload.alt_text
      : null,
    public_caption: typeof payload.public_caption === 'string' && payload.public_caption.trim().length > 0
      ? payload.public_caption
      : null,
    slot: readNumber(payload.slot, 0),
    display_variant: payload.display_variant === 'generated_derivative'
      ? 'generated_derivative'
      : 'original',
  }
}

function sortAttachmentBindings(bindings: SceneMediaBinding[]): SceneMediaBinding[] {
  return bindings
    .slice()
    .sort((left, right) => left.created_at.getTime() - right.created_at.getTime())
}

export async function listSurfaceMediaAttachmentViews(
  deps: SurfaceAttachmentDeps,
  sceneType: AttachmentSceneType,
  sceneIds: string[],
): Promise<Map<string, SurfaceMediaAttachmentView[]>> {
  const result = new Map<string, SurfaceMediaAttachmentView[]>()
  if (sceneIds.length === 0) return result

  const bindings = await deps.sceneMediaBindingRepo.findByScenes(sceneType, sceneIds)
  if (bindings.length === 0) return result

  const projections = await deps.mediaContextProjectionRepo.findByBindingIds(bindings.map((binding) => binding.id))
  const attachmentByBindingId = new Map<string, SurfaceMediaAttachmentView>()
  for (const projection of projections) {
    if (
      projection.projection_surface !== 'public_display'
      || projection.projection_kind !== 'display_attachment'
      || projection.schema_version !== 'display_attachment.v1'
      || attachmentByBindingId.has(projection.binding_id)
    ) {
      continue
    }
    const attachment = toSurfaceMediaAttachmentView(projection.payload_json)
    if (attachment) {
      attachmentByBindingId.set(projection.binding_id, attachment)
    }
  }

  for (const binding of sortAttachmentBindings(bindings)) {
    const attachment = attachmentByBindingId.get(binding.id)
    if (!attachment) continue
    const current = result.get(binding.scene_id) ?? []
    current.push(attachment)
    current.sort((left, right) => left.slot - right.slot)
    result.set(binding.scene_id, current)
  }

  return result
}

async function findFirstAttachmentByScene(
  deps: SurfaceAttachmentDeps,
  sceneType: AttachmentSceneType,
  sceneId: string,
): Promise<SurfaceMediaAttachmentView | null> {
  const map = await listSurfaceMediaAttachmentViews(deps, sceneType, [sceneId])
  return map.get(sceneId)?.[0] ?? null
}

export async function resolveSurfaceMediaAttachmentFromEvidence(
  deps: SurfaceAttachmentDeps,
  input: {
    evidence: EvidenceRef[]
    fallbackCommunityId?: string | null
  },
): Promise<SurfaceMediaAttachmentView | null> {
  for (const item of input.evidence) {
    if (item.kind === 'post') {
      const attachment = await findFirstAttachmentByScene(deps, 'forum_post', item.ref_id)
      if (attachment) return attachment
      continue
    }
    if (item.kind === 'thread_turn') {
      const attachment = await findFirstAttachmentByScene(deps, 'forum_turn', item.ref_id)
      if (attachment) return attachment
      continue
    }
    if (item.kind === 'thread') {
      const attachment = await findFirstAttachmentByScene(deps, 'forum_thread', item.ref_id)
      if (attachment) return attachment
      continue
    }
    if (item.kind === 'turn') {
      const attachment = await findFirstAttachmentByScene(deps, 'forum_turn', item.ref_id)
      if (attachment) return attachment
      continue
    }
    if (item.kind === 'message') {
      const attachment = await findFirstAttachmentByScene(deps, 'chat_room_message', item.ref_id)
      if (attachment) return attachment
    }
  }

  const fallbackSceneIds = [
    ...(input.fallbackCommunityId ? [buildCommunityCommonsPoolSceneId(input.fallbackCommunityId)] : []),
    buildPlatformCanonicalPoolSceneId(),
  ]
  for (const poolSceneId of fallbackSceneIds) {
    const attachment = await findFirstAttachmentByScene(deps, 'media_pool', poolSceneId)
    if (attachment) return attachment
  }

  return null
}
