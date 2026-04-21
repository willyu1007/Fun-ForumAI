const DEFAULT_RUNTIME_CLOSEOUT_MAX_AGENT_ATTEMPTS = 1
const MAX_RUNTIME_CLOSEOUT_MAX_AGENT_ATTEMPTS = 5

export type RuntimeCloseoutFanoutOptions = {
  allowAgentFanout: boolean
  maxAgentAttempts: number
}

export function parseRuntimeCloseoutFanoutOptions(input: unknown): RuntimeCloseoutFanoutOptions {
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  // Fanout is intentionally opt-in so admin smoke requests stay bounded by default.
  // `max_agent_attempts` alone never widens the search unless `allow_agent_fanout=true`.
  const allowAgentFanout = body.allow_agent_fanout === true
  const rawMaxAgentAttempts = body.max_agent_attempts
  const parsedMaxAgentAttempts =
    typeof rawMaxAgentAttempts === 'number'
      ? rawMaxAgentAttempts
      : typeof rawMaxAgentAttempts === 'string' && rawMaxAgentAttempts.trim()
        ? Number(rawMaxAgentAttempts)
        : Number.NaN

  if (!allowAgentFanout) {
    return {
      allowAgentFanout,
      maxAgentAttempts: DEFAULT_RUNTIME_CLOSEOUT_MAX_AGENT_ATTEMPTS,
    }
  }

  const normalizedMaxAgentAttempts = Number.isInteger(parsedMaxAgentAttempts)
    && parsedMaxAgentAttempts > 0
    ? parsedMaxAgentAttempts
    : DEFAULT_RUNTIME_CLOSEOUT_MAX_AGENT_ATTEMPTS

  return {
    allowAgentFanout,
    maxAgentAttempts: Math.min(
      normalizedMaxAgentAttempts,
      MAX_RUNTIME_CLOSEOUT_MAX_AGENT_ATTEMPTS,
    ),
  }
}

export function resolveRuntimeCloseoutCandidateIds(input: {
  agentId: string
  activeAgentIds: string[]
  options?: RuntimeCloseoutFanoutOptions
}): string[] {
  const { agentId, activeAgentIds } = input
  const options = input.options ?? {
    allowAgentFanout: false,
    maxAgentAttempts: DEFAULT_RUNTIME_CLOSEOUT_MAX_AGENT_ATTEMPTS,
  }
  if (agentId) return [agentId]
  return activeAgentIds.slice(0, options.maxAgentAttempts)
}
