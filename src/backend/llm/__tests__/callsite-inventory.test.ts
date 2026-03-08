import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { VoiceLineId } from '../../../shared/agent-persona-catalog.js'
import {
  isRoutingIntent,
  LLM_CALLSITE_INVENTORY,
  LLM_DIRECT_CALL_GUARD_COUNTS,
} from '../callsite-inventory.js'
import { resolveVoiceLineTierProfileRef } from '../voice-line-routing.js'

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
      expect(entry.migration_blocker.length).toBeGreaterThan(10)

      if (!isRoutingIntent(entry.intent) || entry.tier_floor === 'n/a') {
        continue
      }

      const routingTier = entry.tier_floor === 'identityWriteTier' ? 'premium' : entry.tier_floor
      expect(entry.expected_profile_refs).not.toBeNull()
      for (const [voiceLineId, expectedProfileId] of Object.entries(entry.expected_profile_refs ?? {})) {
        expect(
          resolveVoiceLineTierProfileRef(
            voiceLineId as VoiceLineId,
            entry.intent,
            routingTier,
          ),
        ).toBe(expectedProfileId)
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
