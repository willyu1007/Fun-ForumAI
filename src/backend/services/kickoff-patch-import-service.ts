import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type {
  KickoffActorSelector,
  KickoffAuthoringOperation,
  KickoffAuthoringPatch,
  KickoffBootstrapMode,
  KickoffImportReport,
  KickoffProfileId,
  KickoffResolvedRef,
} from '../../shared/kickoff-workflow.js'
import { ValidationError } from '../lib/errors.js'
import {
  readKickoffPatchPackRegistry,
  readKickoffQualityProfile,
  readKickoffWorkflowManifest,
  readKickoffWorkflowProfile,
  resolveKickoffPatchPackPath,
} from '../launch/kickoff-workflow.js'
import { getLaunchSystemRoster } from '../launch/system-roster.js'
import type {
  AgentRepository,
  CommunityRepository,
  PostMediaRepository,
  PostRepository,
  PublicStageThreadRepository,
  PublicStageTurnRepository,
  WarmupGovernanceRepository,
} from '../repos/index.js'
import type { ForumWriteService } from './forum-write-service.js'
import type { MediaAssetControlService } from './media-asset-control-service.js'
import type { KickoffRunArtifactService } from './kickoff-run-artifact-service.js'
import type { KickoffRuntimeReadinessService } from './kickoff-runtime-readiness-service.js'
import type { SearchProjectionService } from './search-projection-service.js'
import type { WarmupGovernanceService } from './warmup-governance-service.js'

interface ResolvedTargetSuite {
  suite_id: string
  suite_label: string | null
  mode: KickoffBootstrapMode
  kickoff_batch_id: string | null
  warmup_batch_id: string | null
}

interface ResolvedOperationContext {
  suite: ResolvedTargetSuite
  resolutionMap: Map<string, KickoffResolvedRef>
  affectedPostIds: Set<string>
  affectedThreadIds: Set<string>
}

export class KickoffPatchImportService {
  constructor(
    private readonly deps: {
      warmupGovernanceService: Pick<WarmupGovernanceService, 'listSuites' | 'getSuiteDetail' | 'getRuntimeBaselineAdmission'>
      warmupGovernanceRepo: WarmupGovernanceRepository
      communityRepo: CommunityRepository
      agentRepo: AgentRepository
      postRepo: PostRepository
      publicStageThreadRepo: PublicStageThreadRepository
      publicStageTurnRepo: PublicStageTurnRepository
      postMediaRepo: PostMediaRepository
      forumWriteService: Pick<ForumWriteService, 'createPost' | 'createThread' | 'addThreadTurn' | 'upsertVote'>
      mediaAssetControlService: Pick<
        MediaAssetControlService,
        'createFromUpload' | 'promoteAsset' | 'attachPostMediaAndConsume'
      >
      searchProjectionService?: Pick<SearchProjectionService, 'refreshPost' | 'refreshThread'> | null
      runtimeReadinessService: KickoffRuntimeReadinessService
      runArtifactService: KickoffRunArtifactService
    },
  ) {}

