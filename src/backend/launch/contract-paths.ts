import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')

export function resolveLaunchContractPath(input: {
  bundle_slug: string
  file_name: string
}): string {
  const activePath = resolve(
    REPO_ROOT,
    'dev-docs/active',
    input.bundle_slug,
    input.file_name,
  )
  if (existsSync(activePath)) {
    return activePath
  }

  const archivedPath = resolve(
    REPO_ROOT,
    'dev-docs/archive',
    input.bundle_slug,
    input.file_name,
  )
  if (existsSync(archivedPath)) {
    return archivedPath
  }

  return activePath
}
