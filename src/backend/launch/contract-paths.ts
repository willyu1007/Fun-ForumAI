import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { ValidationError } from '../lib/errors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')
const DEFAULT_LAUNCH_MANIFEST_PATH = resolve(REPO_ROOT, 'config/launch/manifest.v1.yaml')

const launchManifestSchema = z.object({
  version: z.literal(1),
  contracts: z.array(z.object({
    id: z.string().trim().min(1),
    bundle_slug: z.string().trim().min(1),
    file_name: z.string().trim().min(1),
    path: z.string().trim().min(1),
  }).strict()).min(1),
}).strict()

export type LaunchContractManifest = z.infer<typeof launchManifestSchema>

let cachedLaunchManifest: LaunchContractManifest | null = null

function toValidationMessage(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ')
}

export function readLaunchContractManifest(manifestPath = DEFAULT_LAUNCH_MANIFEST_PATH): LaunchContractManifest {
  if (cachedLaunchManifest && manifestPath === DEFAULT_LAUNCH_MANIFEST_PATH) {
    return cachedLaunchManifest
  }

  const parsed = launchManifestSchema.safeParse(parseYaml(readFileSync(manifestPath, 'utf8')))
  if (!parsed.success) {
    throw new ValidationError(`Invalid launch contract manifest: ${toValidationMessage(parsed.error)}`)
  }

  const seenIds = new Set<string>()
  const seenLegacyKeys = new Set<string>()
  const seenPaths = new Set<string>()
  for (const contract of parsed.data.contracts) {
    const legacyKey = `${contract.bundle_slug}::${contract.file_name}`
    if (seenIds.has(contract.id)) {
      throw new ValidationError(`Invalid launch contract manifest: duplicate contract id "${contract.id}"`)
    }
    if (seenLegacyKeys.has(legacyKey)) {
      throw new ValidationError(`Invalid launch contract manifest: duplicate legacy contract mapping "${legacyKey}"`)
    }
    if (seenPaths.has(contract.path)) {
      throw new ValidationError(`Invalid launch contract manifest: duplicate path "${contract.path}"`)
    }
    seenIds.add(contract.id)
    seenLegacyKeys.add(legacyKey)
    seenPaths.add(contract.path)
  }

  if (manifestPath === DEFAULT_LAUNCH_MANIFEST_PATH) {
    cachedLaunchManifest = parsed.data
  }

  return parsed.data
}

function findLaunchContractEntry(input: {
  bundle_slug: string
  file_name: string
}) {
  const manifest = readLaunchContractManifest()
  return manifest.contracts.find((contract) =>
    contract.bundle_slug === input.bundle_slug && contract.file_name === input.file_name)
}

export function locateLaunchContractPath(input: {
  bundle_slug: string
  file_name: string
}) {
  const contract = findLaunchContractEntry(input)
  if (contract) {
    const configPath = resolve(REPO_ROOT, contract.path)
    if (existsSync(configPath)) {
      return {
        path: configPath,
        tier: 'config' as const,
      }
    }
    return {
      path: configPath,
      tier: 'missing_config_default' as const,
    }
  }

  const defaultPath = resolve(
    REPO_ROOT,
    'config/launch',
    input.file_name,
  )
  if (existsSync(defaultPath)) {
    return {
      path: defaultPath,
      tier: 'config_file_fallback' as const,
    }
  }

  return {
    path: defaultPath,
    tier: 'missing_config_default' as const,
  }
}

export function resolveLaunchContractPath(input: {
  bundle_slug: string
  file_name: string
}): string {
  return locateLaunchContractPath(input).path
}
