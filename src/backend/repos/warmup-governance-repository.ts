import type {
  CreateGovernanceBatchInput,
  CreateKickoffBaselineInput,
  UpdateGovernanceBatchInput,
  UpdateKickoffBaselineInput,
  GovernanceBatch,
  KickoffBaseline,
} from './types.js'

export interface WarmupGovernanceRepository {
  createBaseline(input: CreateKickoffBaselineInput): Promise<KickoffBaseline>
  findBaselineById(id: string): Promise<KickoffBaseline | null>
  listBaselines(): Promise<KickoffBaseline[]>
  updateBaseline(id: string, patch: UpdateKickoffBaselineInput): Promise<KickoffBaseline | null>
  createBatch(input: CreateGovernanceBatchInput): Promise<GovernanceBatch>
  findBatchById(id: string): Promise<GovernanceBatch | null>
  listBatchesByBaseline(baselineId: string): Promise<GovernanceBatch[]>
  updateBatch(id: string, patch: UpdateGovernanceBatchInput): Promise<GovernanceBatch | null>
  compareAndSwapBatchRevision(input: {
    id: string
    expected_revision_key: string | null
    next_revision_key: string
  }): Promise<GovernanceBatch | null>
}

let counter = 0

function cuid(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now()}_${counter}`
}

export class InMemoryWarmupGovernanceRepository implements WarmupGovernanceRepository {
  private readonly baselines = new Map<string, KickoffBaseline>()
  private readonly batches = new Map<string, GovernanceBatch>()

  async createBaseline(input: CreateKickoffBaselineInput): Promise<KickoffBaseline> {
    const now = new Date()
    const baseline: KickoffBaseline = {
      id: cuid('kickoff_baseline'),
      state: input.state ?? 'draft',
      baseline_label: input.baseline_label ?? null,
      kickoff_batch_id: input.kickoff_batch_id ?? null,
      warmup_batch_id: input.warmup_batch_id ?? null,
      created_by_user_id: input.created_by_user_id ?? null,
      activated_at: input.activated_at ?? null,
      archived_at: input.archived_at ?? null,
      created_at: now,
      updated_at: now,
    }
    this.baselines.set(baseline.id, baseline)
    return baseline
  }

  async findBaselineById(id: string): Promise<KickoffBaseline | null> {
    return this.baselines.get(id) ?? null
  }

  async listBaselines(): Promise<KickoffBaseline[]> {
    return [...this.baselines.values()].sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime(),
    )
  }

  async updateBaseline(id: string, patch: UpdateKickoffBaselineInput): Promise<KickoffBaseline | null> {
    const current = this.baselines.get(id)
    if (!current) return null
    const next: KickoffBaseline = {
      ...current,
      ...patch,
      updated_at: new Date(),
    }
    this.baselines.set(id, next)
    return next
  }

  async createBatch(input: CreateGovernanceBatchInput): Promise<GovernanceBatch> {
    const now = new Date()
    const batch: GovernanceBatch = {
      id: cuid('governance_batch'),
      baseline_id: input.baseline_id,
      batch_kind: input.batch_kind,
      state: input.state ?? 'draft',
      source_batch_id: input.source_batch_id ?? null,
      revision_key: input.revision_key ?? null,
      package_hash: input.package_hash ?? null,
      notes: input.notes ?? null,
      activated_at: input.activated_at ?? null,
      archived_at: input.archived_at ?? null,
      created_at: now,
      updated_at: now,
    }
    this.batches.set(batch.id, batch)
    return batch
  }

  async findBatchById(id: string): Promise<GovernanceBatch | null> {
    return this.batches.get(id) ?? null
  }

  async listBatchesByBaseline(baselineId: string): Promise<GovernanceBatch[]> {
    return [...this.batches.values()]
      .filter((batch) => batch.baseline_id === baselineId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }

  async updateBatch(id: string, patch: UpdateGovernanceBatchInput): Promise<GovernanceBatch | null> {
    const current = this.batches.get(id)
    if (!current) return null
    const next: GovernanceBatch = {
      ...current,
      ...patch,
      updated_at: new Date(),
    }
    this.batches.set(id, next)
    return next
  }

  async compareAndSwapBatchRevision(input: {
    id: string
    expected_revision_key: string | null
    next_revision_key: string
  }): Promise<GovernanceBatch | null> {
    const current = this.batches.get(input.id)
    if (!current || current.revision_key !== input.expected_revision_key) {
      return null
    }
    const next: GovernanceBatch = {
      ...current,
      revision_key: input.next_revision_key,
      updated_at: new Date(),
    }
    this.batches.set(input.id, next)
    return next
  }
}
