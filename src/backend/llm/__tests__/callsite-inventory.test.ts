import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { VoiceLineId } from '../../../shared/agent-persona-catalog.js'
import {
  isRoutingIntent,
  LLM_CALLSITE_INVENTORY,
  LLM_DIRECT_CALL_GUARD_COUNTS,
  type LlmCallsiteInventoryEntry,
} from '../callsite-inventory.js'
import {
  resolveIdentityWriteProfileRef,
  resolveVoiceLineTierProfileRef,
} from '../voice-line-routing.js'

const BACKEND_ROOT = join(process.cwd(), 'src', 'backend')
const INVENTORY_IMPLEMENTATION_PATH = join(
  process.cwd(),
  'src',
  'backend',
  'llm',
  'callsite-inventory.ts',
)

describe('LLM callsite inventory guard', () => {
  it('tracks every direct llmClient.chat and promptEngine.render source callsite count', () => {
    const actualChatCounts = collectDirectCallCounts(BACKEND_ROOT, /llmClient\.chat\s*\(/g)
    const actualRenderCounts = collectDirectCallCounts(BACKEND_ROOT, /promptEngine!?\.render\s*\(/g)

    expect(actualChatCounts).toEqual(buildExpectedCounts('llmClient.chat'))
    expect(actualRenderCounts).toEqual(buildExpectedCounts('promptEngine.render'))
  })

  it('tracks every gateway local override callsite in the inventory handoff set', () => {
    const actualLocalOverrideCounts = Object.fromEntries(
      Object.entries(collectRawOverrideCounts(BACKEND_ROOT))
        .filter(([file]) => !file.startsWith('src/backend/llm/')),
    )
    const uniqueInventoryCallsites = new Set<string>()
    const expectedLocalOverrideCounts = LLM_CALLSITE_INVENTORY
      .filter((entry) => entry.local_override_fields.length > 0)
      .reduce<Record<string, number>>((acc, entry) => {
        const signature = entry.evidence_patterns.find((pattern) => pattern.startsWith('traceId:'))
          ?? entry.evidence_patterns.find((pattern) => pattern.includes('generate'))
          ?? entry.source_id
        const dedupeKey = `${entry.source_file}::${signature}`
        if (uniqueInventoryCallsites.has(dedupeKey)) {
          return acc
        }
        uniqueInventoryCallsites.add(dedupeKey)
        acc[entry.source_file] = (acc[entry.source_file] ?? 0) + 1
        return acc
      }, {})

    expect(actualLocalOverrideCounts).toEqual(expectedLocalOverrideCounts)
  })

  it('records exact local override fields for each dual-track gateway callsite', () => {
    for (const entry of LLM_CALLSITE_INVENTORY.filter((item) => item.local_override_fields.length > 0)) {
      expect(extractLocalOverrideFields(entry)).toEqual([...entry.local_override_fields].sort())
    }
  })

  it('records explicit execution policy bindings for migrated callsites that need them', () => {
    for (const entry of LLM_CALLSITE_INVENTORY) {
      if (entry.policy_binding_mode === 'callsite-execution-policy') {
        expect(extractExecutionPolicyId(entry)).toBe(entry.target_policy_id)
        continue
      }
      if (entry.policy_binding_mode === 'profile-default') {
        expect(extractExecutionPolicyId(entry)).toBeNull()
      }
    }
  })

  it('records semantic evidence for every inventory entry', () => {
    for (const entry of LLM_CALLSITE_INVENTORY) {
      const content = readFileSync(join(process.cwd(), entry.source_file), 'utf-8')
      for (const pattern of entry.evidence_patterns) {
        expect(content).toContain(pattern)
      }
    }
  })

  it('maps inventory entries to intent-aware target profiles', () => {
    for (const entry of LLM_CALLSITE_INVENTORY) {
      expect(entry.source_id).toBeTruthy()
      expect(entry.source_file.startsWith('src/backend/')).toBe(true)
      expect(entry.prompt_ref.id).toBeTruthy()
      expect(entry.prompt_ref.version).toBeGreaterThan(0)
      expect(entry.voice_line_authority.length).toBeGreaterThan(10)
      expect(entry.target_gateway_surface).toBeTruthy()
      expect(entry.migration_status).toBeTruthy()
      if (entry.migration_status === 'intentionally-retained') {
        expect(entry.target_policy_id).toBeNull()
      } else {
        expect(entry.target_policy_id).toBeTruthy()
      }
      if (entry.migration_status === 'intentionally-retained') {
        expect(entry.policy_binding_mode).toBe('not-applicable')
      } else {
        expect(entry.policy_binding_mode).not.toBe('not-applicable')
      }
      if (entry.local_override_fields.length > 0) {
        expect(entry.migration_status).toBe('dual-track')
        expect(entry.local_override_notes?.length ?? 0).toBeGreaterThan(10)
      } else if (entry.migration_status === 'migrated') {
        expect(entry.local_override_notes).toBeNull()
      }
      expect(entry.migration_blocker.length).toBeGreaterThan(10)

      if (!isRoutingIntent(entry.intent) || entry.tier_floor === 'n/a') {
        continue
      }

      const routingTier = entry.tier_floor === 'identityWriteTier' ? 'premium' : entry.tier_floor
      expect(entry.expected_profile_refs).not.toBeNull()
      for (const [voiceLineId, expectedProfileId] of Object.entries(entry.expected_profile_refs ?? {})) {
        const resolved = entry.intent === 'identity_write'
          ? resolveIdentityWriteProfileRef(voiceLineId as VoiceLineId, routingTier)
          : resolveVoiceLineTierProfileRef(
              voiceLineId as VoiceLineId,
              entry.intent,
              routingTier,
            )
        expect(resolved).toBe(expectedProfileId)
      }
    }
  })
})

function buildExpectedCounts(
  directCall: 'llmClient.chat' | 'promptEngine.render',
): Record<string, number> {
  return Object.entries(LLM_DIRECT_CALL_GUARD_COUNTS)
    .filter(([, counts]) => counts[directCall] !== undefined)
    .reduce<Record<string, number>>((acc, [file, counts]) => {
      acc[file] = counts[directCall] ?? 0
      return acc
    }, {})
}

function collectDirectCallCounts(rootDir: string, pattern: RegExp): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const file of walkBackendSourceFiles(rootDir)) {
    if (file === INVENTORY_IMPLEMENTATION_PATH) continue
    const content = readFileSync(file, 'utf-8')
    const matches = content.match(pattern)
    if (!matches || matches.length === 0) continue
    const relative = file.slice(process.cwd().length + 1).replace(/\\/g, '/')
    counts[relative] = matches.length
  }

  return counts
}

