import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { config } from '../lib/config.js'
import { LLMGatewayContractError } from './gateway-contract.js'

const secretEntrySchema = z.union([
  z.object({
    backend: z.literal('env'),
    ref: z.string().min(1),
  }).strict(),
  z.object({
    backend: z.literal('file'),
    ref: z.string().min(1),
  }).strict(),
  z.object({
    backend: z.literal('bws'),
    project_id: z.string().min(1).optional(),
    project_name: z.string().min(1).optional(),
    key: z.string().min(1).optional(),
    ref: z.string().min(1).optional(),
  }).strict(),
])

const secretFileSchema = z.object({
  version: z.number().int().positive(),
  secrets: z.record(z.string().min(1), secretEntrySchema),
}).strict()

type SecretEntry = z.infer<typeof secretEntrySchema>

interface SecretResolverOptions {
  appEnv?: 'dev' | 'staging' | 'prod'
  env?: NodeJS.ProcessEnv
  secretsFilePath?: string
  policyPath?: string
  contractPath?: string
  bwsExecutable?: string
  allowBwsFallback?: boolean
}

export class SecretResolver {
  private readonly appEnv: 'dev' | 'staging' | 'prod'
  private readonly env: NodeJS.ProcessEnv
  private readonly secretsFilePath: string
  private readonly policyPath: string
  private readonly contractPath: string
  private readonly bwsExecutable: string
  private readonly allowBwsFallback: boolean
  private readonly cache = new Map<string, string>()
  private readonly bwsProjectIdCache = new Map<string, string>()
  private readonly bwsSecretsCache = new Map<string, Record<string, string>>()
  private readonly secretRefEnvVars: Map<string, string[]>
  private readonly secrets: z.infer<typeof secretFileSchema>

  constructor(options: SecretResolverOptions = {}) {
    this.appEnv = options.appEnv ?? config.appEnv
    this.env = options.env ?? process.env
    this.secretsFilePath = options.secretsFilePath ?? defaultSecretsFilePath(this.appEnv)
    this.policyPath = options.policyPath ?? defaultPolicyPath()
    this.contractPath = options.contractPath ?? defaultContractPath()
    this.bwsExecutable = options.bwsExecutable ?? 'bws'
    this.allowBwsFallback = options.allowBwsFallback ?? (this.appEnv === 'dev')
    this.secretRefEnvVars = loadContractSecretEnvVarMap(this.contractPath)
    this.secrets = this.loadSecrets()
  }

  resolve(secretRef: string): string {
    if (secretRef.startsWith('secret-ref:')) {
      return this.resolveSecretRef(secretRef.slice('secret-ref:'.length))
    }
    if (secretRef.startsWith('env://')) {
      return this.resolveEnvVar(secretRef.slice('env://'.length))
    }
    if (secretRef.startsWith('file://') || secretRef.startsWith('file:')) {
      return this.resolveFileRef(secretRef)
    }
    if (secretRef.startsWith('bws://')) {
      return this.resolveBwsRef({ backend: 'bws', ref: secretRef })
    }
    return secretRef
  }

  resolveSecretRef(secretName: string): string {
    const normalized = secretName.trim()
    if (!normalized) {
      throw new LLMGatewayContractError('AuthError', 'Secret ref name cannot be empty')
    }
    const cached = this.cache.get(normalized)
    if (cached !== undefined) {
      return cached
    }

    const envValue = this.resolveEnvAlias(normalized)
    if (envValue !== null) {
      this.cache.set(normalized, envValue)
      return envValue
    }

    const entry = this.secrets.secrets[normalized]
    if (!entry) {
      throw new LLMGatewayContractError(
        'AuthError',
        `Secret ref is not declared: ${normalized}`,
        { secret_ref: normalized, secrets_file_path: this.secretsFilePath },
      )
    }

    const value = this.resolveEntry(entry)
    this.cache.set(normalized, value)
    return value
  }

  private resolveEntry(entry: SecretEntry): string {
    switch (entry.backend) {
      case 'env':
        return this.resolve(entry.ref)
      case 'file':
        return this.resolveFileRef(entry.ref)
      case 'bws':
        return this.resolveBwsRef(entry)
      default:
        throw new LLMGatewayContractError('AuthError', 'Unsupported secret backend', {
          backend: (entry as { backend?: string }).backend ?? 'unknown',
        })
    }
  }

  private resolveEnvVar(name: string): string {
    const value = this.env[name]
    if (!value) {
      throw new LLMGatewayContractError(
        'AuthError',
        `Environment secret is missing: ${name}`,
        { env_var: name },
      )
    }
    return value
  }

