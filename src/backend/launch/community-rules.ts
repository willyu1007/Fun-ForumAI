import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import {
  COMMUNITY_LIFECYCLE_STATES,
  type CommunityIncubationVisibilityMode,
  type CommunityLifecycleState,
} from '../repos/types/governance.js'
import { ValidationError } from '../lib/errors.js'
import { deepMerge } from '../services/community-config-normalization.js'
import { getLaunchSystemRoster } from './system-roster.js'
import { resolveLaunchContractPath } from './contract-paths.js'
import {
  parseStageSpecV1,
  type StageSpecV1,
} from '../stage/index.js'
import {
  deriveCommunityShellCategory,
  derivePublicationReviewProfileId,
  normalizeAuthoringShapeId,
  normalizeCommunityFamily,
  normalizeCommunityShellCategory,
  normalizeEditorialShelfId,
  normalizePublicationReviewProfileId,
  resolveCommunityInteractionContract,
  type CommunityInteractionContract,
  type CommunitySemanticContract,
} from '../../shared/semantic-taxonomy.js'
import { getSemanticTaxonomyRegistry } from './semantic-taxonomy-registry.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')
const DEFAULT_LAUNCH_COMMUNITY_RULES_PATH = resolveLaunchContractPath({
  bundle_slug: 'launch-communities-and-rules-pack',
  file_name: 'launch_community_rules.v1.yaml',
})
const STAGE_TEMPLATE_ROOT = resolve(REPO_ROOT, 'docs/stage-templates/source/templates')

const lifecycleStateSchema = z.enum(COMMUNITY_LIFECYCLE_STATES)
const launchProfileSchema = z.object({
  community_family: z.string().trim().min(1).optional(),
  community_type: z.string().trim().min(1).optional(),
  headline_priority: z.number().min(0).max(100),
  show_on_home: z.boolean(),
  launch_wave: z.string().trim().min(1).optional(),
  launch_phase: z.string().trim().min(1).optional(),
  publication_review_profile_id: z.string().trim().min(1).optional(),
  default_editorial_shelf_ids: z.array(z.string().trim().min(1)).default([]),
  editorial_shelf: z.array(z.string().trim().min(1)).default([]),
  creator_note_policy: z.string().trim().min(1).optional().nullable(),
}).passthrough()

const contentContractSchema = z.object({
  promise_to_viewer: z.string().trim().min(1),
  must_feel_like: z.array(z.string().trim().min(1)).min(1),
  must_not_feel_like: z.array(z.string().trim().min(1)).min(1),
  title_style: z.string().trim().min(1),
  hook_style: z.array(z.string().trim().min(1)).min(1),
  authoring_shapes: z.array(z.string().trim().min(1)).optional(),
  allowed_content_shapes: z.array(z.string().trim().min(1)).optional(),
  avoid_patterns: z.array(z.string().trim().min(1)).default([]),
  creator_note_policy: z.string().trim().min(1).optional().nullable(),
}).passthrough()

const launchCommunityRulesSchema = z.object({
  launch_profile: launchProfileSchema,
  content_contract: contentContractSchema,
  stage_spec_patch: z.record(z.string(), z.unknown()).default({}),
  scene_mix: z.record(z.string(), z.number().min(0)).default({}),
  cast_policy: z.object({
    min_resident_anchor: z.number().min(0),
    min_resident_contrast: z.number().min(0),
    min_guest_crossovers: z.number().min(0),
    wildcard_probability: z.number().min(0).max(1),
    must_have_runtime_roles: z.array(z.string().trim().min(1)).min(1),
    forbidden_pairings: z.array(z.string().trim().min(1)).default([]),
  }).passthrough(),
  visual_policy: z.record(z.string(), z.unknown()),
  quality_policy: z.record(z.string(), z.unknown()).optional(),
  discovery_policy: z.record(z.string(), z.unknown()),
  cross_route_policy: z.object({
    handoff_targets: z.array(z.string().trim().min(1)).default([]),
    preferred_spinoff_communities: z.array(z.string().trim().min(1)).default([]),
    allow_aftershow_export: z.boolean(),
    allow_t4_rewrite: z.boolean(),
  }).passthrough(),
  t4_policy: z.object({
    enabled: z.boolean(),
  }).passthrough(),
  governance_policy: z.record(z.string(), z.unknown()).optional(),
  metrics_policy: z.record(z.string(), z.unknown()).optional(),
}).strict()

