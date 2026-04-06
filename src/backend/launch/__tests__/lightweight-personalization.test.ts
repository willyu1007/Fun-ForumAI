import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { resolveLaunchContractPath } from '../contract-paths.js'
import { getLightweightPersonalizationRuntime } from '../lightweight-personalization.js'

const sourcePath = resolveLaunchContractPath({
  bundle_slug: 'p1-lightweight-personalization-and-relation-hints',
  file_name: 'lightweight_personalization_and_relation_hints.v1.yaml',
})

function withLightweightPersonalizationDraft(
  mutate: (draft: Record<string, unknown>) => void,
): string {
  const source = parseYaml(readFileSync(sourcePath, 'utf8')) as Record<string, unknown>
  mutate(source)
  const dir = mkdtempSync(join(tmpdir(), 'launch-lightweight-personalization-'))
  const filePath = join(dir, 'lightweight_personalization_and_relation_hints.v1.yaml')
  writeFileSync(filePath, stringifyYaml(source), 'utf8')
  return filePath
}

describe('lightweight personalization contract', () => {
  it('loads the canonical creator-note ranking signal from source config', () => {
    const runtime = getLightweightPersonalizationRuntime()

    expect(runtime.ranking_signals.creator_note_revisit).toBe('low_weight')
  })

  it('rejects drafts that omit creator_note_revisit', () => {
    const filePath = withLightweightPersonalizationDraft((draft) => {
      const rankingSignals = draft.ranking_signals as Record<string, unknown>
      rankingSignals.t4_revisit = rankingSignals.creator_note_revisit
      delete rankingSignals.creator_note_revisit
    })

    expect(() => getLightweightPersonalizationRuntime(filePath)).toThrowError(
      /Invalid lightweight personalization contract/,
    )
  })
})
