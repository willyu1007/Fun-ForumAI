#!/usr/bin/env node
/**
 * verify-launch-readiness.mjs
 *
 * One-click launch readiness verification. Runs all P0 automated checks
 * and produces a structured pass/fail report.
 *
 * Usage:
 *   node scripts/verify-launch-readiness.mjs [--ci] [--json]
 *
 * Flags:
 *   --ci    Exit with non-zero on any P0 failure (for CI gating)
 *   --json  Output results as JSON (for programmatic consumption)
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ciMode = process.argv.includes('--ci');
const jsonMode = process.argv.includes('--json');

const results = [];
let failCount = 0;

function run(id, name, cmd, { cwd = ROOT, allowFailure = false } = {}) {
  const start = Date.now();
  let ok = false;
  let output = '';
  try {
    output = execSync(cmd, { cwd, stdio: 'pipe', timeout: 120_000 }).toString().trim();
    ok = true;
  } catch (err) {
    output = (err.stdout?.toString() || '') + (err.stderr?.toString() || '');
    output = output.trim();
    if (allowFailure) ok = true;
  }
  const elapsed = Date.now() - start;

  if (!ok) failCount++;
  results.push({ id, name, ok, elapsed, output: output.slice(-500) });

  if (!jsonMode) {
    const icon = ok ? '✓' : '✗';
    const ms = `${elapsed}ms`;
    console.log(`  ${icon} P0-${String(id).padStart(2, '0')} ${name} (${ms})`);
    if (!ok) {
      const snippet = output.split('\n').slice(-3).join('\n    ');
      console.log(`    └─ ${snippet}`);
    }
  }
}

function runFileCheck(id, name, filePath) {
  const ok = existsSync(resolve(ROOT, filePath));
  results.push({ id, name, ok, elapsed: 0, output: ok ? 'exists' : 'not found' });
  if (!ok) failCount++;
  if (!jsonMode) {
    console.log(`  ${ok ? '✓' : '✗'} P0-${String(id).padStart(2, '0')} ${name}`);
  }
}

// ─── header ───
if (!jsonMode) {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       LAUNCH READINESS VERIFICATION              ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log('P0 — Automated checks');
  console.log('──────────────────────────────────────────────────');
}

// ─── P0 checks ───

// Database
run(1, 'Prisma schema validate', 'pnpm db:validate');
runFileCheck(2, 'Prisma schema exists', 'prisma/schema.prisma');

// Build quality
run(3, 'TypeScript typecheck', 'pnpm typecheck');
run(4, 'ESLint', 'pnpm lint');
run(5, 'Test suite (252 tests)', 'pnpm test');
run(6, 'Vite frontend build', 'pnpm build');

// CI config
runFileCheck(7, 'CI workflow exists', '.github/workflows/ci.yml');

// Packaging
run(8, 'Packaging dry-run', 'node ops/packaging/scripts/build.mjs --dry-run');
runFileCheck(9, 'Dockerfile exists', 'ops/packaging/services/llm-forum.Dockerfile');
runFileCheck(10, '.dockerignore exists', '.dockerignore');

// Deploy
run(11, 'Deploy dry-run (dev)', 'node ops/deploy/scripts/deploy.mjs --dry-run --env dev');
run(12, 'Deploy dry-run (staging)', 'node ops/deploy/scripts/deploy.mjs --dry-run --env staging');
run(13, 'Rollback dry-run (dev)', 'node ops/deploy/scripts/rollback.mjs --dry-run --env dev');

// Env contract
runFileCheck(14, 'Env contract exists', 'env/contract.yaml');
runFileCheck(15, 'Env values (dev)', 'env/values/dev.yaml');
runFileCheck(16, 'Env values (staging)', 'env/values/staging.yaml');
runFileCheck(17, 'Env values (prod)', 'env/values/prod.yaml');

// Governance
run(18, 'Governance lint', 'node .ai/scripts/ctl-project-governance.mjs lint --check --project main');

// ─── summary ───
const passCount = results.length - failCount;
const total = results.length;

if (jsonMode) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total, pass: passCount, fail: failCount },
    checks: results,
  }, null, 2));
} else {
  console.log('');
  console.log('──────────────────────────────────────────────────');
  console.log(`Result: ${passCount}/${total} passed, ${failCount} failed`);
  console.log('');

  if (failCount === 0) {
    console.log('🟢 ALL P0 CHECKS PASSED — launch readiness confirmed');
  } else {
    console.log('🔴 P0 FAILURES DETECTED — resolve before deployment');
    console.log('');
    for (const r of results.filter(r => !r.ok)) {
      console.log(`  ✗ P0-${String(r.id).padStart(2, '0')} ${r.name}`);
    }
  }
  console.log('');
}

process.exit(ciMode && failCount > 0 ? 1 : 0);