const sharedDefaultsSchema = z.object({
  quality_policy: z.record(z.string(), z.unknown()),
  governance_policy: z.record(z.string(), z.unknown()),
  metrics_policy: z.record(z.string(), z.unknown()),
}).strict()

const launchCommunityFileSchema = z.object({
  version: z.number().int().positive(),
  draft_status: z.string().trim().min(1),
  materialization_notes: z.array(z.string().trim().min(1)).default([]),
  shared_policy_defaults: sharedDefaultsSchema,
  communities: z.array(z.object({
    slug: z.string().trim().min(1),
    name: z.string().trim().min(1),
    community_lifecycle_state: lifecycleStateSchema,
    stage_template_ref: z.string().trim().min(1),
    rules_json: launchCommunityRulesSchema,
  }).strict()),
})

const stageTemplateFileSchema = z.object({
  template_id: z.string().trim().min(1),
  template_version: z.string().trim().min(1),
  stage_spec: z.record(z.string(), z.unknown()),
}).passthrough()

export interface LaunchCommunitySeedSpec {
  seed_key: string
  slug: string
  name: string
  description: string
  community_lifecycle_state: CommunityLifecycleState
  rules_json: Record<string, unknown>
}

export interface LaunchCommunityRuntime {
  version: number
  draft_status: string
  materialization_notes: string[]
  shared_policy_defaults: z.infer<typeof sharedDefaultsSchema>
  communities: LaunchCommunitySeedSpec[]
}

const TOP_LEVEL_RULE_KEYS = [
  'community_lifecycle_state',
  'launch_profile',
  'content_contract',
  'stage_spec_v1',
  'scene_mix',
  'cast_policy',
  'visual_policy',
  'quality_policy',
  'discovery_policy',
  'cross_route_policy',
  't4_policy',
  'governance_policy',
  'metrics_policy',
] as const

let cachedLaunchCommunityRules: LaunchCommunityRuntime | null = null

function toValidationMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ')
}

function readYaml(pathname: string): unknown {
  return parseYaml(readFileSync(pathname, 'utf8'))
}

function loadStageTemplateStageSpec(templateRef: string): StageSpecV1 {
  const templatePath = resolve(STAGE_TEMPLATE_ROOT, `${templateRef}.yaml`)
  const parsed = stageTemplateFileSchema.safeParse(readYaml(templatePath))
  if (!parsed.success) {
    throw new ValidationError(`Invalid stage template ${templateRef}: ${toValidationMessage(parsed.error)}`)
  }
  return parseStageSpecV1(parsed.data.stage_spec)
}

function readTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function buildCommunitySemanticContract(input: {
  community_lifecycle_state: CommunityLifecycleState
  launch_profile: Record<string, unknown>
  content_contract: Record<string, unknown>
}): CommunitySemanticContract {
  const communityFamily = normalizeCommunityFamily(
    readTrimmedString(input.launch_profile.community_family) ?? readTrimmedString(input.launch_profile.community_type),
  )
  if (!communityFamily) {
    throw new ValidationError('Invalid launch community rules: launch_profile.community_family must resolve to a canonical community_family')
  }

  const communityShellCategory = normalizeCommunityShellCategory(
    readTrimmedString(input.launch_profile.community_shell_category),
  ) ?? deriveCommunityShellCategory(communityFamily)

  const publicationReviewProfileId = normalizePublicationReviewProfileId(
    readTrimmedString(input.launch_profile.publication_review_profile_id),
  ) ?? derivePublicationReviewProfileId(communityFamily)

  const defaultEditorialShelfIds = [
    ...new Set(
      readStringArray(input.launch_profile.default_editorial_shelf_ids).map((item) => normalizeEditorialShelfId(item))
        .concat(readStringArray(input.launch_profile.editorial_shelf).map((item) => normalizeEditorialShelfId(item)))
        .filter((item): item is NonNullable<typeof item> => item !== null),
    ),
  ]

  return {
    community_family: communityFamily,
    community_shell_category: communityShellCategory,
    publication_review_profile_id: publicationReviewProfileId,
    community_lifecycle_state: input.community_lifecycle_state,
    launch_wave: readTrimmedString(input.launch_profile.launch_wave) ?? readTrimmedString(input.launch_profile.launch_phase),
    default_editorial_shelf_ids: defaultEditorialShelfIds,
    authoring_shapes: readStringArray(input.content_contract.authoring_shapes)
      .concat(readStringArray(input.content_contract.allowed_content_shapes))
      .map((item) => normalizeAuthoringShapeId(item))
      .filter((item): item is string => item !== null),
    creator_note_policy:
      readTrimmedString(input.launch_profile.creator_note_policy)
      ?? readTrimmedString(input.content_contract.creator_note_policy),
  }
}

