function readEnvString(env, key) {
  const value = env?.[key]
  return typeof value === 'string' ? value : ''
}

const PLACEHOLDER_SECRET_VALUES = new Set([
  'REPLACE_ME',
  'CHANGE_ME',
  'CHANGEME',
  'PLACEHOLDER',
  'YOUR_API_KEY',
  'YOUR-API-KEY',
  'SET_ME',
  'SETME',
  'UNSET',
  'TBD',
  'TODO',
])

export function isPlaceholderSecretValue(value) {
  if (typeof value !== 'string') return false
  const normalized = value.trim().toUpperCase()
  if (!normalized) return false
  if (PLACEHOLDER_SECRET_VALUES.has(normalized)) return true
  return (
    normalized.startsWith('EXAMPLE_') ||
    normalized.startsWith('EXAMPLE-') ||
    normalized.endsWith('_PLACEHOLDER') ||
    normalized.endsWith('-PLACEHOLDER')
  )
}

export function sanitizeSecretValue(value, fallback = '') {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed || isPlaceholderSecretValue(trimmed)) {
    return fallback
  }
  return trimmed
}

export function resolveEnvBackedSecretValue({
  existingSecretData,
  envKey,
  secretKey,
  env = process.env,
  fallback = '',
}) {
  const explicitValue = sanitizeSecretValue(readEnvString(env, String(envKey)))
  if (explicitValue) return explicitValue
  const existingValue = sanitizeSecretValue(existingSecretData[String(secretKey)])
  return existingValue || fallback
}

export function resolveDashscopeSecretData({
  existingSecretData,
  dashscopeApiKeyEnv = 'DASHSCOPE_API_KEY',
  env = process.env,
}) {
  const explicitDashscopeApiKey = sanitizeSecretValue(readEnvString(env, String(dashscopeApiKeyEnv)))
  const explicitDashscopeSecondaryApiKey = sanitizeSecretValue(
    readEnvString(env, 'DASHSCOPE_API_KEY_SECONDARY'),
  )
  const dashscopeApiKey =
    explicitDashscopeApiKey || sanitizeSecretValue(existingSecretData.DASHSCOPE_API_KEY) || ''
  const dashscopeSecondaryApiKey =
    explicitDashscopeSecondaryApiKey
    || sanitizeSecretValue(existingSecretData.DASHSCOPE_API_KEY_SECONDARY)
    || (explicitDashscopeApiKey ? explicitDashscopeApiKey : '')

  return {
    dashscopeApiKey,
    dashscopeSecondaryApiKey,
  }
}