  private resolveFileRef(ref: string): string {
    const rawPath = ref.startsWith('file://')
      ? ref.slice('file://'.length)
      : ref.slice('file:'.length)
    const targetPath = rawPath.startsWith('/')
      ? rawPath
      : resolve(repoRoot(), rawPath)
    try {
      return readFileSync(targetPath, 'utf-8').trim()
    } catch (error) {
      throw new LLMGatewayContractError('AuthError', 'Failed to read file-backed secret', {
        file_path: targetPath,
        cause: error instanceof Error ? error.message : 'Unknown file read error',
      })
    }
  }

  private resolveEnvAlias(secretName: string): string | null {
    const envVars = this.secretRefEnvVars.get(secretName)
    if (!envVars?.length) {
      return null
    }

    for (const envVar of envVars) {
      const value = this.env[envVar]
      if (typeof value === 'string' && value.trim()) {
        return value
      }
    }

    return null
  }

  private resolveBwsRef(entry: Extract<SecretEntry, { backend: 'bws' }>): string {
    if (!this.allowBwsFallback) {
      throw new LLMGatewayContractError(
        'AuthError',
        'Bitwarden fallback is disabled for runtime in this environment; inject the secret via env at deploy time',
        { app_env: this.appEnv },
      )
    }
    const resolved = normalizeBwsEntry(entry, this.policyPath)
    const projectId = resolved.projectId ?? this.resolveBwsProjectIdByName(resolved.projectName)
    const projectSecrets = this.listBwsSecrets(projectId)
    const value = projectSecrets[resolved.key]

    if (!value) {
      throw new LLMGatewayContractError('AuthError', 'Failed to resolve Bitwarden secret', {
        key: resolved.key,
        project_name: resolved.projectName,
        project_id: projectId,
        cause: `Secret key not found in Bitwarden project: ${resolved.key}`,
      })
    }

    return value
  }

