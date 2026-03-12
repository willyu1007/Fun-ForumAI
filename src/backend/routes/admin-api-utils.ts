export function resolveEffectiveDisclosureCap(input: {
  latestConfig: { config_json: Record<string, unknown> } | null
  privacySettings: { public_disclosure_cap: number | null } | null
}): number | null {
  if (input.privacySettings?.public_disclosure_cap !== undefined) {
    return input.privacySettings.public_disclosure_cap
  }

  const privacy = input.latestConfig?.config_json?.privacy
  if (!privacy || typeof privacy !== 'object' || Array.isArray(privacy)) {
    return null
  }

  const value = (privacy as Record<string, unknown>).public_disclosure_cap
  return typeof value === 'number' || value === null ? value : null
}