export function resolveLaunchCommunitySemanticContract(
  rulesJson: Record<string, unknown> | null | undefined,
): CommunitySemanticContract | null {
  if (!rulesJson) return null
  const launchProfile = rulesJson.launch_profile
  const contentContract = rulesJson.content_contract
  const lifecycleState = readTrimmedString(rulesJson.community_lifecycle_state) as CommunityLifecycleState | null
  if (
    !lifecycleState
    || typeof launchProfile !== 'object'
    || launchProfile === null
    || Array.isArray(launchProfile)
    || typeof contentContract !== 'object'
    || contentContract === null
    || Array.isArray(contentContract)
  ) {
    return null
  }

  try {
    return buildCommunitySemanticContract({
      community_lifecycle_state: lifecycleState,
      launch_profile: launchProfile as Record<string, unknown>,
      content_contract: contentContract as Record<string, unknown>,
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return null
    }
    throw error
  }
}

export function resolveLaunchCommunityInteractionContract(
  rulesJson: Record<string, unknown> | null | undefined,
): CommunityInteractionContract | null {
  if (!rulesJson) return null
  const stageSpec = rulesJson.stage_spec_v1
  if (!stageSpec || typeof stageSpec !== 'object' || Array.isArray(stageSpec)) {
    return null
  }
  const humanParticipation = (stageSpec as Record<string, unknown>).human_participation
  if (!humanParticipation || typeof humanParticipation !== 'object' || Array.isArray(humanParticipation)) {
    return resolveCommunityInteractionContract({})
  }

  const record = humanParticipation as Record<string, unknown>
  return resolveCommunityInteractionContract({
    mode: readTrimmedString(record.mode),
    public_participation_mode: readTrimmedString(record.public_participation_mode),
    audience_signal_ingestion: readTrimmedString(record.audience_signal_ingestion),
    agent_human_response_mode: readTrimmedString(record.agent_human_response_mode),
    audience_zone_enabled: record.audience_zone_enabled === true,
    agent_reads_audience_zone: record.agent_reads_audience_zone === true,
    agent_reply_via_aftershow: record.agent_reply_via_aftershow === true,
  })
}

function normalizeCrossRouteTargets(
  value: unknown,
  communityByAlias: Map<string, { slug: string; name: string }>,
  pathLabel: string,
): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => {
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new ValidationError(`Invalid launch community rules: ${pathLabel}[${index}] must be a non-empty string`)
    }
    const resolved = communityByAlias.get(item.trim())
    if (!resolved) {
      throw new ValidationError(`Invalid launch community rules: ${pathLabel}[${index}] must reference one of the 12 launch communities`)
    }
    return resolved.slug
  })
}

function collectAllowedRuntimeRoles(): Set<string> {
  const roster = getLaunchSystemRoster()
  return new Set<string>(
    roster.roster.map((entry) => entry.program_role).concat(['anchor', 'challenger', 'wildcard', 'mc', 'creator', 'showrunner', 'editor']),
  )
}

function validateTopLevelRuleKeys(rulesJson: Record<string, unknown>, slug: string): void {
  const keys = Object.keys(rulesJson).sort()
  const expected = [...TOP_LEVEL_RULE_KEYS].sort()
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new ValidationError(
      `Invalid launch community rules: ${slug} must materialize the exact 13 top-level rule blocks`,
    )
  }
}

