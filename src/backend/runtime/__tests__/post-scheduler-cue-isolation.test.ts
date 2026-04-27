/**
 * T-211 invariant smoke test — locks in the boundary documented in
 * `dev-docs/active/post-scheduler-boundary/02-architecture.md` §E.
 *
 * Invariants covered here:
 *
 *   I-2. PostScheduler does not read cue tables.
 *        No `publicDiscussionCue*` Prisma access, no `cue-repository` import,
 *        no `CueWorker` reference inside `src/backend/runtime/post-scheduler.ts`.
 *
 *   I-2 (caller side). RuntimeLoop's autonomous branch — the only path that
 *        invokes PostScheduler today — must not surface cue knowledge into
 *        the autonomous tick. Asserted on `runtime-loop.ts` as a whole.
 *
 *   I-3. CueWorker does not call PostScheduler. Verified once T-212 lands by
 *        a sibling test under `src/backend/programming/cue/__tests__/...`.
 *        T-211 only owns I-2; T-212 owns I-3.
 *
 * The check is a deliberate text grep rather than an AST analysis: T-211 is
 * doc-only, the goal is to lock the *current* clean state of these files so
 * incidental imports during T-212 / T-213 implementation cannot drift the
 * autonomous track. T-212's CueWorker implementation will land its own lint
 * rule (per umbrella §2.3) — this test is the pre-T-212 backstop.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const POST_SCHEDULER = resolve(here, '../post-scheduler.ts')
const RUNTIME_LOOP = resolve(here, '../runtime-loop.ts')

// Tokens that, if found, indicate cue-table coupling has leaked into the
// autonomous track. Update only when a counter-example is genuinely added
// (which, per I-2 / I-3, should not happen during the T-207 umbrella).
const CUE_TABLE_TOKENS = [
  // Prisma model accessors
  'publicDiscussionCue',
  'publicDiscussionCueChange',
  'publicDiscussionCueMedia',
  'publicDiscussionCueSchedule',
  'cueExecutionAttempt',
  // Domain-layer modules
  'cue-repository',
  'cue-editor-service',
  'cue-preview-service',
  'cue-board-read-service',
  'cue-worker',
  'CueWorker',
  // Domain types that, if imported, signal a coupling with the cue path
  'PublicDiscussionCueDomain',
  'CuePatchV1',
  'CueChangeDomain',
  'PublicDiscussionCueChangeDomain',
]

function assertNoCueCoupling(filePath: string, label: string): void {
  const source = readFileSync(filePath, 'utf-8')
  const violations: Array<{ token: string; line: number; preview: string }> = []
  for (const token of CUE_TABLE_TOKENS) {
    const idx = source.indexOf(token)
    if (idx === -1) continue
    // Compute line number for diagnostic output.
    const before = source.slice(0, idx)
    const line = before.split('\n').length
    const lineStart = before.lastIndexOf('\n') + 1
    const lineEnd = source.indexOf('\n', idx)
    const preview = source.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim()
    violations.push({ token, line, preview })
  }
  if (violations.length > 0) {
    const detail = violations
      .map((v) => `  - "${v.token}" at ${label}:${v.line}\n      ${v.preview}`)
      .join('\n')
    throw new Error(
      `T-211 invariant I-2 violated: ${label} references cue infrastructure.\n${detail}\n\nSee dev-docs/active/post-scheduler-boundary/02-architecture.md §E.`,
    )
  }
}

describe('T-211 I-2 — PostScheduler / RuntimeLoop autonomous track stays free of cue coupling', () => {
  it('post-scheduler.ts contains no cue table accessors or cue-domain imports', () => {
    expect(() => assertNoCueCoupling(POST_SCHEDULER, 'src/backend/runtime/post-scheduler.ts')).not.toThrow()
  })

  it('runtime-loop.ts (autonomous branch host) contains no cue table accessors or cue-domain imports', () => {
    expect(() => assertNoCueCoupling(RUNTIME_LOOP, 'src/backend/runtime/runtime-loop.ts')).not.toThrow()
  })
})
