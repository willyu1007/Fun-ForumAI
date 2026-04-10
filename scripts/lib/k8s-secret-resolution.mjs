function readEnvString(env, key) {
  const value = env?.[key]
  return typeof value === 'string' ? value : ''
}

export function resolveDashscopeSecretData({
  existingSecretData,
  dashscopeApiKeyEnv = 'DASHSCOPE_API_KEY',
  env = process.env,
}) {
  const explicitDashscopeApiKey = readEnvString(env, String(dashscopeApiKeyEnv))
  const explicitDashscopeSecondaryApiKey = readEnvString(env, 'DASHSCOPE_API_KEY_SECONDARY')
  const dashscopeApiKey = explicitDashscopeApiKey || existingSecretData.DASHSCOPE_API_KEY || ''
  const dashscopeSecondaryApiKey =
    explicitDashscopeSecondaryApiKey
    || existingSecretData.DASHSCOPE_API_KEY_SECONDARY
    || (explicitDashscopeApiKey ? explicitDashscopeApiKey : '')

  return {
    dashscopeApiKey,
    dashscopeSecondaryApiKey,
  }
}