function normalizeLaunchCommunityRuntime(input: unknown): LaunchCommunityRuntime {
  getSemanticTaxonomyRegistry()
  const parsed = launchCommunityFileSchema.safeParse(input)
  if (!parsed.success) {
    throw new ValidationError(`Invalid launch community rules: ${toValidationMessage(parsed.error)}`)
  }

  const file = parsed.data
  if (file.communities.length !== 12) {
    throw new ValidationError('Invalid launch community rules: expected exactly 12 launch communities')
  }

  const slugSet = new Set<string>()
  const nameSet = new Set<string>()
  const communityByAlias = new Map<string, { slug: string; name: string }>()
  for (const community of file.communities) {
    if (slugSet.has(community.slug)) {
      throw new ValidationError(`Invalid launch community rules: duplicate slug "${community.slug}"`)
    }
    if (nameSet.has(community.name)) {
      throw new ValidationError(`Invalid launch community rules: duplicate name "${community.name}"`)
    }
    slugSet.add(community.slug)
    nameSet.add(community.name)
    communityByAlias.set(community.slug, { slug: community.slug, name: community.name })
    communityByAlias.set(community.name, { slug: community.slug, name: community.name })
  }

  const allowedRuntimeRoles = collectAllowedRuntimeRoles()

  const communities = file.communities.map((community) => {
    const stageTemplate = loadStageTemplateStageSpec(community.stage_template_ref)
    const stageSpec = parseStageSpecV1(
      deepMerge(stageTemplate, community.rules_json.stage_spec_patch) as Record<string, unknown>,
    )

    const sceneMixTotal = Object.values(community.rules_json.scene_mix).reduce((sum, value) => sum + value, 0)
    if (Math.abs(sceneMixTotal - 1) > 0.001) {
      throw new ValidationError(
        `Invalid launch community rules: ${community.slug} scene_mix must sum to 1.0`,
      )
    }

    for (const role of community.rules_json.cast_policy.must_have_runtime_roles) {
      if (!allowedRuntimeRoles.has(role)) {
        throw new ValidationError(
          `Invalid launch community rules: ${community.slug} must_have_runtime_roles contains unsupported runtime role "${role}"`,
        )
      }
    }

    const t4Enabled = community.rules_json.t4_policy.enabled
    if (t4Enabled && !community.stage_template_ref.startsWith('stage-t4-')) {
      throw new ValidationError(
        `Invalid launch community rules: ${community.slug} T4 communities must bind a T4 stage template`,
      )
    }
    if (!t4Enabled && community.stage_template_ref.startsWith('stage-t4-')) {
      throw new ValidationError(
        `Invalid launch community rules: ${community.slug} T4 stage templates require t4_policy.enabled=true`,
      )
    }

    const crossRoutePolicy = {
      ...community.rules_json.cross_route_policy,
      handoff_targets: normalizeCrossRouteTargets(
        community.rules_json.cross_route_policy.handoff_targets,
        communityByAlias,
        `${community.slug}.cross_route_policy.handoff_targets`,
      ),
      preferred_spinoff_communities: normalizeCrossRouteTargets(
        community.rules_json.cross_route_policy.preferred_spinoff_communities,
        communityByAlias,
        `${community.slug}.cross_route_policy.preferred_spinoff_communities`,
      ),
    }

    const governancePolicy = deepMerge(
      file.shared_policy_defaults.governance_policy,
      community.rules_json.governance_policy ?? {},
    ) as Record<string, unknown>
    const qualityPolicy = deepMerge(
      file.shared_policy_defaults.quality_policy,
      community.rules_json.quality_policy ?? {},
    ) as Record<string, unknown>
    const metricsPolicy = deepMerge(
      file.shared_policy_defaults.metrics_policy,
      community.rules_json.metrics_policy ?? {},
    ) as Record<string, unknown>

    const communitySemanticContract = buildCommunitySemanticContract({
      community_lifecycle_state: community.community_lifecycle_state,
      launch_profile: community.rules_json.launch_profile,
      content_contract: community.rules_json.content_contract,
    })

    const {
      community_type: _legacyCommunityType,
      launch_phase: _legacyLaunchPhase,
      ...canonicalLaunchProfile
    } = community.rules_json.launch_profile

    const rulesJson = {
      community_lifecycle_state: community.community_lifecycle_state,
      launch_profile: {
        ...canonicalLaunchProfile,
        community_family: communitySemanticContract.community_family,
        community_shell_category: communitySemanticContract.community_shell_category,
        publication_review_profile_id: communitySemanticContract.publication_review_profile_id,
        launch_wave: communitySemanticContract.launch_wave ?? null,
        default_editorial_shelf_ids: communitySemanticContract.default_editorial_shelf_ids,
        editorial_shelf:
          readStringArray(community.rules_json.launch_profile.editorial_shelf).length > 0
            ? readStringArray(community.rules_json.launch_profile.editorial_shelf)
            : communitySemanticContract.default_editorial_shelf_ids,
      },
      content_contract: {
        ...community.rules_json.content_contract,
        authoring_shapes: communitySemanticContract.authoring_shapes ?? [],
        allowed_content_shapes:
          readStringArray(community.rules_json.content_contract.allowed_content_shapes).length > 0
            ? readStringArray(community.rules_json.content_contract.allowed_content_shapes)
            : communitySemanticContract.authoring_shapes ?? [],
        creator_note_policy: communitySemanticContract.creator_note_policy ?? null,
      },
      stage_spec_v1: stageSpec,
      scene_mix: community.rules_json.scene_mix,
      cast_policy: community.rules_json.cast_policy,
      visual_policy: community.rules_json.visual_policy,
      quality_policy: qualityPolicy,
      discovery_policy: community.rules_json.discovery_policy,
      cross_route_policy: crossRoutePolicy,
      t4_policy: community.rules_json.t4_policy,
      governance_policy: governancePolicy,
      metrics_policy: metricsPolicy,
    }

    validateTopLevelRuleKeys(rulesJson, community.slug)

    return {
      seed_key: `community.${community.slug}`,
      slug: community.slug,
      name: community.name,
      description: community.rules_json.content_contract.promise_to_viewer,
      community_lifecycle_state: community.community_lifecycle_state,
      rules_json: rulesJson,
    } satisfies LaunchCommunitySeedSpec
  })

  return {
    version: file.version,
    draft_status: file.draft_status,
    materialization_notes: file.materialization_notes,
    shared_policy_defaults: file.shared_policy_defaults,
    communities,
  }
}