  async importPatch(input: {
    dry_run: boolean
    patch: KickoffAuthoringPatch
    patch_pack_id?: string | null
    profile_id: KickoffProfileId
  }): Promise<KickoffImportReport> {
    readKickoffWorkflowManifest()
    readKickoffQualityProfile()
    readKickoffPatchPackRegistry()
    const profile = readKickoffWorkflowProfile(input.profile_id)
    if (input.patch.patch_meta.patch_kind !== input.profile_id) {
      throw new ValidationError(
        `Patch kind "${input.patch.patch_meta.patch_kind}" does not match requested profile "${input.profile_id}"`,
      )
    }
    if (profile.mode !== input.patch.target.mode) {
      throw new ValidationError(
        `Patch target mode "${input.patch.target.mode}" does not match profile "${input.profile_id}" mode "${profile.mode}"`,
      )
    }

    if (input.patch_pack_id) {
      const packPath = resolveKickoffPatchPackPath(input.patch_pack_id)
      if (!packPath) {
        throw new ValidationError(`Unknown kickoff patch pack: ${input.patch_pack_id}`)
      }
      await readFile(packPath, 'utf8')
    }

    const run = await this.deps.runArtifactService.createRun({
      run_type: 'import',
      mode: input.patch.target.mode,
      profile_id: input.profile_id,
      patch_id: input.patch.patch_meta.patch_id,
      suite_label: input.patch.target.suite_label,
    })

    const preflightResults: KickoffImportReport['preflight_results'] = []
    const ctx: ResolvedOperationContext = {
      suite: await this.resolveTargetSuite(input.patch.target.mode, input.patch.target.suite_label),
      resolutionMap: new Map(),
      affectedPostIds: new Set(),
      affectedThreadIds: new Set(),
    }

    await this.deps.runArtifactService.writeContextPack(run.run_id, {
      profile,
      target: input.patch.target,
      suite: ctx.suite,
      operation_count: input.patch.operations.length,
    })
    await this.deps.runArtifactService.writePatch(run.run_id, input.patch)
    await this.deps.runArtifactService.writeRepairPatch(run.run_id, input.patch)

    preflightResults.push(
      { check: 'kickoff_manifest_loaded', ok: true, detail: 'workflow manifest loaded' },
      { check: 'kickoff_profile_loaded', ok: true, detail: `profile ${input.profile_id} loaded` },
      { check: 'target_suite_resolved', ok: true, detail: `suite ${ctx.suite.suite_id}` },
      {
        check: 'target_batches_resolved',
        ok: Boolean(ctx.suite.kickoff_batch_id && ctx.suite.warmup_batch_id),
        detail: `kickoff=${ctx.suite.kickoff_batch_id ?? 'missing'} warmup=${ctx.suite.warmup_batch_id ?? 'missing'}`,
      },
    )

    let failurePhase: string | null = null
    try {
      const opResults: KickoffImportReport['op_results'] = []
      for (const operation of input.patch.operations) {
        failurePhase = `op:${operation.op_id}`
        this.assertDependencies(operation, ctx)
        const result = input.dry_run
          ? await this.previewOperation(operation, ctx, input.profile_id)
          : await this.applyOperation(operation, ctx, run.run_id, input.profile_id)
        opResults.push(result)
      }

      if (!input.dry_run) {
        await this.refreshSearchDocs(ctx)
      }

      const readiness = await this.deps.runtimeReadinessService.buildForSuite(ctx.suite.suite_id)
      const report: KickoffImportReport = {
        contract_version: 1,
        report_meta: {
          run_id: run.run_id,
          patch_id: input.patch.patch_meta.patch_id,
          dry_run: input.dry_run,
          imported_at: new Date().toISOString(),
          profile_id: input.profile_id,
        },
        resolved_context: {
          mode: input.patch.target.mode,
          suite_id: ctx.suite.suite_id,
          suite_label: ctx.suite.suite_label,
          kickoff_batch_id: ctx.suite.kickoff_batch_id,
          warmup_batch_id: ctx.suite.warmup_batch_id,
        },
        preflight_results: preflightResults,
        resolution_map: [...ctx.resolutionMap.values()],
        op_results: opResults,
        summary_after_import: readiness.quality_state.summary,
        readiness_snapshot: readiness,
        observability: {
          affected_post_ids: [...ctx.affectedPostIds],
          affected_thread_ids: [...ctx.affectedThreadIds],
          artifact_dir: run.artifact_dir,
        },
        recommended_next_actions: this.buildRecommendedNextActions(readiness),
        failure_phase: null,
      }

      await this.deps.runArtifactService.writeImportReport(run.run_id, report)
      await this.deps.runArtifactService.writeReadiness(run.run_id, readiness)
      await this.deps.runArtifactService.writeDiffSummary(
        run.run_id,
        [
          '# Kickoff Import',
          `- dry_run: ${String(input.dry_run)}`,
          `- patch_id: ${input.patch.patch_meta.patch_id}`,
          `- suite: ${ctx.suite.suite_id}`,
          `- operations: ${input.patch.operations.length}`,
          `- allow_public_growth: ${String(readiness.admission.allow_public_growth)}`,
        ].join('\n'),
      )
      await this.deps.runArtifactService.completeRun(run.run_id, {
        suite_id: ctx.suite.suite_id,
        suite_label: ctx.suite.suite_label,
        kickoff_batch_id: ctx.suite.kickoff_batch_id,
        warmup_batch_id: ctx.suite.warmup_batch_id,
        baseline_id: readiness.active_baseline_id,
      })
      await this.deps.runArtifactService.recordDataMode({
        mode: readiness.admission.has_active_baseline ? 'kickoff-active' : 'kickoff-candidate',
        profile: input.profile_id,
        suite_id: ctx.suite.suite_id,
        suite_label: ctx.suite.suite_label,
        baseline_id: readiness.active_baseline_id,
      })

      return report
    } catch (error) {
      await this.deps.runArtifactService.writeFailureLog(run.run_id, {
        failed_phase: failurePhase,
        patch_id: input.patch.patch_meta.patch_id,
        message: error instanceof Error ? error.message : String(error),
      })
      await this.deps.runArtifactService.completeRun(run.run_id, {
        suite_id: ctx.suite.suite_id,
        suite_label: ctx.suite.suite_label,
        kickoff_batch_id: ctx.suite.kickoff_batch_id,
        warmup_batch_id: ctx.suite.warmup_batch_id,
        failed_phase: failurePhase,
      })
      throw error
    }
  }

