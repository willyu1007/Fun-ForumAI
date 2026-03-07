import type { ConfigContext, ExpoConfig } from 'expo/config'

function readEnv(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : undefined
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const easProjectId = readEnv('EXPO_EAS_PROJECT_ID')
  const plugins = Array.isArray(config.plugins) ? [...config.plugins] : []
  if (!plugins.includes('expo-dev-client')) {
    plugins.push('expo-dev-client')
  }

  const extra = {
    ...(config.extra ?? {}),
    ...(easProjectId
      ? {
          eas: {
            ...((config.extra as { eas?: Record<string, unknown> } | undefined)?.eas ?? {}),
            projectId: easProjectId,
          },
        }
      : {}),
  }

  return {
    ...config,
    name: 'AI Talkshow',
    slug: 'fun-forum-ai',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'funforum',
    platforms: ['ios', 'android'],
    newArchEnabled: false,
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      bundleIdentifier: 'ai.funforum.app',
      associatedDomains: ['applinks:funforum.ai'],
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'ai.funforum.app',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            { scheme: 'https', host: 'funforum.ai', pathPrefix: '/' },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    plugins,
    extra,
  }
}
