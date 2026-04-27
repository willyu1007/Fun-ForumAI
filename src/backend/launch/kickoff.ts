import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve, sep } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { ValidationError } from '../lib/errors.js'
import type { AgentConfigRepository, AgentRepository } from '../repos/agent-repository.js'
import type { CommunityRepository } from '../repos/community-repository.js'
import type { Agent } from '../repos/types.js'
import {
  buildLocalIntentBlock,
  type PublicSceneWritePayload,
} from '../services/public-scene-runtime.js'
import type { EpisodeBrief, LocalIntent, SceneMetadata } from '../stage/index.js'
import { listLaunchCommunitySeeds } from './community-rules.js'
import type { LaunchProgrammingDaypartId } from './programming-schedule.js'
import {
  readLaunchSystemIdentityConfig,
  type LaunchProgramRole,
  type LaunchSystemIdentityConfig,
  type LaunchSystemRosterEntry,
  type LaunchSystemRosterRuntime,
} from './system-roster.js'
import type { LaunchContentKind, LaunchStorylineState } from './programming-projection.js'
import type {
  LaunchCreatorNoteCoverMode,
  LaunchCreatorNoteTemplateId,
} from './creator-note-templates.js'

function kickoffTmpRoot(): string {
  return resolve(process.cwd(), '.ai/.tmp')
}

function defaultKickoffManifestPath(): string {
  return resolve(kickoffTmpRoot(), 'kickoff/manifest.v1.yaml')
}

type KickoffShelfId =
  | 'must_watch_today'
  | 'conflict_rising'
  | 'notes_today'
  | 'continue_storyline'
  | 'tonight_programming'

export interface KickoffPostSpec {
  id: string
  community_slug: string
  programming_daypart: LaunchProgrammingDaypartId
  scheduled_local_time: string
  preferred_roles?: LaunchProgramRole[]
  phase: 'opening' | 'escalation' | 'pivot' | 'closure'
  title: string
  body: string
  tags: string[]
  storyline: {
    id: string
    title: string
    hook: string
    state?: LaunchStorylineState
  }
  editorial_shelf_id: KickoffShelfId
  content_kind: LaunchContentKind
  target_thread_turn_count?: number
  post_vote_target?: number
  attach_media?: boolean
  visual_asset_path?: string
  creator_note?: {
    is_creator_note: true
    note_template_id: LaunchCreatorNoteTemplateId
    cover_mode: LaunchCreatorNoteCoverMode
  }
}

export interface KickoffBundle {
  version: 1
  bundle_id: string
  baseline_label?: string
  posts: KickoffPostSpec[]
  manifest_path: string
}

interface ResolvedSystemAgent {
  agent: Agent
  identity: LaunchSystemIdentityConfig
}

const kickoffCreatorNoteSchema = z
  .object({
    is_creator_note: z.literal(true),
    note_template_id: z.string().trim().min(1),
    cover_mode: z.string().trim().min(1),
  })
  .strict()

const kickoffSpecSchema = z
  .object({
    id: z.string().trim().min(1),
    community_slug: z.string().trim().min(1),
    programming_daypart: z.string().trim().min(1),
    scheduled_local_time: z.string().trim().min(1),
    preferred_roles: z.array(z.string().trim().min(1)).optional(),
    phase: z.enum(['opening', 'escalation', 'pivot', 'closure']),
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
    tags: z.array(z.string().trim().min(1)),
    storyline: z
      .object({
        id: z.string().trim().min(1),
        title: z.string().trim().min(1),
        hook: z.string().trim().min(1),
        state: z.string().trim().min(1).optional(),
      })
      .strict(),
    editorial_shelf_id: z.enum([
      'must_watch_today',
      'conflict_rising',
      'notes_today',
      'continue_storyline',
      'tonight_programming',
    ]),
    content_kind: z.string().trim().min(1),
    target_thread_turn_count: z.number().int().min(1).optional(),
    post_vote_target: z.number().int().min(1).optional(),
    attach_media: z.boolean().optional(),
    visual_asset_path: z.string().trim().min(1).optional(),
    creator_note: kickoffCreatorNoteSchema.optional(),
  })
  .strict()