  private async resolveTargetSuite(
    mode: KickoffBootstrapMode,
    suiteLabel: string,
  ): Promise<ResolvedTargetSuite> {
    const suites = await this.deps.warmupGovernanceService.listSuites()
    const matched = suites.find((item) => item.suite_label === suiteLabel)
      ?? (mode === 'active'
        ? suites.find((item) => item.state === 'active')
        : suites.find((item) => item.state === 'review_ready'))
      ?? null
    if (!matched) {
      throw new ValidationError(`No warmup suite available for mode=${mode} label=${suiteLabel}`)
    }
    const detail = await this.deps.warmupGovernanceService.getSuiteDetail(matched.id)
    return {
      suite_id: detail.id,
      suite_label: detail.suite_label,
      mode,
      kickoff_batch_id: detail.kickoff_batch_id,
      warmup_batch_id: detail.warmup_batch_id,
    }
  }

  private assertDependencies(operation: KickoffAuthoringOperation, ctx: ResolvedOperationContext): void {
    for (const dep of operation.depends_on ?? []) {
      if (!ctx.resolutionMap.has(dep)) {
        throw new ValidationError(`Operation ${operation.op_id} depends on unresolved logical key "${dep}"`)
      }
    }
  }

  private async previewOperation(
    operation: KickoffAuthoringOperation,
    ctx: ResolvedOperationContext,
    profileId: KickoffProfileId,
  ): Promise<KickoffImportReport['op_results'][number]> {
    await this.validateOperation(operation, ctx, profileId)
    const syntheticId = `dry-run:${operation.entity_kind}:${operation.logical_key}`
    ctx.resolutionMap.set(operation.logical_key, {
      logical_key: operation.logical_key,
      entity_kind: operation.entity_kind,
      id: syntheticId,
    })
    if (operation.entity_kind === 'post' || operation.entity_kind === 'runtime_instruction') {
      ctx.affectedPostIds.add(syntheticId)
    }
    if (operation.entity_kind === 'thread' || operation.entity_kind === 'turn') {
      ctx.affectedThreadIds.add(syntheticId)
    }
    return {
      op_id: operation.op_id,
      logical_key: operation.logical_key,
      entity_kind: operation.entity_kind,
      action: operation.action,
      status: 'skipped',
      detail: 'dry-run preview completed',
      created_id: syntheticId,
    }
  }

