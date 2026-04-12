import type {
  ActiveBaseline,
  CreateActiveBaselineInput,
  CreateGovernanceBatchInput,
  CreateWarmStartBatchInput,
  CreateWarmupSuiteInput,
  CreateWarmupSuiteReviewInput,
  GovernanceBatch,
  UpdateActiveBaselineInput,
  UpdateGovernanceBatchInput,
  UpdateWarmStartBatchInput,
  UpdateWarmupSuiteInput,
  WarmStartBatch,
  WarmupSuite,
  WarmupSuiteReview,
} from './types.js'

export interface WarmupGovernanceRepository {
  createSuite(input: CreateWarmupSuiteInput): Promise<WarmupSuite>
  findSuiteById(id: string): Promise<WarmupSuite | null>
  listSuites(): Promise<WarmupSuite[]>
  updateSuite(id: string, patch: UpdateWarmupSuiteInput): Promise<WarmupSuite | null>
  createBatch(input: CreateWarmStartBatchInput): Promise<WarmStartBatch>
  findBatchById(id: string): Promise<WarmStartBatch | null>
  listBatchesBySuite(suiteId: string): Promise<WarmStartBatch[]>
  updateBatch(id: string, patch: UpdateWarmStartBatchInput): Promise<WarmStartBatch | null>
  createReview(input: CreateWarmupSuiteReviewInput): Promise<WarmupSuiteReview>
  listReviewsBySuite(suiteId: string): Promise<WarmupSuiteReview[]>
  findLatestReviewBySuite(suiteId: string): Promise<WarmupSuiteReview | null>
  createBaseline(input: CreateActiveBaselineInput): Promise<ActiveBaseline>
  listBaselines(): Promise<ActiveBaseline[]>
  findBaselineById(id: string): Promise<ActiveBaseline | null>
  findCurrentBaseline(): Promise<ActiveBaseline | null>
  updateBaseline(id: string, patch: UpdateActiveBaselineInput): Promise<ActiveBaseline | null>
  createGovernanceBatch(input: CreateGovernanceBatchInput): Promise<GovernanceBatch>
  findGovernanceBatchById(id: string): Promise<GovernanceBatch | null>
  updateGovernanceBatch(id: string, patch: UpdateGovernanceBatchInput): Promise<GovernanceBatch | null>
}

let counter = 0

function cuid(prefix: string): string {
  counter += 1
  return `${prefix}_${Date.now()}_${counter}`
}

export class InMemoryWarmupGovernanceRepository implements WarmupGovernanceRepository {
  private readonly suites = new Map<string, WarmupSuite>()
  private readonly batches = new Map<string, WarmStartBatch>()
  private readonly reviews = new Map<string, WarmupSuiteReview>()
  private readonly baselines = new Map<string, ActiveBaseline>()
  private readonly governanceBatches = new Map<string, GovernanceBatch>()

  async createSuite(input: CreateWarmupSuiteInput): Promise<WarmupSuite> {
    const now = new Date()
    const suite: WarmupSuite = {
      id: cuid('warmup_suite'),
      state: input.state ?? 'draft',
      suite_label: input.suite_label ?? null,
      kickoff_batch_id: input.kickoff_batch_id ?? null,
      warmup_batch_id: input.warmup_batch_id ?? null,
      created_by_user_id: input.created_by_user_id ?? null,
      activated_at: input.activated_at ?? null,
      archived_at: input.archived_at ?? null,
      created_at: now,
      updated_at: now,
    }
    this.suites.set(suite.id, suite)
    return suite
  }

  async findSuiteById(id: string): Promise<WarmupSuite | null> {
    return this.suites.get(id) ?? null
  }

