import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../..')

export function locateDevDocsPath(input) {
  const activePath = resolve(
    REPO_ROOT,
    'dev-docs/active',
    input.bundle_slug,
    input.file_name,
  )
  if (existsSync(activePath)) {
    return {
      path: activePath,
      tier: 'active',
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
      tier: 'archive',
    }
  }

  return {
    path: activePath,
    tier: 'missing_active_default',
  }
}

export function resolveDevDocsPath(input) {
  return locateDevDocsPath(input).path
}
