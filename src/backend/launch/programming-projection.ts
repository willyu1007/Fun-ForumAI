import type { ForumSceneMetadata } from '../repos/types/forum-scene.js'
import { parsePublicScenePayload } from '../services/public-scene-runtime.js'
import type { CueProjectionFacet } from './programming-projection-cue-facet.js'
import {
  LAUNCH_CREATOR_NOTE_COVER_MODE_IDS,
  normalizeLaunchCreatorNoteTemplateId,
  resolveLaunchCreatorNoteProjection,
  type LaunchCreatorNoteCoverMode,
  type LaunchCreatorNoteTemplateId,
} from './creator-note-templates.js'
import {
  deriveFormatKindFromContentKind,
  normalizeContentKind,
  normalizeEditorialShelfId,
  normalizeStorylineState,
  type ContentKind,
  type ContentSemanticProjection,
  type EditorialShelfId,
  type FormatKind,
  type ScenePhase,
  type StorylineState,
} from '../../shared/semantic-taxonomy.js'

export type LaunchStorylineState = StorylineState
export type LaunchContentKind = ContentKind

export interface LaunchProgrammingProjection {
  storyline_id?: string
  storyline_title?: string
  storyline_state?: LaunchStorylineState
  storyline_hook?: string
  content_kind?: LaunchContentKind
  scene_phase?: ScenePhase
  format_kind?: FormatKind
  editorial_shelf_id?: EditorialShelfId
  aftershow_export_bias?: number
  note_template_id?: LaunchCreatorNoteTemplateId
  cover_mode?: LaunchCreatorNoteCoverMode
  content_semantics?: ContentSemanticProjection
  /**
   * T-215 B-M2 — additive cue facet. Populated by callers that have
   * already assembled the upcoming / live / completed cue surface
   * (typically `cue-public-projection-service`). Builders that don't need
   * cue context (admin actuals, single-post detail) leave this unset and
   * the existing storyline / launch projection paths are unaffected.
   */
  cue?: CueProjectionFacet
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function isLaunchContentKind(value: unknown): value is LaunchContentKind {
  return typeof value === 'string' && normalizeContentKind(value) !== null
}

function isLaunchCreatorNoteCoverMode(value: unknown): value is LaunchCreatorNoteCoverMode {
  return typeof value === 'string' && (LAUNCH_CREATOR_NOTE_COVER_MODE_IDS as readonly string[]).includes(value)
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
  /**
   * T-215 B-M2 — pre-assembled cue facet. The caller (cue public
   * projection service) is responsible for sanitization; this builder
   * passes it through verbatim alongside the storyline projection. Omit
   * to render the legacy launch projection only.
   */
  cue_facet?: CueProjectionFacet | null
}): LaunchProgrammingProjection {
  const launchProfile = readLaunchProfile(input.community_rules_json)
  const defaultEditorialShelfId = Array.isArray(launchProfile?.default_editorial_shelf_ids)
    ? launchProfile.default_editorial_shelf_ids
      .map((item) => (typeof item === 'string' ? normalizeEditorialShelfId(item) : null))
      .find((item): item is EditorialShelfId => item !== null)
    : undefined
  const crossRoutePolicy = readCrossRoutePolicy(input.community_rules_json)
  const allowAftershowExport = crossRoutePolicy?.allow_aftershow_export === true
  const payload = input.scene_metadata ? parsePublicScenePayload(input.scene_metadata.payload_json) : null
  const launchProgramming = payload?.launch_programming
  const launchStoryline = isRecord(launchProgramming?.storyline) ? launchProgramming.storyline : null
  const launchCreatorNote = isRecord(launchProgramming?.creator_note)
    ? launchProgramming.creator_note
    : null
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
  const storylineState = normalizeStorylineState(readString(launchStoryline?.state))
    ?? resolveStorylineState({
      phase: input.scene_metadata?.phase,
      has_aftershow_artifact: input.has_aftershow_artifact,
    })
  const creatorNoteProjection = resolveLaunchCreatorNoteProjection({
    community_slug: input.community_slug,
    phase: input.scene_metadata?.phase ?? payload?.scene_metadata.phase ?? null,
    title: storylineTitle ?? null,
    scene_goal: payload?.episode_brief.scene_goal.viewer_goal ?? null,
    open_loops: payload?.episode_brief.open_loops ?? [],
    media_count: input.media_count ?? 0,
  })
  const editorialShelfId = normalizeEditorialShelfId(
    readString(launchEditorialIntent?.primary_shelf_id) ?? readString(launchEditorialIntent?.primary_shelf),
  )
    ?? defaultEditorialShelfId
  const isCreatorNote = typeof launchCreatorNote?.is_creator_note === 'boolean'
    ? launchCreatorNote.is_creator_note
    : creatorNoteProjection.is_creator_note
  const noteTemplateId = normalizeLaunchCreatorNoteTemplateId(readString(launchCreatorNote?.note_template_id))
    ?? creatorNoteProjection.note_template_id
  const coverMode = isLaunchCreatorNoteCoverMode(launchCreatorNote?.cover_mode)
    ? launchCreatorNote.cover_mode
    : creatorNoteProjection.cover_mode

  const contentKind: LaunchContentKind | undefined = isLaunchContentKind(launchEditorialIntent?.content_kind)
    ? normalizeContentKind(launchEditorialIntent?.content_kind as string) ?? undefined
    : isCreatorNote
      ? 'note_entry'
      : storylineState === 'callback'
        ? 'continuity_callback'
        : storylineId
          ? 'story_episode'
          : 'mainline_root'
  const formatKind = deriveFormatKindFromContentKind(contentKind)

  const aftershowExportBias = !allowAftershowExport
    ? 0
    : storylineState === 'callback'
      ? (input.has_aftershow_artifact ? 1 : 0.6)
      : storylineState === 'escalating'
        ? 0.35
        : storylineState === 'opening'
          ? 0.2
          : 0.15

  const contentSemantics: ContentSemanticProjection = {
    scene_runtime: {
      ...(input.scene_metadata?.scene_template_id ? { scene_template_id: input.scene_metadata.scene_template_id } : {}),
      ...(input.scene_metadata?.phase ? { phase: input.scene_metadata.phase } : {}),
    },
    narrative: {
      ...(storylineId ? { storyline_id: storylineId } : {}),
      ...(storylineTitle ? { storyline_title: storylineTitle } : {}),
      ...(storylineState ? { storyline_state: storylineState } : {}),
      ...(storylineHook ? { storyline_hook: storylineHook } : {}),
    },
    distribution: {
      ...(contentKind ? { content_kind: contentKind } : {}),
      ...(editorialShelfId ? { editorial_shelf_id: editorialShelfId } : {}),
      aftershow_export_bias: aftershowExportBias,
    },
    format: {
      ...(formatKind ? { format_kind: formatKind } : {}),
      ...(noteTemplateId ? { note_template_id: noteTemplateId } : {}),
      ...(coverMode ? { cover_mode: coverMode } : {}),
    },
    visual: {
      ...(isCreatorNote ? { surface_kind: 'note_root_card' } : {}),
    },
  }

  return {
    ...(storylineId ? { storyline_id: storylineId } : {}),
    ...(storylineTitle ? { storyline_title: storylineTitle } : {}),
    ...(storylineState ? { storyline_state: storylineState } : {}),
    ...(storylineHook ? { storyline_hook: storylineHook } : {}),
    ...(contentKind ? { content_kind: contentKind } : {}),
    ...(input.scene_metadata?.phase ? { scene_phase: input.scene_metadata.phase } : {}),
    ...(formatKind ? { format_kind: formatKind } : {}),
    ...(editorialShelfId ? { editorial_shelf_id: editorialShelfId } : {}),
    aftershow_export_bias: aftershowExportBias,
    ...(noteTemplateId ? { note_template_id: noteTemplateId } : {}),
    ...(coverMode ? { cover_mode: coverMode } : {}),
    content_semantics: contentSemantics,
    ...(input.cue_facet ? { cue: input.cue_facet } : {}),
  }
}