const kickoffManifestSchema = z
  .object({
    version: z.literal(1),
    bundle_id: z.string().trim().min(1),
    baseline_label: z.string().trim().min(1).optional(),
    posts: z.array(kickoffSpecSchema).min(1),
  })
  .strict()

function parseKickoffYaml(path: string): unknown {
  return parseYaml(readFileSync(path, 'utf8'))
}

function formatSchemaError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ')
}

function ensureKickoffPathExists(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new ValidationError(`kickoff bundle ${label} is missing: ${path}`)
  }
}

function ensurePathInsideKickoffTmp(path: string): void {
  const normalized = resolve(path)
  const root = kickoffTmpRoot()
  const rootWithSep = `${root}${sep}`
  if (normalized !== root && !normalized.startsWith(rootWithSep)) {
    throw new ValidationError(
      `kickoff bundle paths must stay under ${root}: ${normalized}`,
    )
  }
}

function resolveKickoffAssetPath(manifestPath: string, assetPath: string): string {
  const resolved = isAbsolute(assetPath)
    ? resolve(assetPath)
    : resolve(dirname(manifestPath), assetPath)
  ensurePathInsideKickoffTmp(resolved)
  ensureKickoffPathExists(resolved, `asset ${assetPath}`)
  return resolved
}

export function loadKickoffBundle(manifestPath = defaultKickoffManifestPath()): KickoffBundle {
  ensureKickoffPathExists(manifestPath, 'manifest')
  ensurePathInsideKickoffTmp(manifestPath)

  const parsed = kickoffManifestSchema.safeParse(parseKickoffYaml(manifestPath))
  if (!parsed.success) {
    throw new ValidationError(`invalid kickoff manifest: ${formatSchemaError(parsed.error)}`)
  }

  const posts = parsed.data.posts.map((spec) => ({
    ...spec,
    preferred_roles: spec.preferred_roles as LaunchProgramRole[] | undefined,
    programming_daypart: spec.programming_daypart as LaunchProgrammingDaypartId,
    content_kind: spec.content_kind as LaunchContentKind,
    storyline: {
      ...spec.storyline,
      state: spec.storyline.state as LaunchStorylineState | undefined,
    },
    creator_note: spec.creator_note
      ? {
          is_creator_note: true as const,
          note_template_id: spec.creator_note.note_template_id as LaunchCreatorNoteTemplateId,
          cover_mode: spec.creator_note.cover_mode as LaunchCreatorNoteCoverMode,
        }
      : undefined,
    visual_asset_path: spec.visual_asset_path
      ? resolveKickoffAssetPath(manifestPath, spec.visual_asset_path)
      : undefined,
  }))

  return {
    version: 1,
    bundle_id: parsed.data.bundle_id,
    baseline_label: parsed.data.baseline_label,
    posts,
    manifest_path: resolve(manifestPath),
  }
}

export function buildCommunityAliasMap(communityRepo: CommunityRepository): {
  communityByAlias: Map<string, { id: string; slug: string; name: string }>
  launchCommunities: Array<{ id: string; slug: string; name: string }>
} {
  const communityByAlias = new Map<string, { id: string; slug: string; name: string }>()
  const launchCommunities: Array<{ id: string; slug: string; name: string }> = []

  for (const seed of listLaunchCommunitySeeds()) {
    const community = communityRepo.findBySlug(seed.slug)
    if (!community) {
      throw new ValidationError(`kickoff import is blocked: missing community ${seed.slug}`)
    }

    const resolved = {
      id: community.id,
      slug: community.slug,
      name: community.name,
    }
    communityByAlias.set(seed.slug, resolved)
    communityByAlias.set(seed.name, resolved)
    launchCommunities.push(resolved)
  }

  return {
    communityByAlias,
    launchCommunities,
  }
}