  async listSuites(): Promise<WarmupSuite[]> {
    return [...this.suites.values()].sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async updateSuite(id: string, patch: UpdateWarmupSuiteInput): Promise<WarmupSuite | null> {
    const current = this.suites.get(id)
    if (!current) return null
    const next: WarmupSuite = {
      ...current,
      ...patch,
      updated_at: new Date(),
    }
    this.suites.set(id, next)
    return next
  }

  async createBatch(input: CreateWarmStartBatchInput): Promise<WarmStartBatch> {
    const now = new Date()
    const batch: WarmStartBatch = {
      id: cuid('warm_start_batch'),
      suite_id: input.suite_id,
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

  async findBatchById(id: string): Promise<WarmStartBatch | null> {
    return this.batches.get(id) ?? null
  }

  async listBatchesBySuite(suiteId: string): Promise<WarmStartBatch[]> {
    return [...this.batches.values()]
      .filter((batch) => batch.suite_id === suiteId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
  }

  async updateBatch(id: string, patch: UpdateWarmStartBatchInput): Promise<WarmStartBatch | null> {
    const current = this.batches.get(id)
    if (!current) return null
    const next: WarmStartBatch = {
      ...current,
      ...patch,
      updated_at: new Date(),
    }
    this.batches.set(id, next)
    return next
  }

  async createReview(input: CreateWarmupSuiteReviewInput): Promise<WarmupSuiteReview> {
    const review: WarmupSuiteReview = {
      id: cuid('warmup_suite_review'),
      suite_id: input.suite_id,
      reviewer_user_id: input.reviewer_user_id ?? null,
      decision: input.decision,
      reason_codes: input.reason_codes ?? [],
      note: input.note ?? null,
      created_at: new Date(),
    }
    this.reviews.set(review.id, review)
    return review
  }

  async listReviewsBySuite(suiteId: string): Promise<WarmupSuiteReview[]> {
    return [...this.reviews.values()]
      .filter((review) => review.suite_id === suiteId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
  }

  async findLatestReviewBySuite(suiteId: string): Promise<WarmupSuiteReview | null> {
    const reviews = await this.listReviewsBySuite(suiteId)
    return reviews[0] ?? null
  }

  async createBaseline(input: CreateActiveBaselineInput): Promise<ActiveBaseline> {
    const baseline: ActiveBaseline = {
      id: cuid('active_baseline'),
      suite_id: input.suite_id,
      kickoff_batch_id: input.kickoff_batch_id,
      warmup_batch_id: input.warmup_batch_id,
      previous_baseline_id: input.previous_baseline_id ?? null,
      is_current: input.is_current ?? true,
      activated_by_user_id: input.activated_by_user_id ?? null,
      activated_at: input.activated_at ?? new Date(),
      deactivated_at: input.deactivated_at ?? null,
    }
    this.baselines.set(baseline.id, baseline)
    return baseline
  }

  async listBaselines(): Promise<ActiveBaseline[]> {
    return [...this.baselines.values()].sort((a, b) => b.activated_at.getTime() - a.activated_at.getTime())
  }

  async findBaselineById(id: string): Promise<ActiveBaseline | null> {
    return this.baselines.get(id) ?? null
  }

  async findCurrentBaseline(): Promise<ActiveBaseline | null> {
    const baselines = await this.listBaselines()
    return baselines.find((item) => item.is_current) ?? null
  }

  async updateBaseline(id: string, patch: UpdateActiveBaselineInput): Promise<ActiveBaseline | null> {
    const current = this.baselines.get(id)
    if (!current) return null
    const next: ActiveBaseline = {
      ...current,
      ...patch,
    }
    this.baselines.set(id, next)
    return next
  }

  async createGovernanceBatch(input: CreateGovernanceBatchInput): Promise<GovernanceBatch> {
    const now = new Date()
    const batch: GovernanceBatch = {
      id: cuid('governance_batch'),
      action: input.action,
      requested_by_user_id: input.requested_by_user_id ?? null,
      suite_id: input.suite_id ?? null,
      warm_start_batch_ids: [...(input.warm_start_batch_ids ?? [])],
      content_ids: [...(input.content_ids ?? [])],
      scope_json: input.scope_json ?? {},
      preview_json: input.preview_json ?? {},
      result_json: input.result_json ?? null,
      executed_at: input.executed_at ?? null,
      created_at: now,
      updated_at: now,
    }
    this.governanceBatches.set(batch.id, batch)
    return batch
  }

  async findGovernanceBatchById(id: string): Promise<GovernanceBatch | null> {
    return this.governanceBatches.get(id) ?? null
  }

  async updateGovernanceBatch(id: string, patch: UpdateGovernanceBatchInput): Promise<GovernanceBatch | null> {
    const current = this.governanceBatches.get(id)
    if (!current) return null
    const next: GovernanceBatch = {
      ...current,
      ...patch,
      updated_at: new Date(),
    }
    this.governanceBatches.set(id, next)
    return next
  }
}
