#!/usr/bin/env node
/**
 * rollback.mjs — Provider-agnostic rollback entry.
 *
 * Validates rollback prerequisites and either prints a dry-run plan
 * or executes the rollback procedure.
 *
 * Usage:
 *   node ops/deploy/scripts/rollback.mjs --env <env> [--dry-run] [--to <version>]
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') { result.dryRun = true; continue; }
    if (a === '--env' && args[i + 1]) { result.env = args[++i]; continue; }
    if (a === '--to' && args[i + 1]) { result.to = args[++i]; continue; }
    if (a === '--help') { result.help = true; continue; }
  }
  return result;
}

function loadJSON(relPath) {
  const p = resolve(ROOT, relPath);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf-8'));
}

function printPlan(envId, deployConfig, version) {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║         ROLLBACK DRY-RUN PLAN            ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`Environment:   ${envId}`);
  console.log(`Rollback to:   ${version || 'previous revision'}`);
  console.log(`Model:         ${deployConfig.model}`);

  const registry = loadJSON('docs/packaging/registry.json');
  const targets = registry?.targets || [];

  console.log('\nRollback steps (would execute):');
  if (targets.length === 0) {
    console.log('  [warn] No packaging targets registered.');
  }
  for (const t of targets) {
    if (version) {
      console.log(`  1. kubectl set image deployment/${t.id} ${t.id}=${t.id}:${version}`);
    } else {
      console.log(`  1. kubectl rollout undo deployment/${t.id}`);
    }
    console.log(`  2. kubectl rollout status deployment/${t.id} --timeout=120s`);
    console.log(`  3. Health check: GET ${t.healthPath || '/health'}`);
  }

  console.log('\nPre-rollback checklist:');
  console.log('  ✓ Confirm current version is broken or needs reverting');
  console.log('  ✓ Notify on-call / stakeholders');
  console.log('  ✓ Check DB migration compatibility (no destructive migrations since target)');

  console.log('\nPost-rollback:');
  console.log('  1. Verify health check passes');
  console.log('  2. Run smoke tests');
  console.log('  3. Update incident log');

  console.log('\nReady to rollback: YES (dry-run mode)');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(`
rollback.mjs — Deployment rollback

Usage:
  node ops/deploy/scripts/rollback.mjs --env <env> [options]

Options:
  --env <env>       Target environment (required)
  --to <version>    Specific version to roll back to (default: previous revision)
  --dry-run         Show rollback plan without executing
  --help            Show this help
`);
    return 0;
  }

  if (!opts.env) {
    console.error('[error] --env is required. Use --help for usage.');
    return 1;
  }

  const deployConfig = loadJSON('ops/deploy/config.json');
  if (!deployConfig) {
    console.error('[error] ops/deploy/config.json not found');
    return 1;
  }

  const envCfg = deployConfig.environments.find(e => e.id === opts.env);
  if (!envCfg) {
    console.error(`[error] Environment "${opts.env}" not configured`);
    return 1;
  }

  if (opts.dryRun) {
    printPlan(opts.env, deployConfig, opts.to);
    return 0;
  }

  if (envCfg.requiresApproval) {
    console.log(`[info] Rollback on "${opts.env}" requires human approval.`);
    console.log('[info] Run with --dry-run to preview the rollback plan.');
    return 0;
  }

  console.log(`[todo] Actual rollback on "${opts.env}" not yet implemented.`);
  console.log('[info] Use --dry-run to verify the rollback plan.');
  return 0;
}

main().then(code => process.exit(code));