  private async applyOperation(
    operation: KickoffAuthoringOperation,
    ctx: ResolvedOperationContext,
    runId: string,
    profileId: KickoffProfileId,
  ): Promise<KickoffImportReport['op_results'][number]> {
    await this.validateOperation(operation, ctx, profileId)

    if (operation.entity_kind === 'post') {
      const agent = this.resolveAgent(operation.actor_selector)
      const community = this.resolveCommunity(operation.community_selector.slug)
      const batchId = this.resolveBatchId(operation.target_batch_kind ?? 'kickoff', ctx.suite)
      const created = await this.deps.forumWriteService.createPost({
        actor_agent_id: agent.id,
        run_id: runId,
        community_id: community.id,
        title: operation.payload.title,
        body: operation.payload.body,
        tags: operation.payload.tags ?? [],
        warmup_context: {
          warm_start_batch_id: batchId,
          generation_mode: operation.generation_mode ?? 'warmup_candidate',
        },
      })
      ctx.resolutionMap.set(operation.logical_key, {
        logical_key: operation.logical_key,
        entity_kind: 'post',
        id: created.post.id,
      })
      ctx.affectedPostIds.add(created.post.id)
      return this.successResult(operation, created.post.id, `post ${created.post.id} created`)
    }

    if (operation.entity_kind === 'thread') {
      const agent = this.resolveAgent(operation.actor_selector)
      const postRef = this.requireResolvedRef(ctx, operation.payload.post_ref_key, 'post')
      const post = await this.deps.postRepo.findById(postRef.id)
      if (!post) throw new ValidationError(`Resolved post not found: ${postRef.id}`)
      const batchId = this.resolveBatchId(operation.target_batch_kind ?? 'warmup', ctx.suite)
      const created = await this.deps.forumWriteService.createThread({
        actor_agent_id: agent.id,
        run_id: runId,
        post_id: post.id,
        body: operation.payload.body,
        channel: operation.payload.channel,
        warmup_context: {
          warm_start_batch_id: batchId,
          generation_mode: operation.generation_mode ?? 'warmup_candidate',
        },
      })
      ctx.resolutionMap.set(operation.logical_key, {
        logical_key: operation.logical_key,
        entity_kind: 'thread',
        id: created.entry.id,
      })
      ctx.affectedPostIds.add(post.id)
      ctx.affectedThreadIds.add(created.entry.id)
      return this.successResult(operation, created.entry.id, `thread ${created.entry.id} created`)
    }

    if (operation.entity_kind === 'turn') {
      const agent = this.resolveAgent(operation.actor_selector)
      const threadRef = this.requireResolvedRef(ctx, operation.payload.thread_ref_key, 'thread')
      const batchId = this.resolveBatchId(operation.target_batch_kind ?? 'warmup', ctx.suite)
      const created = await this.deps.forumWriteService.addThreadTurn({
        actor_agent_id: agent.id,
        run_id: runId,
        thread_id: threadRef.id,
        anchor_turn_id: operation.payload.anchor_turn_key ?? undefined,
        body: operation.payload.body,
        channel: operation.payload.channel,
        warmup_context: {
          warm_start_batch_id: batchId,
          generation_mode: operation.generation_mode ?? 'warmup_candidate',
        },
      })
      ctx.resolutionMap.set(operation.logical_key, {
        logical_key: operation.logical_key,
        entity_kind: 'turn',
        id: created.entry.id,
      })
      ctx.affectedThreadIds.add(threadRef.id)
      return this.successResult(operation, created.entry.id, `turn ${created.entry.id} created`)
    }

    if (operation.entity_kind === 'vote') {
      const agent = this.resolveAgent(operation.actor_selector)
      const targetRef = this.requireResolvedRef(ctx, operation.payload.target_ref_key)
      const targetType = targetRef.entity_kind === 'post'
        ? 'POST'
        : targetRef.entity_kind === 'thread'
          ? 'THREAD'
          : 'TURN'
      const created = await this.deps.forumWriteService.upsertVote({
        actor_agent_id: agent.id,
        run_id: runId,
        target_type: targetType,
        target_id: targetRef.id,
        direction: operation.payload.direction,
      })
      ctx.resolutionMap.set(operation.logical_key, {
        logical_key: operation.logical_key,
        entity_kind: 'vote',
        id: created.vote.id,
      })
      return this.successResult(operation, created.vote.id, `vote ${created.vote.id} upserted`)
    }

    if (operation.entity_kind === 'media') {
      const postRef = this.requireResolvedRef(ctx, operation.payload.post_ref_key, 'post')
      const post = await this.deps.postRepo.findById(postRef.id)
      if (!post) throw new ValidationError(`Resolved post not found: ${postRef.id}`)
      const agent = this.resolveAgent(operation.actor_selector)
      const bytes = await this.resolveMediaBytes(operation)
      const created = await this.deps.mediaAssetControlService.createFromUpload({
        agent_id: agent.id,
        owner_user_id: agent.owner_id,
        owner_note: operation.payload.owner_note ?? undefined,
        original_name: operation.payload.relative_path ?? undefined,
        mime_type: operation.payload.mime_type,
        bytes,
      })
      const promoted = await this.deps.mediaAssetControlService.promoteAsset({
        agent_id: agent.id,
        owner_user_id: agent.owner_id,
        asset_id: created.asset_id,
      })
      this.deps.postMediaRepo.deleteByPostIds([post.id])
      await this.deps.mediaAssetControlService.attachPostMediaAndConsume({
        asset_id: promoted.asset_id,
        post_id: post.id,
        warmup_context: {
          warm_start_batch_id: post.warm_start_batch_id ?? this.resolveBatchId('warmup', ctx.suite),
          generation_mode: post.generation_mode ?? 'warmup_candidate',
        },
      })
      ctx.resolutionMap.set(operation.logical_key, {
        logical_key: operation.logical_key,
        entity_kind: 'media',
        id: promoted.asset_id,
      })
      ctx.affectedPostIds.add(post.id)
      return this.successResult(operation, promoted.asset_id, `media ${promoted.asset_id} attached`)
    }

    if (operation.entity_kind === 'runtime_instruction') {
      if (!readKickoffWorkflowProfile(profileId).import_defaults.allow_runtime_instruction_payload) {
        throw new ValidationError(`Profile ${profileId} does not allow runtime instruction payloads`)
      }
      const agent = this.resolveAgent(operation.payload.actor_selector)
      const community = this.resolveCommunity(operation.payload.community_selector.slug)
      const batchId = this.resolveBatchId(operation.target_batch_kind ?? 'warmup', ctx.suite)
      const created = await this.deps.forumWriteService.createPost({
        actor_agent_id: agent.id,
        run_id: runId,
        community_id: community.id,
        title: operation.payload.title,
        body: [
          operation.payload.body,
          '',
          `#director_goal ${operation.payload.director_goal}`,
          operation.payload.scene_hint ? `#scene_hint ${operation.payload.scene_hint}` : '',
          operation.payload.placement_goal ? `#placement_goal ${operation.payload.placement_goal}` : '',
          operation.payload.topup_reason ? `#topup_reason ${operation.payload.topup_reason}` : '',
        ].filter(Boolean).join('\n'),
        tags: operation.payload.tags ?? [],
        warmup_context: {
          warm_start_batch_id: batchId,
          generation_mode: operation.generation_mode ?? 'warmup_topup_candidate',
        },
      })
      ctx.resolutionMap.set(operation.logical_key, {
        logical_key: operation.logical_key,
        entity_kind: 'runtime_instruction',
        id: created.post.id,
      })
      ctx.affectedPostIds.add(created.post.id)
      return this.successResult(operation, created.post.id, `runtime-simulated post ${created.post.id} created`)
    }

    throw new ValidationError('Unsupported kickoff operation entity')
  }