  private loadSecrets() {
    let parsed: unknown
    try {
      parsed = parseYaml(readFileSync(this.secretsFilePath, 'utf-8'))
    } catch (error) {
      throw new LLMGatewayContractError('AuthError', 'Failed to load secret refs file', {
        secrets_file_path: this.secretsFilePath,
        cause: error instanceof Error ? error.message : 'Unknown YAML read error',
      })
    }

    const result = secretFileSchema.safeParse(parsed)
    if (!result.success) {
      throw new LLMGatewayContractError('AuthError', 'Invalid secret refs file', {
        secrets_file_path: this.secretsFilePath,
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    return result.data
  }

  private resolveBwsProjectIdByName(projectName?: string): string {
    const normalized = projectName?.trim().toLowerCase()
    if (!normalized) {
      throw new LLMGatewayContractError('AuthError', 'Bitwarden project_name is required')
    }
    const cached = this.bwsProjectIdCache.get(normalized)
    if (cached) return cached

    const projects = this.runCliJson(
      ['project', 'list', '--output', 'json', '--color', 'no'],
      'bws project list',
    )
    if (!Array.isArray(projects)) {
      throw new LLMGatewayContractError('AuthError', 'Bitwarden project list returned invalid payload')
    }

    const matches = projects
      .filter((item): item is { id?: string; name?: string } => Boolean(item && typeof item === 'object'))
      .filter((item) => typeof item.name === 'string' && item.name.trim().toLowerCase() === normalized)
      .map((item) => item.id)
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)

    if (matches.length !== 1) {
      throw new LLMGatewayContractError('AuthError', 'Bitwarden project_name resolution failed', {
        project_name: projectName,
        match_count: matches.length,
      })
    }

    this.bwsProjectIdCache.set(normalized, matches[0])
    return matches[0]
  }

  private listBwsSecrets(projectId: string): Record<string, string> {
    const normalized = projectId.trim()
    if (!normalized) {
      throw new LLMGatewayContractError('AuthError', 'Bitwarden project_id is required')
    }
    const cached = this.bwsSecretsCache.get(normalized)
    if (cached) return cached

    const secrets = this.runCliJson(
      ['secret', 'list', normalized, '--output', 'json', '--color', 'no'],
      'bws secret list',
    )
    if (!Array.isArray(secrets)) {
      throw new LLMGatewayContractError('AuthError', 'Bitwarden secret list returned invalid payload', {
        project_id: normalized,
      })
    }

    const values: Record<string, string> = {}
    for (const item of secrets) {
      if (!item || typeof item !== 'object') continue
      const key = (item as { key?: unknown }).key
      const value = (item as { value?: unknown }).value
      if (typeof key !== 'string' || typeof value !== 'string') continue
      if (values[key] !== undefined) {
        throw new LLMGatewayContractError('AuthError', 'Duplicate Bitwarden secret key detected', {
          project_id: normalized,
          key,
        })
      }
      values[key] = value
    }

    this.bwsSecretsCache.set(normalized, values)
    return values
  }

  private runCliJson(args: string[], label: string): unknown {
    try {
      const output = execFileSync(
        this.bwsExecutable,
        args,
        {
          encoding: 'utf-8',
          env: this.env,
        },
      )
      return JSON.parse(output)
    } catch (error) {
      throw new LLMGatewayContractError('AuthError', `Failed to execute ${label}`, {
        args,
        cause: error instanceof Error ? error.message : 'Unknown CLI execution error',
      })
    }
  }
}

function normalizeBwsEntry(
  entry: Extract<SecretEntry, { backend: 'bws' }>,
  policyPath: string,
): {
  projectId?: string
  projectName?: string
  key: string
} {
  if (entry.ref?.startsWith('bws://')) {
    const url = new URL(entry.ref)
    const key = url.searchParams.get('key')
    if (!key) {
      throw new LLMGatewayContractError('AuthError', 'Bitwarden ref must include ?key=', {
        ref: entry.ref,
      })
    }
    return {
      projectId: url.hostname || undefined,
      key,
    }
  }

  let projectId = entry.project_id?.trim()
  let projectName = entry.project_name?.trim()
  let key = entry.key?.trim()

  if (!key) {
    throw new LLMGatewayContractError('AuthError', 'Bitwarden secret entry requires key', entry)
  }

  if (!projectId && !projectName) {
    const defaults = loadBwsPolicyDefaults(policyPath)
    const scopeDefaults = defaults.scopes.project ?? {}
    if (typeof scopeDefaults.project_id === 'string' && scopeDefaults.project_id.trim()) {
      projectId = scopeDefaults.project_id.trim()
    }
    if (typeof scopeDefaults.project_name === 'string' && scopeDefaults.project_name.trim()) {
      projectName = scopeDefaults.project_name.trim()
    }
    if (typeof defaults.keyPrefix === 'string' && defaults.keyPrefix && !key.startsWith(defaults.keyPrefix)) {
      key = `${defaults.keyPrefix.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`
    }
  }

  if (!projectId && !projectName) {
    throw new LLMGatewayContractError(
      'AuthError',
      'Bitwarden secret entry requires project_id or project_name',
      entry,
    )
  }

  return { projectId, projectName, key }
}

function loadBwsPolicyDefaults(policyPath: string): {
  keyPrefix?: string
  scopes: Record<string, Record<string, unknown>>
} {
  try {
    const raw = parseYaml(readFileSync(policyPath, 'utf-8')) as Record<string, unknown> | null
    const policy = raw?.policy
    const envPolicy = policy && typeof policy === 'object'
      ? (policy as Record<string, unknown>).env
      : undefined
    const secrets = envPolicy && typeof envPolicy === 'object'
      ? (envPolicy as Record<string, unknown>).secrets
      : undefined
    const backends = secrets && typeof secrets === 'object'
      ? (secrets as Record<string, unknown>).backends
      : undefined
    const bws = backends && typeof backends === 'object'
      ? (backends as Record<string, unknown>).bws
      : undefined
    return {
      keyPrefix: bws && typeof bws === 'object' && typeof (bws as Record<string, unknown>).key_prefix === 'string'
        ? String((bws as Record<string, unknown>).key_prefix)
        : undefined,
      scopes: bws && typeof bws === 'object' && typeof (bws as Record<string, unknown>).scopes === 'object' && (bws as Record<string, unknown>).scopes
        ? ((bws as Record<string, unknown>).scopes as Record<string, Record<string, unknown>>)
        : {},
    }
  } catch {
    return { scopes: {} }
  }
}

function defaultSecretsFilePath(appEnv: 'dev' | 'staging' | 'prod'): string {
  return resolve(repoRoot(), 'env', 'secrets', `${appEnv}.ref.yaml`)
}

function defaultPolicyPath(): string {
  return resolve(repoRoot(), 'docs', 'project', 'policy.yaml')
}

function defaultContractPath(): string {
  return resolve(repoRoot(), 'env', 'contract.yaml')
}

function loadContractSecretEnvVarMap(contractPath: string): Map<string, string[]> {
  try {
    const raw = parseYaml(readFileSync(contractPath, 'utf-8')) as Record<string, unknown> | null
    const variables = raw?.variables
    if (!variables || typeof variables !== 'object') {
      return new Map()
    }

    const mapping = new Map<string, string[]>()
    for (const [envVar, value] of Object.entries(variables as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const secretRef = (value as { secret_ref?: unknown }).secret_ref
      if (typeof secretRef !== 'string' || !secretRef.trim()) continue
      const normalized = secretRef.trim()
      const existing = mapping.get(normalized) ?? []
      if (!existing.includes(envVar)) {
        existing.push(envVar)
        mapping.set(normalized, existing)
      }
    }

    return mapping
  } catch {
    return new Map()
  }
}

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  return resolve(here, '../../..')
}
