import type { ForumSceneMetadata } from '../repos/types/forum-scene.js'
import { parsePublicScenePayload } from '../services/public-scene-runtime.js'
import {
  LAUNCH_T4_COVER_MODE_IDS,
  normalizeLaunchT4TemplateId,
  resolveLaunchT4Projection,
  type LaunchT4CoverMode,
  type LaunchT4TemplateId,
} from './t4-content-templates.js'

export type LaunchStorylineState = 'opening' | 'escalating' | 'callback' | 'closed'
export type LaunchContentKind =
  | 'mainline_root'
  | 'highlight_hero'
  | 'aftershow_recap'
  | 'continuity_callback'
  | 'story_episode'
  | 't4_note'
  | 'community_entry'
  | 'programming_slot'

export interface LaunchProgrammingProjection {
  storyline_id?: string
  storyline_title?: string
  storyline_state?: LaunchStorylineState
  storyline_hook?: string
  content_kind?: LaunchContentKind
  editorial_shelf?: string
  is_t4?: boolean
  aftershow_export_bias?: number
  note_template_id?: LaunchT4TemplateId
  cover_mode?: LaunchT4CoverMode
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function isLaunchContentKind(value: unknown): value is LaunchContentKind {
  return typeof value === 'string' && [
    'mainline_root',
    'highlight_hero',
    'aftershow_recap',
    'continuity_callback',
    'story_episode',
    't4_note',
    'community_entry',
    'programming_slot',
  ].includes(value)
}

function isLaunchT4CoverMode(value: unknown): value is LaunchT4CoverMode {
  return typeof value === 'string' && (LAUNCH_T4_COVER_MODE_IDS as readonly string[]).includes(value)
}

function readLaunchProfile(rulesJson: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!rulesJson || !isRecord(rulesJson.launch_profile)) return null
  return rulesJson.launch_profile
}

function readCrossRoutePolicy(rulesJson: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!rulesJson || !isRecord(rulesJson.cross_route_policy)) return null
  return rulesJson.cross_route_policy
}

function resolveStorylineState(input: {
  phase?: ForumSceneMetadata['phase'] | null
  has_aftershow_artifact?: boolean
}): LaunchStorylineState | undefined {
  switch (input.phase) {
    case 'opening':
      return 'opening'
    case 'escalation':
    case 'pivot':
      return 'escalating'
    case 'closure':
    case 'aftershow':
      return input.has_aftershow_artifact ? 'callback' : 'closed'
    default:
      return undefined
  }
}

export function buildLaunchProgrammingProjection(input: {
  community_slug: string
  community_rules_json?: Record<string, unknown> | null
  scene_metadata?: ForumSceneMetadata | null
  media_count?: number
  has_aftershow_artifact?: boolean
}): LaunchProgrammingProjection {
  const launchProfile = readLaunchProfile(input.community_rules_json)
  const defaultEditorialShelf = Array.isArray(launchProfile?.editorial_shelf)
    ? launchProfile.editorial_shelf.find((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : undefined
  const crossRoutePolicy = readCrossRoutePolicy(input.community_rules_json)
  const allowAftershowExport = crossRoutePolicy?.allow_aftershow_export === true
  const payload = input.scene_metadata ? parsePublicScenePayload(input.scene_metadata.payload_json) : null
  const launchProgramming = payload?.launch_programming
  const launchStoryline = isRecord(launchProgramming?.storyline) ? launchProgramming.storyline : null
  const launchT4Note = isRecord(launchProgramming?.t4_note) ? launchProgramming.t4_note : null
  const launchEditorialIntent = isRecord(launchProgramming?.editorial_intent) ? launchProgramming.editorial_intent : null
  const storylineId = readString(launchStoryline?.id)
    ?? payload?.episode_brief.episode_id
    ?? input.scene_metadata?.episode_id
    ?? undefined
  const storylineTitle = readString(launchStoryline?.title)
    ?? payload?.episode_brief.scene_goal.viewer_goal?.trim()
    ?? undefined
  const storylineHook = readString(launchStoryline?.hook)
    ?? payload?.episode_brief.open_loops.find((item) => item.trim().length > 0)
    ?? storylineTitle
  const storylineState = resolveStorylineState({
    phase: input.scene_metadata?.phase,
    has_aftershow_artifact: input.has_aftershow_artifact,
  })
  const computedT4Projection = resolveLaunchT4Projection({
    community_slug: input.community_slug,
    phase: input.scene_metadata?.phase ?? payload?.scene_metadata.phase ?? null,
    title: storylineTitle ?? null,
    scene_goal: payload?.episode_brief.scene_goal.viewer_goal ?? null,
    open_loops: payload?.episode_brief.open_loops ?? [],
    media_count: input.media_count ?? 0,
  })
  const editorialShelf = readString(launchEditorialIntent?.primary_shelf) ?? defaultEditorialShelf
  const isT4 = typeof launchT4Note?.is_t4 === 'boolean'
    ? launchT4Note.is_t4
    : computedT4Projection.is_t4
  const noteTemplateId = normalizeLaunchT4TemplateId(readString(launchT4Note?.note_template_id))
    ?? computedT4Projection.note_template_id
  const coverMode = isLaunchT4CoverMode(launchT4Note?.cover_mode)
    ? launchT4Note.cover_mode
    : computedT4Projection.cover_mode

  const contentKind: LaunchContentKind | undefined = isLaunchContentKind(launchEditorialIntent?.content_kind)
    ? launchEditorialIntent.content_kind
    : isT4
      ? 't4_note'
      : storylineState === 'callback'
        ? 'continuity_callback'
        : storylineId
          ? 'story_episode'
          : 'mainline_root'

  const aftershowExportBias = !allowAftershowExport
    ? 0
    : storylineState === 'callback'
      ? (input.has_aftershow_artifact ? 1 : 0.6)
      : storylineState === 'escalating'
        ? 0.35
        : storylineState === 'opening'
          ? 0.2
          : 0.15

  return {
    ...(storylineId ? { storyline_id: storylineId } : {}),
    ...(storylineTitle ? { storyline_title: storylineTitle } : {}),
    ...(storylineState ? { storyline_state: storylineState } : {}),
    ...(storylineHook ? { storyline_hook: storylineHook } : {}),
    ...(contentKind ? { content_kind: contentKind } : {}),
    ...(editorialShelf ? { editorial_shelf: editorialShelf } : {}),
    is_t4: isT4,
    aftershow_export_bias: aftershowExportBias,
    ...(noteTemplateId ? { note_template_id: noteTemplateId } : {}),
    ...(coverMode ? { cover_mode: coverMode } : {}),
  }
}