  private async validateOperation(
    operation: KickoffAuthoringOperation,
    ctx: ResolvedOperationContext,
    profileId: KickoffProfileId,
  ): Promise<void> {
    if (operation.entity_kind === 'post') {
      this.resolveAgent(operation.actor_selector)
      this.resolveCommunity(operation.community_selector.slug)
      this.resolveBatchId(operation.target_batch_kind ?? 'kickoff', ctx.suite)
      return
    }
    if (operation.entity_kind === 'thread') {
      this.resolveAgent(operation.actor_selector)
      this.requireResolvedRef(ctx, operation.payload.post_ref_key, 'post')
      return
    }
    if (operation.entity_kind === 'turn') {
      this.resolveAgent(operation.actor_selector)
      this.requireResolvedRef(ctx, operation.payload.thread_ref_key, 'thread')
      if (operation.payload.anchor_turn_key) {
        this.requireResolvedRef(ctx, operation.payload.anchor_turn_key, 'turn')
      }
      return
    }
    if (operation.entity_kind === 'vote') {
      this.resolveAgent(operation.actor_selector)
      this.requireResolvedRef(ctx, operation.payload.target_ref_key)
      return
    }
    if (operation.entity_kind === 'media') {
      this.resolveAgent(operation.actor_selector)
      this.requireResolvedRef(ctx, operation.payload.post_ref_key, 'post')
      if (!['repo_local', 'inline_base64'].includes(operation.payload.source_kind)) {
        throw new ValidationError(`Unsupported media source kind: ${operation.payload.source_kind}`)
      }
      return
    }
    if (operation.entity_kind === 'runtime_instruction') {
      if (!readKickoffWorkflowProfile(profileId).import_defaults.allow_runtime_instruction_payload) {
        throw new ValidationError(`Profile ${profileId} does not allow runtime instruction payloads`)
      }
      this.resolveAgent(operation.payload.actor_selector)
      this.resolveCommunity(operation.payload.community_selector.slug)
      return
    }
  }

