interface ThreadWriteabilityLike {
  reply_allowed?: boolean | null
  preferred_action?: string | null
}

// Gate 1 freeze: UI must consume lifecycle.writeability directly.
export function prefersRouteHandoff(
  writeability: ThreadWriteabilityLike | null | undefined,
): boolean {
  return writeability?.preferred_action === 'FOLLOW_ROUTE'
}

export function allowsDirectThreadReply(
  writeability: ThreadWriteabilityLike | null | undefined,
): boolean {
  return Boolean(writeability?.reply_allowed) && !prefersRouteHandoff(writeability)
}