function collectRawOverrideCounts(rootDir: string): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const file of walkBackendSourceFiles(rootDir)) {
    if (file === INVENTORY_IMPLEMENTATION_PATH) continue
    const content = readFileSync(file, 'utf-8')
    const matches = Array.from(content.matchAll(/localOverrides\s*:\s*\{([\s\S]*?)\n\s*}/g))
      .filter(([, block]) =>
        /\b(timeoutMs|maxRetries|regionHint)\s*:/.test(block))
    if (matches.length === 0) continue
    const relative = file.slice(process.cwd().length + 1).replace(/\\/g, '/')
    counts[relative] = matches.length
  }

  return counts
}

function extractLocalOverrideFields(entry: LlmCallsiteInventoryEntry): string[] {
  const content = readFileSync(join(process.cwd(), entry.source_file), 'utf-8')
  const anchor = entry.evidence_patterns.find((pattern) => pattern.startsWith('PROMPT_TEMPLATE_REFS.'))
    ?? entry.evidence_patterns.find((pattern) => pattern.startsWith('traceId:'))
    ?? entry.evidence_patterns.find((pattern) => pattern.includes('generate'))
    ?? entry.evidence_patterns.find((pattern) => pattern.startsWith('intent:'))
    ?? entry.evidence_patterns[0]

  if (!anchor) {
    return []
  }

  const anchorIndex = content.indexOf(anchor)
  if (anchorIndex < 0) {
    return []
  }

  const snippet = extractGatewayInvocationSnippet(content, anchorIndex)
  const localOverrideMatch = snippet.match(/localOverrides\s*:\s*\{([\s\S]*?)\n\s*}/)
  if (!localOverrideMatch) {
    return []
  }

  return Array.from(localOverrideMatch[1].matchAll(/^\s*([A-Za-z][A-Za-z0-9]*)\s*:/gm))
    .map(([, field]) => field)
    .filter((field, index, fields) => fields.indexOf(field) === index)
    .filter((field) => field !== 'executionPolicyId')
    .sort()
}

