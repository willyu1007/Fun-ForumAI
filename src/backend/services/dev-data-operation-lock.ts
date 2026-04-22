import { ConflictError } from '../lib/errors.js'

export type DevDataOperationKind = 'warm_start_bootstrap' | 'dev_seed'

type OperationState = {
  token: symbol
  kind: DevDataOperationKind
  label?: string | null
  acquiredAt: number
}

function formatOperation(state: Pick<OperationState, 'kind' | 'label'>): string {
  const base = state.kind === 'warm_start_bootstrap' ? 'kickoff import' : 'dev seed reset/load'
  return state.label ? `${base} (${state.label})` : base
}

export class DevDataOperationLock {
  constructor(private readonly staleAfterMs = 10 * 60_000) {}

  private current: OperationState | null = null

  acquire(input: { kind: DevDataOperationKind; label?: string | null }): symbol {
    this.clearIfStale()

    if (this.current) {
      throw new ConflictError(
        `${formatOperation(this.current)} already running. Wait for it to finish before starting another dev data operation.`,
        {
          current_operation: this.current.kind,
          current_label: this.current.label ?? null,
          current_elapsed_ms: Date.now() - this.current.acquiredAt,
        },
      )
    }

    const token = Symbol(input.kind)
    this.current = {
      token,
      kind: input.kind,
      label: input.label ?? null,
      acquiredAt: Date.now(),
    }
    return token
  }

  update(token: symbol, patch: { label?: string | null }): void {
    if (!this.current || this.current.token !== token) return
    this.current = {
      ...this.current,
      label: patch.label ?? this.current.label ?? null,
    }
  }

  release(token: symbol): void {
    if (!this.current || this.current.token !== token) return
    this.current = null
  }

  private clearIfStale(): void {
    if (!this.current) return
    if (Date.now() - this.current.acquiredAt <= this.staleAfterMs) return
    this.current = null
  }
}

export const devDataOperationLock = new DevDataOperationLock()