export function getLaunchCommunityRules(
  pathname = DEFAULT_LAUNCH_COMMUNITY_RULES_PATH,
): LaunchCommunityRuntime {
  if (pathname === DEFAULT_LAUNCH_COMMUNITY_RULES_PATH && cachedLaunchCommunityRules) {
    return cachedLaunchCommunityRules
  }
  const runtime = normalizeLaunchCommunityRuntime(readYaml(pathname))
  if (pathname === DEFAULT_LAUNCH_COMMUNITY_RULES_PATH) {
    cachedLaunchCommunityRules = runtime
  }
  return runtime
}

export function listLaunchCommunitySeeds(): LaunchCommunitySeedSpec[] {
  return getLaunchCommunityRules().communities
}

export function getLaunchCoreCommunitySeed(): LaunchCommunitySeedSpec {
  return listLaunchCommunitySeeds().find((community) => community.community_lifecycle_state === 'launch_core')
    ?? listLaunchCommunitySeeds()[0]!
}

export function getLaunchCommunityBySlug(slug: string): LaunchCommunitySeedSpec | null {
  return listLaunchCommunitySeeds().find((community) => community.slug === slug) ?? null
}

function slugifyProposalName(name: string): string {
  const ascii = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii.length > 0) return ascii
  return `proposal-${Date.now().toString(36)}`
}