  private resolveAgent(selector: KickoffActorSelector) {
    if (selector.agent_id) {
      const direct = this.deps.agentRepo.findById(selector.agent_id)
      if (!direct) throw new ValidationError(`Unknown agent_id: ${selector.agent_id}`)
      return direct
    }
    if (selector.roster_entry_id) {
      const roster = getLaunchSystemRoster()
      const entry = roster.roster.find((item) => item.id === selector.roster_entry_id)
      if (!entry) throw new ValidationError(`Unknown roster_entry_id: ${selector.roster_entry_id}`)
      const agent = this.deps.agentRepo
        .findByOwner(roster.owner_model.owner_id)
        .find((item) => item.display_name === entry.display_name)
      if (!agent) throw new ValidationError(`Missing launch roster agent for ${selector.roster_entry_id}`)
      return agent
    }
    if (selector.display_name) {
      const agent = this.deps.agentRepo.findByDisplayName(selector.display_name)
      if (!agent) throw new ValidationError(`Unknown display_name: ${selector.display_name}`)
      return agent
    }
    throw new ValidationError('actor_selector must provide agent_id, roster_entry_id, or display_name')
  }

  private resolveCommunity(slug: string) {
    const community = this.deps.communityRepo.findBySlug(slug)
    if (!community) {
      throw new ValidationError(`Unknown community slug: ${slug}`)
    }
    return community
  }

  private resolveBatchId(kind: 'kickoff' | 'warmup', suite: ResolvedTargetSuite): string {
    const batchId = kind === 'kickoff' ? suite.kickoff_batch_id : suite.warmup_batch_id
    if (!batchId) {
      throw new ValidationError(`Suite ${suite.suite_id} is missing its ${kind} batch`)
    }
    return batchId
  }

  private requireResolvedRef(
    ctx: ResolvedOperationContext,
    logicalKey: string,
    kind?: 'post' | 'thread' | 'turn',
  ): KickoffResolvedRef {
    const resolved = ctx.resolutionMap.get(logicalKey) ?? null
    if (!resolved) {
      throw new ValidationError(`Unknown logical reference: ${logicalKey}`)
    }
    if (kind && resolved.entity_kind !== kind) {
      throw new ValidationError(`Logical reference ${logicalKey} is ${resolved.entity_kind}, expected ${kind}`)
    }
    return resolved
  }

  private async resolveMediaBytes(
    operation: Extract<KickoffAuthoringOperation, { entity_kind: 'media' }>,
  ): Promise<Buffer> {
    if (operation.payload.source_kind === 'inline_base64') {
      if (!operation.payload.inline_base64) {
        throw new ValidationError('inline_base64 media payload is missing inline_base64')
      }
      return Buffer.from(operation.payload.inline_base64, 'base64')
    }

    if (!operation.payload.relative_path) {
      throw new ValidationError('repo_local media payload is missing relative_path')
    }
    const absolute = resolve(process.cwd(), operation.payload.relative_path)
    return readFile(absolute)
  }

  private successResult(
    operation: KickoffAuthoringOperation,
    createdId: string,
    detail: string,
  ): KickoffImportReport['op_results'][number] {
    return {
      op_id: operation.op_id,
      logical_key: operation.logical_key,
      entity_kind: operation.entity_kind,
      action: operation.action,
      status: 'success',
      detail,
      created_id: createdId,
    }
  }

  private buildRecommendedNextActions(readiness: KickoffImportReport['readiness_snapshot']): string[] {
    if (readiness.activation_readiness.ok && !readiness.admission.has_active_baseline) {
      return ['review_candidate_suite', 'activate_baseline_if_approved']
    }
    if (readiness.activation_readiness.ok && readiness.admission.has_active_baseline) {
      return ['verify_runtime_readiness', 'inspect_frontend_surfaces']
    }
    return readiness.activation_readiness.reasons.map((reason) => `repair:${reason}`)
  }

  private async refreshSearchDocs(ctx: ResolvedOperationContext): Promise<void> {
    if (!this.deps.searchProjectionService) return
    await Promise.all([
      ...[...ctx.affectedPostIds].map((postId) => this.deps.searchProjectionService!.refreshPost(postId)),
      ...[...ctx.affectedThreadIds].map((threadId) => this.deps.searchProjectionService!.refreshThread(threadId)),
    ])
  }
}
