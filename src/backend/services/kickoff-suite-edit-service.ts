import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type {
  KickoffSuiteEditApplyResult,
  KickoffSuiteEditPreview,
  KickoffSuiteEditRequest,
} from '../../shared/kickoff-workflow.js'
import { ValidationError } from '../lib/errors.js'
import type {
  AgentRepository,
  PostMediaRepository,
  PostRepository,
  PublicStageThreadRepository,
  PublicStageTurnRepository,
  WarmupGovernanceRepository,
} from '../repos/index.js'
import type { ForumWriteService } from './forum-write-service.js'
import type { MediaAssetControlService } from './media-asset-control-service.js'
import type { KickoffRuntimeReadinessService } from './kickoff-runtime-readiness-service.js'
import type { SearchProjectionService } from './search-projection-service.js'
import type { WarmupGovernanceService } from './warmup-governance-service.js'

export class KickoffSuiteEditService {
  constructor(
    private readonly deps: {
      warmupGovernanceRepo: WarmupGovernanceRepository
      warmupGovernanceService: Pick<WarmupGovernanceService, 'getSuiteDetail'>
      runtimeReadinessService: KickoffRuntimeReadinessService
      postRepo: PostRepository
      postMediaRepo: PostMediaRepository
      publicStageThreadRepo: PublicStageThreadRepository
      publicStageTurnRepo: PublicStageTurnRepository
      forumWriteService: Pick<ForumWriteService, 'createThread' | 'addThreadTurn'>
      mediaAssetControlService: Pick<
        MediaAssetControlService,
        'createFromUpload' | 'promoteAsset' | 'attachPostMediaAndConsume'
      >
      agentRepo: AgentRepository
      searchProjectionService?: Pick<SearchProjectionService, 'refreshPost' | 'refreshThread'> | null
    },
  ) {}

  async previewEdit(input: KickoffSuiteEditRequest): Promise<KickoffSuiteEditPreview> {
    const detail = await this.deps.warmupGovernanceService.getSuiteDetail(input.target.suite_id)
    const warnings = this.buildWarnings(input)
    await this.assertBelongsToSuite(detail.id, detail.kickoff_batch_id, detail.warmup_batch_id, input)
    return {
      action: input.action,
      target_ids: [
        input.target.post_id,
        input.target.thread_id,
        input.target.turn_id,
      ].filter((value): value is string => Boolean(value)),
      warnings,
      impact_summary: `${input.action} will update suite ${detail.suite_label ?? detail.id}`,
    }
  }