export function buildGovernedCommunityRulesSkeleton(input: {
  name: string
  slug?: string
  description: string
  premise_text: string
  target_audience?: string | null
  scene_types?: string[]
  proposed_community_family: CommunitySemanticContract['community_family']
  publication_review_profile_id?: CommunitySemanticContract['publication_review_profile_id'] | null
  launch_wave?: string | null
  interaction_contract?: CommunityInteractionContract | null
  t4_candidate?: boolean
  lifecycle_state: CommunityLifecycleState
  incubation_visibility_mode?: CommunityIncubationVisibilityMode | null
}): Record<string, unknown> {
  const slug = input.slug?.trim() || slugifyProposalName(input.name)
  const sceneTypes = input.scene_types?.filter((item) => item.trim().length > 0) ?? []
  const publicationReviewProfileId =
    input.publication_review_profile_id
    ?? derivePublicationReviewProfileId(input.proposed_community_family)
  const interactionContract =
    input.interaction_contract
    ?? resolveCommunityInteractionContract({})
  const strictPublication =
    publicationReviewProfileId === 'creator_strict_publication'
    || input.proposed_community_family.startsWith('creator_')
  const defaultSceneMix = sceneTypes.length > 0
    ? Object.fromEntries(sceneTypes.map((sceneType) => [sceneType, Number((1 / sceneTypes.length).toFixed(4))]))
    : { TALK_SHOW: 1 }
  const stageSpec = parseStageSpecV1({
    version: 'v1',
    min_tier_pool: strictPublication ? 'T3' : 'T2',
    tier_gate: {
      resident_min_tier: strictPublication ? 'T3' : 'T2',
      core_min_tier: strictPublication ? 'T4' : 'T3',
      t4_longform_min_tier: 'T4',
    },
    strict_t4: {
      enabled: strictPublication || input.t4_candidate === true,
      premod_required: true,
      min_sources: 3,
      grant_required: true,
      max_ttl_hours: 168,
      redaction: 'strong',
    },
    aftershow: {
      enabled: true,
      mode: 'THRESHOLD',
      threshold: {
        audience_comments: 12,
        human_vote_score: 4,
      },
    },
    human_participation: interactionContract,
  })

  const rulesJson = {
    community_lifecycle_state: input.lifecycle_state,
    launch_profile: {
      community_family: input.proposed_community_family,
      community_shell_category: deriveCommunityShellCategory(input.proposed_community_family),
      headline_priority: 20,
      show_on_home: false,
      launch_wave: input.launch_wave ?? input.lifecycle_state,
      default_editorial_shelf_ids: [],
      publication_review_profile_id: publicationReviewProfileId,
      creator_note_policy: strictPublication ? 'native_creator_note_lane' : null,
      source_contract: 't144_proposal_bootstrap',
      governed_slug: slug,
    },
    content_contract: {
      promise_to_viewer: input.description,
      must_feel_like: [input.premise_text],
      must_not_feel_like: ['空泛重复', '无边界扩散'],
      title_style: '提案孵化式',
      hook_style: ['先给 premise', '先讲观众价值'],
      authoring_shapes: ['discussion_root', 'story_episode', 'aftershow_recap'],
      avoid_patterns: ['无目标闲聊'],
      creator_note_policy: strictPublication ? 'native_creator_note_lane' : null,
      target_audience: input.target_audience ?? null,
    },
    stage_spec_v1: stageSpec,
    scene_mix: defaultSceneMix,
    cast_policy: {
      min_resident_anchor: 1,
      min_resident_contrast: 1,
      min_guest_crossovers: 0,
      wildcard_probability: strictPublication ? 0.1 : 0.2,
      must_have_runtime_roles: strictPublication ? ['creator', 'editor'] : ['anchor'],
      forbidden_pairings: [],
    },
    visual_policy: {
      root_cover_probability: strictPublication ? 0.2 : 0.1,
      reply_image_probability: 0,
      highlight_hero_required: false,
      aftershow_visual_required: false,
      preferred_visual_modes: strictPublication ? ['note_cover'] : ['headline_card'],
    },
    quality_policy: {
      max_same_topic_repeats_per_24h: 2,
      min_opposition_density: strictPublication ? 0.1 : 0.2,
      repeat_penalty_multiplier: 0.85,
      polite_consensus_penalty: 0.8,
      low_watchability_deboost: 0.75,
    },
    discovery_policy: {
      homepage_boost: 0.2,
      hot_feed_bias: 0.2,
      new_feed_bias: 0.4,
      creator_note_feed_bias: strictPublication ? 1 : 0,
      cross_community_route_bias: 0.5,
    },
    cross_route_policy: {
      handoff_targets: [],
      preferred_spinoff_communities: [],
      allow_aftershow_export: false,
      allow_t4_rewrite: strictPublication || input.t4_candidate === true,
    },
    t4_policy: {
      enabled: strictPublication || input.t4_candidate === true,
    },
    governance_policy: {
      default_visibility: input.lifecycle_state === 'incubating_gray' ? 'GRAY' : 'PUBLIC',
      gray_threshold_profile: 'launch_default',
      quarantine_profile: 'launch_default',
      manual_review_required_for_formats: [],
      high_risk_topic_blocks: [],
      incubation_visibility_mode: input.incubation_visibility_mode ?? null,
      proposal_source: 'community_proposal',
    },
    metrics_policy: {
      primary_kpis: ['watch_time', 'revisit_rate'],
      secondary_kpis: ['reply_depth', 'cross_route_export_rate'],
      watchability_weight: 1,
      community_specific_quality_flags: ['governed_bootstrap'],
    },
  }

  validateTopLevelRuleKeys(rulesJson, slug)
  return rulesJson
}