export function buildSystemAgentIndexes(input: {
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  ownerId: string
}): {
  ownerAgentsByDisplayName: Map<string, Agent[]>
  systemAgentsByDisplayName: Map<string, ResolvedSystemAgent[]>
} {
  const ownerAgentsByDisplayName = new Map<string, Agent[]>()
  const systemAgentsByDisplayName = new Map<string, ResolvedSystemAgent[]>()

  for (const agent of input.agentRepo.findByOwner(input.ownerId)) {
    const ownerAgents = ownerAgentsByDisplayName.get(agent.display_name) ?? []
    ownerAgents.push(agent)
    ownerAgentsByDisplayName.set(agent.display_name, ownerAgents)

    const latestConfig = input.agentConfigRepo.findLatest(agent.id)
    const identity = readLaunchSystemIdentityConfig(latestConfig?.config_json)
    if (!identity) continue

    const systemAgents = systemAgentsByDisplayName.get(agent.display_name) ?? []
    systemAgents.push({ agent, identity })
    systemAgentsByDisplayName.set(agent.display_name, systemAgents)
  }

  return {
    ownerAgentsByDisplayName,
    systemAgentsByDisplayName,
  }
}

function resolveSystemAgentForEntry(
  entry: LaunchSystemRosterEntry,
  indexes: ReturnType<typeof buildSystemAgentIndexes>,
): Agent {
  const candidates = indexes.systemAgentsByDisplayName.get(entry.display_name) ?? []
  const matched =
    candidates.find(
      ({ identity }) =>
        identity.program_role === entry.program_role &&
        identity.visibility_role === entry.visibility_role &&
        identity.home_community === entry.home_community,
    ) ??
    candidates[0] ??
    null

  if (matched) {
    return matched.agent
  }

  const ownerAgents = indexes.ownerAgentsByDisplayName.get(entry.display_name) ?? []
  if (ownerAgents.length > 0) {
    throw new ValidationError(
      `kickoff import is blocked: ${entry.display_name} exists but is missing launch identity`,
    )
  }

  throw new ValidationError(`kickoff import is blocked: missing system agent ${entry.display_name}`)
}

function readCommunityAffinityRank(
  entry: LaunchSystemRosterEntry,
  communityAliases: readonly string[],
): number {
  if (communityAliases.includes(entry.home_community)) return 0
  if (entry.resident_memberships.some((alias) => communityAliases.includes(alias))) return 1
  if (entry.guest_memberships.some((alias) => communityAliases.includes(alias))) return 2
  return 3
}

export function pickRosterEntryForSpec(input: {
  roster: LaunchSystemRosterRuntime
  spec: KickoffPostSpec
  usedAgentIds: Set<string>
  indexes: ReturnType<typeof buildSystemAgentIndexes>
}): Agent {
  const launchCommunity = listLaunchCommunitySeeds().find(
    (community) => community.slug === input.spec.community_slug,
  )
  const communityAliases = launchCommunity
    ? [launchCommunity.slug, launchCommunity.name]
    : [input.spec.community_slug]
  const candidates = input.roster.roster
    .filter((entry) => readCommunityAffinityRank(entry, communityAliases) < 3)
    .map((entry) => ({
      entry,
      agent: resolveSystemAgentForEntry(entry, input.indexes),
    }))
    .sort((a, b) => {
      const aUsed = input.usedAgentIds.has(a.agent.id) ? 1 : 0
      const bUsed = input.usedAgentIds.has(b.agent.id) ? 1 : 0
      const usedDelta = aUsed - bUsed
      if (usedDelta !== 0) return usedDelta

      const roleRank = (entry: LaunchSystemRosterEntry) => {
        if (!input.spec.preferred_roles || input.spec.preferred_roles.length === 0) return 99
        const index = input.spec.preferred_roles.indexOf(entry.program_role)
        return index >= 0 ? index : 99
      }

      const affinityDelta =
        readCommunityAffinityRank(a.entry, communityAliases) -
        readCommunityAffinityRank(b.entry, communityAliases)
      return (
        roleRank(a.entry) - roleRank(b.entry) ||
        affinityDelta ||
        a.entry.display_name.localeCompare(b.entry.display_name, 'zh-CN')
      )
    })

  const chosen = candidates[0]
  if (!chosen) {
    throw new ValidationError(
      `kickoff import is blocked: no roster agent is mapped to ${input.spec.community_slug}`,
    )
  }

  return chosen.agent
}