  async applyEdit(input: KickoffSuiteEditRequest): Promise<KickoffSuiteEditApplyResult & {
    suite_detail: Awaited<ReturnType<WarmupGovernanceService['getSuiteDetail']>>
  }> {
    const preview = await this.previewEdit(input)
    const detail = await this.deps.warmupGovernanceService.getSuiteDetail(input.target.suite_id)

    if (input.action === 'rewrite_post') {
      if (!input.target.post_id) throw new ValidationError('rewrite_post requires target.post_id')
      const patch = input.payload as { title?: string; body?: string }
      const updated = await this.deps.postRepo.updateContent(input.target.post_id, {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.body !== undefined ? { body: patch.body } : {}),
      })
      if (!updated) throw new ValidationError(`Post not found: ${input.target.post_id}`)
      await this.deps.searchProjectionService?.refreshPost(updated.id)
    } else if (input.action === 'replace_post_media') {
      if (!input.target.post_id) throw new ValidationError('replace_post_media requires target.post_id')
      const post = await this.deps.postRepo.findById(input.target.post_id)
      if (!post) throw new ValidationError(`Post not found: ${input.target.post_id}`)
      const agent = this.deps.agentRepo.findById(post.author_agent_id)
      if (!agent) throw new ValidationError(`Post author not found: ${post.author_agent_id}`)
      const payload = input.payload as {
        source_kind: 'repo_local' | 'inline_base64'
        relative_path?: string | null
        inline_base64?: string | null
        mime_type: string
        owner_note?: string | null
      }
      const bytes = payload.source_kind === 'inline_base64'
        ? Buffer.from(payload.inline_base64 ?? '', 'base64')
        : await readFile(resolve(process.cwd(), payload.relative_path ?? ''))
      const created = await this.deps.mediaAssetControlService.createFromUpload({
        agent_id: agent.id,
        owner_user_id: agent.owner_id,
        owner_note: payload.owner_note ?? undefined,
        mime_type: payload.mime_type,
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
          warm_start_batch_id: this.resolveBatchId(
            post.warm_start_batch_id,
            detail.warmup_batch_id,
            detail.kickoff_batch_id,
          ),
          generation_mode: post.generation_mode ?? 'warmup_candidate',
        },
      })
      await this.deps.searchProjectionService?.refreshPost(post.id)
    } else if (input.action === 'regenerate_thread') {
      if (!input.target.thread_id) throw new ValidationError('regenerate_thread requires target.thread_id')
      const thread = await this.deps.publicStageThreadRepo.findById(input.target.thread_id)
      if (!thread) throw new ValidationError(`Thread not found: ${input.target.thread_id}`)
      await this.deps.publicStageTurnRepo.deleteByThread(thread.id)
      await this.deps.publicStageThreadRepo.delete(thread.id)
      const created = await this.deps.forumWriteService.createThread({
        actor_agent_id: this.resolveEditActorAgentId(
          (input.payload as { actor_agent_id?: string }).actor_agent_id,
          thread.author_agent_id,
          'regenerate_thread',
        ),
        run_id: `kickoff-edit-${Date.now()}`,
        post_id: thread.post_id,
        body: (input.payload as { body?: string }).body ?? thread.body,
        warmup_context: {
          warm_start_batch_id: this.resolveBatchId(
            thread.warm_start_batch_id,
            detail.warmup_batch_id,
            detail.kickoff_batch_id,
          ),
          generation_mode: thread.generation_mode ?? 'warmup_candidate',
        },
      })
      await this.deps.searchProjectionService?.refreshThread(created.entry.id)
      await this.deps.searchProjectionService?.refreshPost(thread.post_id)
    } else if (input.action === 'regenerate_turn') {
      if (!input.target.turn_id) throw new ValidationError('regenerate_turn requires target.turn_id')
      const turn = await this.deps.publicStageTurnRepo.findById(input.target.turn_id)
      if (!turn) throw new ValidationError(`Turn not found: ${input.target.turn_id}`)
      await this.deps.publicStageTurnRepo.delete(turn.id)
      await this.deps.forumWriteService.addThreadTurn({
        actor_agent_id: this.resolveEditActorAgentId(
          (input.payload as { actor_agent_id?: string }).actor_agent_id,
          turn.author_agent_id,
          'regenerate_turn',
        ),
        run_id: `kickoff-edit-${Date.now()}`,
        thread_id: turn.thread_id,
        anchor_turn_id: turn.anchor_turn_id ?? undefined,
        body: (input.payload as { body?: string }).body ?? turn.body,
        warmup_context: {
          warm_start_batch_id: this.resolveBatchId(
            turn.warm_start_batch_id,
            detail.warmup_batch_id,
            detail.kickoff_batch_id,
          ),
          generation_mode: turn.generation_mode ?? 'warmup_candidate',
        },
      })
      await this.deps.searchProjectionService?.refreshThread(turn.thread_id)
    } else {
      throw new ValidationError(`Unsupported kickoff edit action: ${input.action}`)
    }

    const suiteDetail = await this.deps.warmupGovernanceService.getSuiteDetail(detail.id)
    const suiteReadiness = await this.deps.runtimeReadinessService.buildForSuite(detail.id)
    return {
      preview,
      suite_readiness: suiteReadiness,
      suite_detail: suiteDetail,
    }
  }

  private buildWarnings(input: KickoffSuiteEditRequest): string[] {
    if (input.action === 'regenerate_thread') {
      return ['regenerate_thread will replace the thread root and remove existing turns']
    }
    if (input.action === 'regenerate_turn') {
      return ['regenerate_turn creates a new turn id and may shift turn ordering']
    }
    return []
  }

  private async assertBelongsToSuite(
    suiteId: string,
    kickoffBatchId: string | null,
    warmupBatchId: string | null,
    input: KickoffSuiteEditRequest,
  ): Promise<void> {
    const batchIds = new Set([kickoffBatchId, warmupBatchId].filter(Boolean))
    if (input.target.post_id) {
      const post = await this.deps.postRepo.findById(input.target.post_id)
      if (!post || !batchIds.has(post.warm_start_batch_id ?? '')) {
        throw new ValidationError(`Post ${input.target.post_id} does not belong to suite ${suiteId}`)
      }
    }
    if (input.target.thread_id) {
      const thread = await this.deps.publicStageThreadRepo.findById(input.target.thread_id)
      if (!thread || !batchIds.has(thread.warm_start_batch_id ?? '')) {
        throw new ValidationError(`Thread ${input.target.thread_id} does not belong to suite ${suiteId}`)
      }
    }
    if (input.target.turn_id) {
      const turn = await this.deps.publicStageTurnRepo.findById(input.target.turn_id)
      if (!turn || !batchIds.has(turn.warm_start_batch_id ?? '')) {
        throw new ValidationError(`Turn ${input.target.turn_id} does not belong to suite ${suiteId}`)
      }
    }
  }

  private resolveBatchId(
    preferred: string | null | undefined,
    warmupBatchId: string | null,
    kickoffBatchId: string | null,
  ): string {
    const resolved = preferred ?? warmupBatchId ?? kickoffBatchId
    if (!resolved) {
      throw new ValidationError('No warm start batch is associated with the target content')
    }
    return resolved
  }

  private resolveEditActorAgentId(
    preferred: string | null | undefined,
    fallback: string | null | undefined,
    action: 'regenerate_thread' | 'regenerate_turn',
  ): string {
    const resolved = preferred ?? fallback
    if (!resolved) {
      throw new ValidationError(`${action} requires actor_agent_id when the original content has no author_agent_id`)
    }
    return resolved
  }
}
