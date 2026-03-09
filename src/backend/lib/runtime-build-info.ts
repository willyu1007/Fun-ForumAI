import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')

const RUNTIME_FINGERPRINT_FILES = [
  'package.json',
  'src/backend/lib/config.ts',
  'src/backend/llm/gateway-contract.ts',
  'src/backend/llm/llm-gateway.ts',
  'src/backend/llm/model-preference.ts',
  '.ai/llm-config/registry/model_profiles.yaml',
  'src/backend/context-memory/memory-pack.ts',
  'src/backend/repos/pg/pg-persona-observability-repository.ts',
  'src/backend/services/memory-service.ts',
  'src/backend/services/public-observation-digest-service.ts',
  'src/backend/runtime/persona-observability.ts',
  'src/backend/runtime/persona-observation.ts',
  'src/backend/runtime/data-plane-writer.ts',
  'src/backend/runtime/post-scheduler.ts',
  'src/backend/runtime/agent-executor.ts',
  'src/backend/services/private-channel-service.ts',
  'src/backend/services/conversation-clock.ts',
  'src/backend/routes/admin-api.ts',
] as const

export interface RuntimeBuildInfo {
  service_name: string
  package_name: string | null
  package_version: string | null
  node_version: string
  hostname: string | null
  code_fingerprint: string
  fingerprint_basis: string[]
}

let cachedBuildInfo: RuntimeBuildInfo | null = null

export function getRuntimeBuildInfo(): RuntimeBuildInfo {
  if (cachedBuildInfo) return cachedBuildInfo

  const packageJson = safeReadPackageJson()
  const fingerprintBasis = RUNTIME_FINGERPRINT_FILES
    .map((path) => resolve(REPO_ROOT, path))
    .filter((path) => existsSync(path))
    .map((path) => relative(REPO_ROOT, path))

  const hash = createHash('sha256')
  for (const relPath of fingerprintBasis) {
    hash.update(`${relPath}\n`)
    hash.update(readFileSync(resolve(REPO_ROOT, relPath)))
    hash.update('\n')
  }

  cachedBuildInfo = {
    service_name: process.env.SERVICE_NAME || packageJson?.name || 'llm-forum',
    package_name: packageJson?.name ?? null,
    package_version: packageJson?.version ?? null,
    node_version: process.version,
    hostname: process.env.HOSTNAME || null,
    code_fingerprint: `sha256:${hash.digest('hex')}`,
    fingerprint_basis: fingerprintBasis,
  }
  return cachedBuildInfo
}

function safeReadPackageJson(): { name?: string; version?: string } | null {
  const path = resolve(REPO_ROOT, 'package.json')
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { name?: string; version?: string }
    return parsed
  } catch {
    return null
  }
}
