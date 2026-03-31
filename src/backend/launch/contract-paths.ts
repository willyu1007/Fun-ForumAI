import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')

export function locateLaunchContractPath(input: {
  bundle_slug: string
  file_name: string
}) {
  const activePath = resolve(
    REPO_ROOT,
    'dev-docs/active',
    input.bundle_slug,
    input.file_name,
  )
  if (existsSync(activePath)) {
    return {
      path: activePath,
      tier: 'active' as const,
    }
  }

  const archivePath = resolve(
    REPO_ROOT,
    'dev-docs/archive',
    input.bundle_slug,
    input.file_name,
  )
  if (existsSync(archivePath)) {
    return {
      path: archivePath,
      tier: 'archive' as const,
    }
  }

  return {
    path: activePath,
    tier: 'missing_active_default' as const,
  }
}

export function resolveLaunchContractPath(input: {
  bundle_slug: string
  file_name: string
}): string {
  return locateLaunchContractPath(input).path
}
