import type { ForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import type { ForumSceneMetadata } from '../repos/types.js'
import type {
  EpisodeBrief,
  LocalIntent,
  SceneBindingV1,
  SceneMetadata,
  ScenePoolCatalog,
  StageTemplateV2,
} from '../stage/index.js'
import { PublicSceneCatalogService } from './public-scene-catalog-service.js'
import {
  buildLocalIntentBlock,
  generateSceneId,
  type PublicSceneWritePayload,
} from './public-scene-runtime.js'
import type { ForumDirectorPlanEnrichmentService } from './forum-director-plan-enrichment-service.js'
import {
  getLaunchCreatorNoteTemplateRuntime,
  resolveLaunchCreatorNoteProjection,
} from '../launch/creator-note-templates.js'
interface EligibleCommunity {
  id: string
  slug: string
  name: string
  description: string
  rules: string
}

interface SelectedAgentLike {
  id: string
  display_name: string
}

interface EligibleTarget {
  community_id: string
  community_slug: string
  community_name: string
  community_description: string
  community_rules: string
  writable: boolean
  membership_source: 'direct' | 'derived'
}

interface ExistingEpisodeMetadata {
  episode_id: string
  director_surface: SceneMetadata['director_surface']
  actor_surface: SceneMetadata['actor_surface']
  scene_template_id: string
  scene_template_version: string
  scene_binding_id: string | null
  overlay_id: string | null
  phase: SceneMetadata['phase']
  selection_mode: SceneMetadata['selection_mode']
  expires_at: string | null
}

type SelectorEntryKind = 'scheduled_post' | 'forum_post_seed' | 'forum_thread_followup'
type SelectorMode = 'pool_guided' | 'pool_strict' | 'autonomous_anchored'
type SelectorHardFilterReason =
  | 'surface_mismatch'
  | 'binding_target_mismatch'
  | 'binding_inactive'
  | 'template_blocked'
  | 'cooldown_active'
  | 'daily_limit_reached'
  | 'risk_rejected'
  | 'continuity_required'

interface CandidateScoreBreakdown {
  viewer_fit: number
  growth_fit: number
  cast_fit: number
  continuity_fit: number
  freshness: number
  novelty: number
  editorial_priority: number
  fatigue_penalty: number
  risk_penalty: number
  repeat_penalty: number
  total_score: number
}

interface RankedCandidate {
  binding: SceneBindingV1
  template: StageTemplateV2
  target: EligibleTarget
  score_breakdown: CandidateScoreBreakdown
}

interface SelectorFallback {
  reason: string
  action: 'abort' | 'continue_without_scene'
}

interface SelectorSceneResult {
  kind: 'scene'
  target: EligibleTarget
  payload: PublicSceneWritePayload
}

interface SelectorSkipResult {
  kind: 'skip'
  skip: SelectorFallback
  audit: Record<string, unknown>
}

export type ScheduledPostSceneSelection =
  | {
      kind: 'scene'
      community: EligibleCommunity
      payload: PublicSceneWritePayload
    }
  | {
      kind: 'skip'
      reason: string
    }

/**
 * T-212 M3 — `selectFromDiscussionCue` outcome.
 *
 * `dry_run` is the prewarm shape (no DB writes, no enrichment); `scene` is
 * the live selection with the cast vector preserved in `selection_audit`;
 * `skip` mirrors the autonomous-path skip semantics. Note that
 * `selectScheduledPost` is **not modified** — both methods produce
 * `PublicSceneWritePayload` but never share branches inside the service.
 */
export type CueSceneSelection =
  | {
      kind: 'scene'
      community: EligibleCommunity
      payload: PublicSceneWritePayload
      /**
       * Full cast vector (1..N). The first element is the primary author
       * passed to `forumWriteService.createPost`; the rest provide scene
       * context (e.g. for next-turn responders). Worker (M4) MUST treat
       * `actor_agent_id = selected_cast[0].id` (T-212 R3 / R10).
       */
      selected_cast: SelectedAgentLike[]
    }
  | { kind: 'skip'; reason: string }

export type CueSceneDryRunResult = {
  kind: 'dry_run'
  cue_id: string
  brief_compiled: true
  candidate_pool_size: number
  selected_cast_estimate: SelectedAgentLike[]
}

export class PublicSceneSelectorService {
  constructor(
    private readonly deps: {
      catalogService: PublicSceneCatalogService
      sceneMetadataRepo: ForumSceneMetadataRepository
      directorPlanEnrichmentService?: Pick<ForumDirectorPlanEnrichmentService, 'enrichRootScene'> | null
    },
  ) {}

  async selectScheduledPost(input: {
    agent: SelectedAgentLike
    eligible_communities: EligibleCommunity[]
  }): Promise<ScheduledPostSceneSelection> {
    const eligibleTargets = input.eligible_communities.map((community) => ({
      community_id: community.id,
      community_slug: community.slug,
      community_name: community.name,
      community_description: community.description,
      community_rules: community.rules,
      writable: true,
      membership_source: 'direct' as const,
    }))
    const result = await this.selectNewEpisodeForumScene({
      request_id: generateSceneId('scene_req'),
      entry_kind: 'scheduled_post',
      selector_mode: 'pool_guided',
      director_surface: 'scheduled_post',
      actor_surface: 'forum_post',
      selected_agent: input.agent,
      eligible_targets: eligibleTargets,
    })
    if (result.kind === 'skip') {
      return { kind: 'skip', reason: result.skip.reason }
    }

    const community = input.eligible_communities.find((item) => item.id === result.target.community_id)
    if (!community) {
      return { kind: 'skip', reason: 'binding_target_missing' }
    }

    return {
      kind: 'scene',
      community,
      payload: result.payload,
    }
  }

  /**
   * T-212 M3 — cue-driven scene selection.
   *
   * Wraps `selectNewEpisodeForumScene` with cue context: the cue's community
   * is locked as the target, the primary author is `agents[0]`, and the full
   * cast vector + cue audit refs land in `selection_audit.cue_*`. The cue's
   * theme intent / scene constraints / role requirements travel via the
   * `DirectorCueBrief` sidecar (the worker / runtime consume them outside
   * the selector — the selector itself doesn't override template choice in
   * MVP; that's a post-T-212 refinement).
   *
   * `selectScheduledPost` is **not modified** by T-212.
   *
   * `dryRun=true` skips persistence and the catalog ranking, returning a
   * shape the prewarm path (M5) can use to surface candidate-pool size
   * without committing.
   */
  async selectFromDiscussionCue(input: {
    cue: { id: string; community_id: string }
    brief: { audit_refs: { schedule_id: string; cue_id: string; attempt_id: string } }
    agents: SelectedAgentLike[]
    community: EligibleCommunity
    dryRun?: boolean
  }): Promise<CueSceneSelection | CueSceneDryRunResult> {
    if (input.agents.length === 0) {
      return { kind: 'skip', reason: 'cue_no_agents' }
    }
    if (input.cue.community_id !== input.community.id) {
      return { kind: 'skip', reason: 'cue_community_mismatch' }
    }

    if (input.dryRun) {
      return {
        kind: 'dry_run',
        cue_id: input.cue.id,
        brief_compiled: true,
        candidate_pool_size: input.agents.length,
        selected_cast_estimate: input.agents.slice(0, 8),
      }
    }

    const eligibleTarget: EligibleTarget = {
      community_id: input.community.id,
      community_slug: input.community.slug,
      community_name: input.community.name,
      community_description: input.community.description,
      community_rules: input.community.rules,
      writable: true,
      membership_source: 'direct',
    }

    const result = await this.selectNewEpisodeForumScene({
      request_id: generateSceneId('cue_scene_req'),
      entry_kind: 'forum_post_seed',
      selector_mode: 'pool_guided',
      director_surface: 'forum',
      actor_surface: 'forum_post',
      selected_agent: input.agents[0],
      eligible_targets: [eligibleTarget],
      locked_target: {
        community_id: input.community.id,
        community_slug: input.community.slug,
      },
    })

    if (result.kind === 'skip') {
      return { kind: 'skip', reason: result.skip.reason }
    }

    // Decorate selection_audit with cue context (T-212 R3 / R10): preserves
    // the full cast vector and cue audit refs so downstream consumers (M4
    // worker writes attempt rows; T-215 surfaces audit chain) can reconstruct
    // the cue → scene → cast linkage without re-reading the cue table.
    const decoratedPayload: PublicSceneWritePayload = {
      ...result.payload,
      selection_audit: {
        ...(result.payload.selection_audit ?? {}),
        cue_audit_refs: input.brief.audit_refs,
        cue_cast_pool: input.agents.map((a) => ({ id: a.id, display_name: a.display_name })),
        cue_primary_author_id: input.agents[0].id,
      },
    }

    return {
      kind: 'scene',
      community: input.community,
      payload: decoratedPayload,
      selected_cast: input.agents,
    }
  }

  async selectForumPostSeed(input: {
    agent: SelectedAgentLike
    community: EligibleCommunity
  }): Promise<ScheduledPostSceneSelection> {
    const result = await this.selectNewEpisodeForumScene({
      request_id: generateSceneId('scene_req'),
      entry_kind: 'forum_post_seed',
      selector_mode: 'pool_guided',
      director_surface: 'forum',
      actor_surface: 'forum_post',
      selected_agent: input.agent,
      eligible_targets: [{
        community_id: input.community.id,
        community_slug: input.community.slug,
        community_name: input.community.name,
        community_description: input.community.description,
        community_rules: input.community.rules,
        writable: true,
        membership_source: 'direct',
      }],
      locked_target: {
        community_id: input.community.id,
        community_slug: input.community.slug,
      },
    })
    if (result.kind === 'skip') {
      return { kind: 'skip', reason: result.skip.reason }
    }

    return {
      kind: 'scene',
      community: input.community,
      payload: result.payload,
    }
  }

  async selectForumThreadFollowup(input: {
    community_id: string
    post_id: string
    thread_id?: string
    turn_id?: string
    post_author_agent_id?: string
    target_thread_author_agent_id?: string
    target_turn_author_agent_id?: string
    existing_scene_metadata: ExistingEpisodeMetadata
  }): Promise<
    | {
        kind: 'scene'
        payload: PublicSceneWritePayload
      }
    | {
        kind: 'skip'
        reason: string
      }
  > {
    const catalog = this.deps.catalogService.getLaunchCatalog()
    if (!catalog) {
      return { kind: 'skip', reason: 'scene_catalog_unavailable' }
    }

    const template = catalog.stage_templates.find((item) =>
      item.template_id === input.existing_scene_metadata.scene_template_id
      && item.template_version === input.existing_scene_metadata.scene_template_version)
    if (!template) {
      return { kind: 'skip', reason: 'existing_episode_missing' }
    }

    const now = new Date()
    const selectionId = generateSceneId('scene_sel')
    const episodePlanId = generateSceneId('episode_plan')
    const localIntentId = generateSceneId('local_intent')
    const phase = input.existing_scene_metadata.phase === 'aftershow'
      ? 'closure'
      : input.existing_scene_metadata.phase
    const targetRef = buildThreadFollowupTargetRef(input)
    const episodeBrief: EpisodeBrief = {
      episode_id: input.existing_scene_metadata.episode_id,
      director_surface: input.existing_scene_metadata.director_surface,
      actor_surface: 'forum_thread',
      template_id: template.template_id,
      template_version: template.template_version,
      binding_id: input.existing_scene_metadata.scene_binding_id ?? undefined,
      overlay_id: input.existing_scene_metadata.overlay_id ?? undefined,
      phase,
      scene_goal: template.director.scene_goal,
      target_mood: undefined,
      casting_directive: {
        must_have_roles: template.director.casting_recipe.must_have_roles,
        avoid_pairs: template.director.casting_recipe.avoid_pairs,
        core_quota: template.director.casting_recipe.ratio.core,
        contrast_quota: template.director.casting_recipe.ratio.contrast,
        wildcard_quota: template.director.casting_recipe.ratio.wildcard,
      },
      open_loops: [],
      must_hit_points: [],
      avoid_repeat: [],
      close_condition: {
        ttl_hours: template.director.closing_policy.ttl_hours,
        message_threshold: template.director.closing_policy.message_threshold,
        objective: template.director.scene_goal.viewer_goal,
      },
      expires_at: input.existing_scene_metadata.expires_at ?? new Date(
        now.getTime() + template.director.closing_policy.ttl_hours * 3600_000,
      ).toISOString(),
    }

    const localIntent: LocalIntent = {
      intent_id: localIntentId,
      delivery_surface: 'forum_thread',
      initiative: phase === 'closure' ? 'close' : 'reply',
      opinion_policy: 'free_opinion',
      relation_focus: deriveRelationFocus(template),
      tone_hint: deriveToneHint(template),
      privacy_mode: 'public_only',
      memory_scope: 'public_episode_continuity',
      reference_scope: 'thread_only',
      prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
      target_ref: targetRef,
      hard_constraints: [
        '延续当前 episode，不重选场景',
        '只依据公开线程内容继续推进',
        '不要泄露任何隐藏导演目标或私域信息',
      ],
      soft_constraints: [
        template.director.scene_goal.viewer_goal,
        template.director.scene_goal.growth_goal,
        `保持 episode phase=${phase}`,
      ].filter((item) => item.trim().length > 0),
    }

    const sceneMetadata: SceneMetadata = {
      director_surface: input.existing_scene_metadata.director_surface,
      actor_surface: 'forum_thread',
      scene_template_id: template.template_id,
      scene_template_version: template.template_version,
      scene_binding_id: input.existing_scene_metadata.scene_binding_id,
      overlay_id: input.existing_scene_metadata.overlay_id,
      episode_id: input.existing_scene_metadata.episode_id,
      beat_id: null,
      phase,
      selection_mode: input.existing_scene_metadata.selection_mode,
      selection_id: selectionId,
      episode_plan_id: episodePlanId,
      local_intent_id: localIntentId,
      started_at: now.toISOString(),
      expires_at: episodeBrief.expires_at,
    }

    const selectionAudit = {
      selection_id: selectionId,
      request_id: selectionId,
      entry_kind: 'forum_thread_followup',
      selector_mode: input.existing_scene_metadata.selection_mode,
      episode_strategy: 'continue_episode',
      hard_filter_reasons: [],
      candidate_scores: [
        {
          binding_id: input.existing_scene_metadata.scene_binding_id,
          community_id: input.community_id,
          score_breakdown: {
            viewer_fit: 20,
            growth_fit: 16,
            cast_fit: 8,
            continuity_fit: 36,
            freshness: 0,
            novelty: 0,
            editorial_priority: 10,
            fatigue_penalty: 0,
            risk_penalty: 0,
            repeat_penalty: 0,
            total_score: 90,
          },
        },
      ],
      fallback: null,
    }
    const planningAudit = {
      request_id: selectionId,
      entry_kind: 'forum_thread_followup',
      episode_strategy: 'continue_episode',
      episode_id: input.existing_scene_metadata.episode_id,
      selection_id: selectionId,
      episode_plan_id: episodePlanId,
      local_intent_id: localIntentId,
      target_community_id: input.community_id,
      target_thread_id: input.thread_id ?? null,
      target_turn_id: input.turn_id ?? null,
      phase,
    }

    return {
      kind: 'scene',
      payload: {
        scene_metadata: sceneMetadata,
        episode_brief: episodeBrief,
        local_intent: localIntent,
        local_intent_block: buildLaunchAwareLocalIntentBlock({
          localIntent,
          episodeBrief,
          communitySlug: null,
        }),
        selection_audit: selectionAudit,
        planning_audit: planningAudit,
        launch_programming: buildLaunchProgrammingHints({
          communitySlug: null,
          episodeBrief,
          phase,
        }),
      },
    }
  }

  private async selectNewEpisodeForumScene(input: {
    request_id: string
    entry_kind: Extract<SelectorEntryKind, 'scheduled_post' | 'forum_post_seed'>
    selector_mode: SelectorMode
    director_surface: Extract<SceneMetadata['director_surface'], 'forum' | 'scheduled_post'>
    actor_surface: Extract<SceneMetadata['actor_surface'], 'forum_post'>
    selected_agent: SelectedAgentLike
    eligible_targets: EligibleTarget[]
    locked_target?: {
      community_id: string
      community_slug: string
    }
  }): Promise<SelectorSceneResult | SelectorSkipResult> {
    const catalog = this.deps.catalogService.getLaunchCatalog()
    if (!catalog) {
      return this.buildSkipResult(input, {
        reason: 'scene_catalog_unavailable',
        action: 'abort',
      }, [])
    }

    const ranking = await this.rankForumCandidates(catalog, input)
    const selected = ranking.candidates[0]
    if (!selected) {
      return this.buildSkipResult(input, {
        reason: input.locked_target ? 'binding_target_missing' : 'no_pool_match',
        action: 'abort',
      }, ranking.hard_filter_reasons)
    }

    const now = new Date()
    const selectionId = generateSceneId('scene_sel')
    const episodePlanId = generateSceneId('episode_plan')
    const localIntentId = generateSceneId('local_intent')
    const episodeId = generateSceneId('episode')
    const expiresAt = new Date(
      now.getTime() + selected.template.director.closing_policy.ttl_hours * 3600_000,
    ).toISOString()
    const selectionMode = resolveSelectionMode(input.selector_mode, selected.template)

    const episodeBrief: EpisodeBrief = {
      episode_id: episodeId,
      director_surface: input.director_surface,
      actor_surface: input.actor_surface,
      template_id: selected.template.template_id,
      template_version: selected.template.template_version,
      binding_id: selected.binding.binding_id,
      phase: 'opening',
      scene_goal: selected.template.director.scene_goal,
      target_mood: undefined,
      casting_directive: {
        must_have_roles: selected.template.director.casting_recipe.must_have_roles,
        avoid_pairs: selected.template.director.casting_recipe.avoid_pairs,
        core_quota: selected.template.director.casting_recipe.ratio.core,
        contrast_quota: selected.template.director.casting_recipe.ratio.contrast,
        wildcard_quota: selected.template.director.casting_recipe.ratio.wildcard,
      },
      open_loops: [],
      must_hit_points: [],
      avoid_repeat: [],
      close_condition: {
        ttl_hours: selected.template.director.closing_policy.ttl_hours,
        message_threshold: selected.template.director.closing_policy.message_threshold,
        objective: selected.template.director.scene_goal.viewer_goal,
      },
      expires_at: expiresAt,
    }

    const localIntent: LocalIntent = {
      intent_id: localIntentId,
      delivery_surface: 'forum_post',
      initiative: 'open_topic',
      opinion_policy: 'free_opinion',
      relation_focus: deriveRelationFocus(selected.template),
      tone_hint: deriveToneHint(selected.template),
      privacy_mode: 'public_only',
      memory_scope: 'public_contextual',
      reference_scope: 'seed_only',
      prohibited_reference_types: ['owner_private_speech', 'private_memory', 'hidden_director_goal'],
      target_ref: { kind: 'none' },
      hard_constraints: [
        '只生成一条公开根帖，不模拟评论区后续',
        '不得改写已锁定的目标社区',
        '不要泄露任何隐藏导演目标或私域信息',
      ],
      soft_constraints: [
        selected.template.director.scene_goal.viewer_goal,
        selected.template.director.scene_goal.growth_goal,
      ].filter((item) => item.trim().length > 0),
    }

    const sceneMetadata: SceneMetadata = {
      director_surface: input.director_surface,
      actor_surface: input.actor_surface,
      scene_template_id: selected.template.template_id,
      scene_template_version: selected.template.template_version,
      scene_binding_id: selected.binding.binding_id,
      overlay_id: null,
      episode_id: episodeId,
      beat_id: null,
      phase: 'opening',
      selection_mode: selectionMode,
      selection_id: selectionId,
      episode_plan_id: episodePlanId,
      local_intent_id: localIntentId,
      started_at: now.toISOString(),
      expires_at: expiresAt,
    }

    const selectionAudit = {
      selection_id: selectionId,
      request_id: input.request_id,
      entry_kind: input.entry_kind,
      selector_mode: selectionMode,
      episode_strategy: 'new_episode',
      selected_candidate: {
        binding_id: selected.binding.binding_id,
        community_id: selected.target.community_id,
        community_slug: selected.target.community_slug,
        template_id: selected.template.template_id,
        template_version: selected.template.template_version,
      },
      hard_filter_reasons: ranking.hard_filter_reasons,
      candidate_scores: ranking.candidates.map((item) => ({
        binding_id: item.binding.binding_id,
        community_id: item.target.community_id,
        score_breakdown: item.score_breakdown,
      })),
      fallback: null,
    }
    const planningAudit = {
      request_id: input.request_id,
      entry_kind: input.entry_kind,
      agent_id: input.selected_agent.id,
      episode_strategy: 'new_episode',
      episode_id: episodeId,
      selection_id: selectionId,
      episode_plan_id: episodePlanId,
      local_intent_id: localIntentId,
      target_community_id: selected.target.community_id,
      phase: 'opening',
    }

    const enrichedRoot = await this.maybeEnrichRootScene({
      entry_kind: input.entry_kind,
      agent_id: input.selected_agent.id,
      target: selected.target,
      template: selected.template,
      scene_metadata: sceneMetadata,
      episode_brief: episodeBrief,
      local_intent: localIntent,
      planning_audit: planningAudit,
    })

    const launchProgramming = buildLaunchProgrammingHints({
      communitySlug: selected.target.community_slug,
      episodeBrief: enrichedRoot.episode_brief,
      phase: enrichedRoot.episode_brief.phase,
    })

    return {
      kind: 'scene',
      target: selected.target,
      payload: {
        scene_metadata: sceneMetadata,
        episode_brief: enrichedRoot.episode_brief,
        local_intent: enrichedRoot.local_intent,
        local_intent_block: buildLaunchAwareLocalIntentBlock({
          localIntent: enrichedRoot.local_intent,
          episodeBrief: enrichedRoot.episode_brief,
          communitySlug: selected.target.community_slug,
        }),
        selection_audit: selectionAudit,
        planning_audit: enrichedRoot.planning_audit,
        launch_programming: launchProgramming,
      },
    }
  }

  private async maybeEnrichRootScene(input: {
    entry_kind: Extract<SelectorEntryKind, 'scheduled_post' | 'forum_post_seed'>
    agent_id: string
    target: EligibleTarget
    template: StageTemplateV2
    scene_metadata: SceneMetadata
    episode_brief: EpisodeBrief
    local_intent: LocalIntent
    planning_audit: Record<string, unknown>
  }): Promise<{
    episode_brief: EpisodeBrief
    local_intent: LocalIntent
    planning_audit: Record<string, unknown>
  }> {
    if (!this.deps.directorPlanEnrichmentService) {
      return {
        episode_brief: input.episode_brief,
        local_intent: input.local_intent,
        planning_audit: input.planning_audit,
      }
    }

    return this.deps.directorPlanEnrichmentService.enrichRootScene({
      entry_kind: input.entry_kind,
      agent_id: input.agent_id,
      community: {
        id: input.target.community_id,
        slug: input.target.community_slug,
        name: input.target.community_name,
        description: input.target.community_description,
        rules: input.target.community_rules,
      },
      template: input.template,
      scene_metadata: input.scene_metadata,
      episode_brief: input.episode_brief,
      local_intent: input.local_intent,
      planning_audit: input.planning_audit,
    })
  }

  private async rankForumCandidates(
    catalog: ScenePoolCatalog,
    input: {
      entry_kind: Extract<SelectorEntryKind, 'scheduled_post' | 'forum_post_seed'>
      selector_mode: SelectorMode
      director_surface: Extract<SceneMetadata['director_surface'], 'forum' | 'scheduled_post'>
      eligible_targets: EligibleTarget[]
      locked_target?: {
        community_id: string
        community_slug: string
      }
    },
  ): Promise<{
    candidates: RankedCandidate[]
    hard_filter_reasons: Array<{ candidate_ref: string; reason: SelectorHardFilterReason }>
  }> {
    const entrySurface = input.entry_kind === 'scheduled_post' ? 'scheduled_post' : 'forum'
    const eligibleById = new Map(input.eligible_targets.map((item) => [item.community_id, item]))
    const eligibleBySlug = new Map(input.eligible_targets.map((item) => [item.community_slug, item]))
    const hardFilterReasons: Array<{ candidate_ref: string; reason: SelectorHardFilterReason }> = []

    const candidates = await Promise.all(
      catalog.scene_bindings
        .filter((binding) => binding.entry_surfaces.includes(entrySurface))
        .map(async (binding) => {
          if (binding.target.surface !== 'forum') return null
          const candidateRef = binding.binding_id
          const template = catalog.stage_templates.find((item) =>
            item.template_id === binding.template_id && item.template_version === binding.template_version)
          if (!template || !template.director.applicable_surfaces.includes(input.director_surface)) {
            hardFilterReasons.push({ candidate_ref: candidateRef, reason: 'surface_mismatch' })
            return null
          }
          if (!isTemplateLaunchable(template.lifecycle_status)) {
            hardFilterReasons.push({ candidate_ref: candidateRef, reason: 'template_blocked' })
            return null
          }
          if (!isBindingLive(binding, new Date())) {
            hardFilterReasons.push({ candidate_ref: candidateRef, reason: 'binding_inactive' })
            return null
          }
          if (binding.governance.risk_override === 'block') {
            hardFilterReasons.push({ candidate_ref: candidateRef, reason: 'risk_rejected' })
            return null
          }
          if (binding.governance.risk_override === 'strict_only' && input.selector_mode !== 'pool_strict') {
            hardFilterReasons.push({ candidate_ref: candidateRef, reason: 'risk_rejected' })
            return null
          }

          const target = binding.target.community_id
            ? eligibleById.get(binding.target.community_id)
            : eligibleBySlug.get(binding.target.community_slug)
          if (!target || !target.writable) {
            hardFilterReasons.push({ candidate_ref: candidateRef, reason: 'binding_target_mismatch' })
            return null
          }
          if (
            input.locked_target
            && (
              target.community_id !== input.locked_target.community_id
              || target.community_slug !== input.locked_target.community_slug
            )
          ) {
            hardFilterReasons.push({ candidate_ref: candidateRef, reason: 'binding_target_mismatch' })
            return null
          }

          const recentSince = new Date(Date.now() - 24 * 3600_000)
          const recentScenes = await this.deps.sceneMetadataRepo.listByCommunityIdSince(target.community_id, recentSince)
          const sameBindingRecent = recentScenes.filter((item) => item.scene_binding_id === binding.binding_id)
          const maxRunsPerDay = binding.constraints.max_runs_per_day ?? template.director.fatigue_policy.max_runs_per_day
          if (sameBindingRecent.length >= maxRunsPerDay) {
            hardFilterReasons.push({ candidate_ref: candidateRef, reason: 'daily_limit_reached' })
            return null
          }

          const cooldownHours = binding.constraints.cooldown_hours ?? template.director.fatigue_policy.cooldown_hours
          const cooldownCutoff = new Date(Date.now() - cooldownHours * 3600_000)
          const latestSameBinding = sameBindingRecent[0] ?? null
          if (latestSameBinding && latestSameBinding.created_at.getTime() >= cooldownCutoff.getTime()) {
            hardFilterReasons.push({ candidate_ref: candidateRef, reason: 'cooldown_active' })
            return null
          }

          return {
            binding,
            template,
            target,
            score_breakdown: this.scoreCandidate({
              binding,
              template,
              recentScenes,
              sameBindingRecent,
            }),
          } satisfies RankedCandidate
        }),
    )

    return {
      candidates: candidates
        .filter((item): item is RankedCandidate => item !== null)
        .sort((a, b) => b.score_breakdown.total_score - a.score_breakdown.total_score),
      hard_filter_reasons: hardFilterReasons,
    }
  }

  private scoreCandidate(input: {
    binding: SceneBindingV1
    template: StageTemplateV2
    recentScenes: ForumSceneMetadata[]
    sameBindingRecent: ForumSceneMetadata[]
  }): CandidateScoreBreakdown {
    const sameTemplateRecentCount = input.recentScenes.filter((item) =>
      item.scene_template_id === input.template.template_id
      && item.scene_template_version === input.template.template_version)
      .length
    const viewerFit = input.binding.weights.base_weight * 14
    const growthFit = Math.max(6, input.template.director.casting_recipe.relationship_objectives.length * 4)
    const castFit = input.template.director.casting_recipe.must_have_roles.length === 0 ? 10 : 7
    const continuityFit = input.sameBindingRecent.length === 0 ? 14 : 4
    const freshness = input.binding.weights.freshness_bonus * 8
    const novelty = sameTemplateRecentCount === 0 ? 12 : Math.max(0, 8 - sameTemplateRecentCount * 2)
    const editorialPriority = input.binding.weights.editorial_priority * 10
    const fatiguePenalty = input.sameBindingRecent.length > 0
      ? input.template.director.fatigue_policy.repeat_penalty * 16
      : 0
    const riskPenalty = input.binding.governance.risk_override === 'review_required' ? 6 : 0
    const repeatPenalty = sameTemplateRecentCount * input.template.director.fatigue_policy.repeat_penalty * 10
    return {
      viewer_fit: roundScore(viewerFit),
      growth_fit: roundScore(growthFit),
      cast_fit: roundScore(castFit),
      continuity_fit: roundScore(continuityFit),
      freshness: roundScore(freshness),
      novelty: roundScore(novelty),
      editorial_priority: roundScore(editorialPriority),
      fatigue_penalty: roundScore(fatiguePenalty),
      risk_penalty: roundScore(riskPenalty),
      repeat_penalty: roundScore(repeatPenalty),
      total_score: roundScore(
        viewerFit
        + growthFit
        + castFit
        + continuityFit
        + freshness
        + novelty
        + editorialPriority
        - fatiguePenalty
        - riskPenalty
        - repeatPenalty,
      ),
    }
  }

  private buildSkipResult(
    input: {
      request_id: string
      entry_kind: SelectorEntryKind
      selector_mode: SelectorMode
    },
    fallback: SelectorFallback,
    hardFilterReasons: Array<{ candidate_ref: string; reason: SelectorHardFilterReason }>,
  ): SelectorSkipResult {
    return {
      kind: 'skip',
      skip: fallback,
      audit: {
        selection_id: generateSceneId('scene_sel'),
        request_id: input.request_id,
        entry_kind: input.entry_kind,
        selector_mode: input.selector_mode,
        episode_strategy: 'selection_skipped',
        hard_filter_reasons: hardFilterReasons,
        fallback,
      },
    }
  }
}

function deriveToneHint(template: StageTemplateV2): LocalIntent['tone_hint'] {
  switch (template.category) {
    case 'show':
      return 'witty'
    case 'world':
      return 'warm'
    case 'creator':
      return 'serious'
    default:
      return 'neutral'
  }
}

function deriveRelationFocus(template: StageTemplateV2): LocalIntent['relation_focus'] {
  const objectives = template.director.casting_recipe.relationship_objectives.join(' ').toLowerCase()
  if (objectives.includes('bridge')) return 'bridge'
  if (objectives.includes('ally')) return 'ally'
  if (objectives.includes('challenge')) return 'challenge'
  return 'none'
}

function buildThreadFollowupTargetRef(input: {
  post_id: string
  thread_id?: string
  turn_id?: string
  post_author_agent_id?: string
  target_thread_author_agent_id?: string
  target_turn_author_agent_id?: string
}): LocalIntent['target_ref'] {
  if (input.turn_id && input.thread_id) {
    return {
      kind: 'turn',
      post_id: input.post_id,
      thread_id: input.thread_id,
      turn_id: input.turn_id,
      ...(input.target_turn_author_agent_id
        ? { agent_id: input.target_turn_author_agent_id }
        : {}),
    }
  }
  if (input.thread_id) {
    return {
      kind: 'thread',
      post_id: input.post_id,
      thread_id: input.thread_id,
      ...(input.target_thread_author_agent_id
        ? { agent_id: input.target_thread_author_agent_id }
        : {}),
    }
  }
  if (input.post_author_agent_id) {
    return {
      kind: 'agent',
      agent_id: input.post_author_agent_id,
    }
  }
  return { kind: 'none' }
}

function buildLaunchAwareLocalIntentBlock(input: {
  localIntent: LocalIntent
  episodeBrief: EpisodeBrief
  communitySlug: string | null
}): string {
  const baseBlock = buildLocalIntentBlock(input.localIntent, input.episodeBrief)
  const launchHints = buildLaunchProgrammingHints({
    communitySlug: input.communitySlug,
    episodeBrief: input.episodeBrief,
    phase: input.episodeBrief.phase,
  })

  const lines: string[] = []
  const primaryShelf = typeof launchHints.editorial_intent?.primary_shelf_id === 'string'
    ? launchHints.editorial_intent.primary_shelf_id
    : null
  if (primaryShelf) {
    lines.push(`- primary_shelf_id: ${primaryShelf}`)
  }
  const storylineHook = typeof launchHints.storyline?.hook === 'string'
    ? launchHints.storyline.hook
    : null
  if (storylineHook) {
    lines.push(`- storyline_hook: ${storylineHook}`)
  }
  const noteTemplateId = typeof launchHints.creator_note?.note_template_id === 'string'
    ? launchHints.creator_note.note_template_id
    : null
  if (noteTemplateId) {
    lines.push(`- note_template_id: ${noteTemplateId}`)
  }
  const coverMode = typeof launchHints.creator_note?.cover_mode === 'string'
    ? launchHints.creator_note.cover_mode
    : null
  if (coverMode) {
    lines.push(`- note_cover_mode: ${coverMode}`)
  }
  const sectionTitles = Array.isArray(launchHints.creator_note?.sections)
    ? launchHints.creator_note.sections.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  if (sectionTitles.length > 0) {
    lines.push(`- note_sections: ${sectionTitles.join(' / ')}`)
  }

  if (lines.length === 0) {
    return baseBlock
  }

  return `${baseBlock}\n## Launch Programming\n${lines.join('\n')}`
}

function buildLaunchProgrammingHints(input: {
  communitySlug: string | null
  episodeBrief: EpisodeBrief
  phase: SceneMetadata['phase']
}): NonNullable<PublicSceneWritePayload['launch_programming']> {
  const storyline = {
    id: input.episodeBrief.episode_id,
    phase: input.phase,
    title: input.episodeBrief.scene_goal.viewer_goal,
    hook: input.episodeBrief.open_loops[0] ?? input.episodeBrief.scene_goal.viewer_goal,
  }

  const creatorNoteProjection = resolveLaunchCreatorNoteProjection({
    community_slug: input.communitySlug ?? '',
    phase: input.phase,
    scene_goal: input.episodeBrief.scene_goal.viewer_goal,
    open_loops: input.episodeBrief.open_loops,
  })
  const template = creatorNoteProjection.note_template_id
    ? getLaunchCreatorNoteTemplateRuntime().template_registry.find((item) => item.id === creatorNoteProjection.note_template_id)
    : null

  return {
    storyline,
    creator_note: creatorNoteProjection.is_creator_note
      ? {
          is_creator_note: true,
          note_template_id: creatorNoteProjection.note_template_id ?? null,
          cover_mode: creatorNoteProjection.cover_mode ?? null,
          title_formula: template?.title_formula ?? null,
          sections: template?.sections ?? [],
        }
      : { is_creator_note: false },
    editorial_intent: {
      primary_shelf_id: resolvePrimaryShelf(input.communitySlug, input.phase, creatorNoteProjection.is_creator_note),
      content_kind: creatorNoteProjection.is_creator_note
        ? 'note_entry'
        : input.phase === 'closure' || input.phase === 'aftershow'
          ? 'continuity_callback'
          : 'story_episode',
    },
  }
}

function resolvePrimaryShelf(
  communitySlug: string | null,
  phase: SceneMetadata['phase'],
  isCreatorNote: boolean,
): string {
  if (isCreatorNote || communitySlug === 'creator-recommendation' || communitySlug === 'creator-relationship') {
    return 'notes_today'
  }
  if (phase === 'closure' || phase === 'aftershow') {
    return 'continue_storyline'
  }
  if (phase === 'escalation' || phase === 'pivot') {
    return 'conflict_rising'
  }
  return 'must_watch_today'
}

function isTemplateLaunchable(status: StageTemplateV2['lifecycle_status']): boolean {
  return status === 'canary'
    || status === 'seasonal_active'
    || status === 'core_active'
    || status === 'retiring'
}

function isBindingLive(binding: SceneBindingV1, now: Date): boolean {
  if (!(binding.status === 'active' || binding.status === 'canary' || binding.status === 'retiring')) {
    return false
  }
  if (binding.lifecycle.start_at && new Date(binding.lifecycle.start_at).getTime() > now.getTime()) {
    return false
  }
  if (binding.lifecycle.end_at && new Date(binding.lifecycle.end_at).getTime() < now.getTime()) {
    return false
  }
  const day = toWeekDay(now)
  if (!binding.activation.allowed_days.includes(day)) {
    return false
  }
  if (binding.activation.time_windows.length === 0) {
    return true
  }
  const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  return binding.activation.time_windows.some((window) => {
    const [start, end] = window.split('-')
    const startMinutes = toMinutes(start)
    const endMinutes = toMinutes(end)
    if (startMinutes === null || endMinutes === null) return false
    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes
    }
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes
  })
}

function toWeekDay(now: Date): SceneBindingV1['activation']['allowed_days'][number] {
  return (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[now.getUTCDay()]
}

function toMinutes(value: string | undefined): number | null {
  if (!value) return null
  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function resolveSelectionMode(requested: SelectorMode, template: StageTemplateV2): SceneMetadata['selection_mode'] {
  if (requested === 'pool_strict') return 'pool_strict'
  if (requested === 'autonomous_anchored') return 'autonomous_anchored'
  return template.director.autonomy_policy.require_pool_match_before_create
    ? 'pool_strict'
    : 'pool_guided'
}

function roundScore(value: number): number {
  return Number(value.toFixed(2))
}