export function buildKickoffScenePayload(input: {
  spec: KickoffPostSpec
  now: Date
}): PublicSceneWritePayload {
  const startedAt = input.now.toISOString()
  const expiresAt = new Date(input.now.getTime() + 12 * 60 * 60 * 1000).toISOString()
  const sceneMetadata: SceneMetadata = {
    director_surface: 'forum',
    actor_surface: 'forum_post',
    scene_template_id: 'launch-kickoff',
    scene_template_version: 'v1',
    scene_binding_id: `launch-kickoff:${input.spec.id}`,
    overlay_id: null,
    episode_id: `launch-kickoff:${input.spec.storyline.id}`,
    beat_id: null,
    phase: input.spec.phase,
    selection_mode: 'pool_guided' as const,
    selection_id: `launch-kickoff:${input.spec.id}:selection`,
    episode_plan_id: `launch-kickoff:${input.spec.id}:plan`,
    local_intent_id: `launch-kickoff:${input.spec.id}:intent`,
    started_at: startedAt,
    expires_at: expiresAt,
  }
  const episodeBrief: EpisodeBrief = {
    episode_id: sceneMetadata.episode_id,
    director_surface: sceneMetadata.director_surface,
    actor_surface: sceneMetadata.actor_surface,
    template_id: sceneMetadata.scene_template_id,
    template_version: sceneMetadata.scene_template_version,
    phase: input.spec.phase,
    scene_goal: {
      viewer_goal: input.spec.storyline.title,
      growth_goal: '为灰度运行建立 kickoff baseline',
    },
    target_mood: 'playful' as const,
    casting_directive: {
      must_have_roles: ['HOST'],
      avoid_pairs: [],
      core_quota: 1,
      contrast_quota: 1,
      wildcard_quota: 0,
    },
    open_loops: [input.spec.storyline.hook],
    must_hit_points: ['kickoff baseline', 'gray-ready coverage', 'runtime handoff'],
    avoid_repeat: [],
    close_condition: {},
    expires_at: expiresAt,
  }
  const localIntent: LocalIntent = {
    intent_id: sceneMetadata.local_intent_id,
    delivery_surface: 'forum_post' as const,
    initiative: 'open_topic' as const,
    opinion_policy: 'free_opinion' as const,
    relation_focus: 'bridge' as const,
    tone_hint: 'serious' as const,
    privacy_mode: 'public_only' as const,
    memory_scope: 'public_contextual' as const,
    reference_scope: 'episode_public_context' as const,
    prohibited_reference_types: [],
    target_ref: { kind: 'none' } as const,
    hard_constraints: ['不要写成运营公告', '保持 kickoff 节目位表达'],
    soft_constraints: ['给出明确的下一步追问', '让首页棚位立即可消费'],
  }

  return {
    scene_metadata: sceneMetadata,
    episode_brief: episodeBrief,
    local_intent: localIntent,
    local_intent_block: buildLocalIntentBlock(localIntent, episodeBrief),
    launch_programming: {
      storyline: {
        id: input.spec.storyline.id,
        title: input.spec.storyline.title,
        hook: input.spec.storyline.hook,
        ...(input.spec.storyline.state ? { state: input.spec.storyline.state } : {}),
      },
      editorial_intent: {
        primary_shelf_id: input.spec.editorial_shelf_id,
        content_kind: input.spec.content_kind,
      },
      creator_note: input.spec.creator_note ?? null,
    },
  }
}