function extractExecutionPolicyId(entry: LlmCallsiteInventoryEntry): string | null {
  const content = readFileSync(join(process.cwd(), entry.source_file), 'utf-8')
  const anchor = entry.evidence_patterns.find((pattern) => pattern.startsWith('PROMPT_TEMPLATE_REFS.'))
    ?? entry.evidence_patterns.find((pattern) => pattern.startsWith('traceId:'))
    ?? entry.evidence_patterns.find((pattern) => pattern.includes('generate'))
    ?? entry.evidence_patterns.find((pattern) => pattern.startsWith('intent:'))
    ?? entry.evidence_patterns[0]

  if (!anchor) {
    return null
  }

  const anchorIndex = content.indexOf(anchor)
  if (anchorIndex < 0) {
    return null
  }

  const snippet = extractGatewayInvocationSnippet(content, anchorIndex)
  const localOverrideMatch = snippet.match(/localOverrides\s*:\s*\{([\s\S]*?)\n\s*}/)
  if (localOverrideMatch) {
    const policyIdMatch = localOverrideMatch[1].match(/executionPolicyId\s*:\s*['"`]([^'"`]+)['"`]/)
    if (policyIdMatch?.[1]) {
      return policyIdMatch[1]
    }
  }

  const helperMatch = snippet.match(/localOverrides\s*:\s*([A-Za-z][A-Za-z0-9_]*)\s*\(/)
  if (!helperMatch?.[1]) {
    return null
  }

  const helperDefinition = content.match(
    new RegExp(`function\\s+${helperMatch[1]}\\s*\\([\\s\\S]*?executionPolicyId\\s*:\\s*['"\`]([^'"\\\`]+)['"\`]`, 'm'),
  )
  return helperDefinition?.[1] ?? null
}

function extractGatewayInvocationSnippet(content: string, anchorIndex: number): string {
  const callAnchors = [
    'this.deps.llmGateway.generateVisibleText({',
    'this.deps.llmGateway.generateHiddenArtifact({',
    'this.deps.llmGateway.generateIdentityWrite({',
    'this.deps.llmGateway.chat({',
    'llmGateway.generateVisibleText({',
    'llmGateway.generateHiddenArtifact({',
    'llmGateway.generateIdentityWrite({',
    'llmGateway.chat({',
  ]
  const start = callAnchors.reduce((best, pattern) => {
    const index = content.lastIndexOf(pattern, anchorIndex)
    return index > best ? index : best
  }, -1)
  if (start < 0) {
    return content.slice(anchorIndex, anchorIndex + 1_200)
  }

  const braceStart = content.indexOf('{', start)
  if (braceStart < 0) {
    return content.slice(start, start + 1_200)
  }

  let depth = 0
  for (let index = braceStart; index < content.length; index += 1) {
    const char = content[index]
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
    if (depth === 0) {
      return content.slice(start, index + 1)
    }
  }

  return content.slice(start, start + 1_200)
}

function walkBackendSourceFiles(rootDir: string): string[] {
  const output: string[] = []

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const nextPath = join(rootDir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue
      output.push(...walkBackendSourceFiles(nextPath))
      continue
    }
    if (!entry.isFile() || !nextPath.endsWith('.ts')) continue
    output.push(nextPath)
  }

  return output
}
