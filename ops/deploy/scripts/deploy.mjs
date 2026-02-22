#!/usr/bin/env node
/**
 * deploy.mjs — Provider-agnostic deployment entry.
 *
 * Reads ops/deploy/config.json + env/contract.yaml, validates environment
 * readiness, and either prints a dry-run plan or executes the deployment.
 *
 * Usage:
 *   node ops/deploy/scripts/deploy.mjs --env <env> [--dry-run] [--service <id>]
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
    if (a === '--service' && args[i + 1]) { result.service = args[++i]; continue; }
    if (a === '--help') { result.help = true; continue; }
  }
  return result;
}

function loadJSON(relPath) {
  const p = resolve(ROOT, relPath);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf-8'));
}

function loadYAMLKeys(relPath) {
  const p = resolve(ROOT, relPath);
  if (!existsSync(p)) return null;
  const text = readFileSync(p, 'utf-8');
  const keys = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s{2}(\w+):\s*$/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

function validateEnvContract(envId) {
  const checks = [];

  const contractKeys = loadYAMLKeys('env/contract.yaml');
  checks.push({
    name: 'env/contract.yaml exists',
    ok: contractKeys !== null,
    detail: contractKeys ? `${contractKeys.length} variables defined` : 'missing',
  });

  const valuesPath = `env/values/${envId}.yaml`;
  const valuesExist = existsSync(resolve(ROOT, valuesPath));
  checks.push({
    name: `env/values/${envId}.yaml`,
    ok: valuesExist,
    detail: valuesExist ? 'present' : 'missing',
  });

  const secretsPath = `env/secrets/${envId}.ref.yaml`;
  const secretsExist = existsSync(resolve(ROOT, secretsPath));
  checks.push({
    name: `env/secrets/${envId}.ref.yaml`,
    ok: secretsExist,
    detail: secretsExist ? 'present' : 'missing',
  });

  const envConfig = `ops/deploy/environments/${envId}.yaml`;
  const envCfgExist = existsSync(resolve(ROOT, envConfig));
  checks.push({
    name: `ops/deploy/environments/${envId}.yaml`,
    ok: envCfgExist,
    detail: envCfgExist ? 'present' : 'missing',
  });

  return checks;
}

function validatePackagingTarget() {
  const registry = loadJSON('docs/packaging/registry.json');
  if (!registry || registry.targets.length === 0) {
    return { ok: false, detail: 'No packaging targets registered' };
  }
  return {
    ok: true,
    detail: registry.targets.map(t => t.id).join(', '),
    targets: registry.targets,
  };
}

function printPlan(envId, envCfg, envChecks, pkgInfo, deployConfig) {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        DEPLOYMENT DRY-RUN PLAN           ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`Environment:  ${envId}`);
  console.log(`Model:        ${deployConfig.model} (${deployConfig.k8s?.tool || 'N/A'})`);
  console.log(`Approval:     ${envCfg?.requiresApproval ? 'REQUIRED' : 'not required'}`);

  console.log('\nEnvironment contract checks:');
  for (const c of envChecks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name} — ${c.detail}`);
  }

  console.log(`\nPackaging targets: ${pkgInfo.ok ? pkgInfo.detail : pkgInfo.detail}`);

  if (pkgInfo.ok) {
    console.log('\nDeployment steps (would execute):');
    for (const t of pkgInfo.targets) {
      console.log(`  1. Pull image: ${t.id}:<version>`);
      console.log(`  2. Apply k8s manifests for ${envId}`);
      console.log(`  3. Wait for rollout: kubectl rollout status deployment/${t.id}`);
      console.log(`  4. Health check: GET ${t.healthPath || '/health'}`);
    }
  }

  const allOk = envChecks.every(c => c.ok) && pkgInfo.ok;
  console.log(`\nReady to deploy: ${allOk ? 'YES' : 'NO (fix issues above)'}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(`
deploy.mjs — Deployment pipeline

Usage:
  node ops/deploy/scripts/deploy.mjs --env <env> [options]

Options:
  --env <env>       Target environment (dev|staging|prod) (required)
  --dry-run         Show deployment plan without executing
  --service <id>    Deploy a specific service (default: all)
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
    console.error(`[error] Environment "${opts.env}" not configured in ops/deploy/config.json`);
    return 1;
  }

  if (!envCfg.canDeploy) {
    console.error(`[error] Deployment to "${opts.env}" is disabled`);
    return 1;
  }

  const envChecks = validateEnvContract(opts.env);
  const pkgInfo = validatePackagingTarget();

  if (opts.dryRun) {
    printPlan(opts.env, envCfg, envChecks, pkgInfo, deployConfig);
    return 0;
  }

  const allOk = envChecks.every(c => c.ok) && pkgInfo.ok;
  if (!allOk) {
    console.error('[error] Pre-deployment checks failed. Run with --dry-run to see details.');
    return 1;
  }

  if (envCfg.requiresApproval) {
    console.log(`[info] Deployment to "${opts.env}" requires human approval.`);
    console.log('[info] Run with --dry-run to preview, then request approval.');
    return 0;
  }

  console.log(`[todo] Actual deployment to "${opts.env}" not yet implemented.`);
  console.log('[info] Use --dry-run to verify configuration readiness.');
  return 0;
}

main().then(code => process.exit(code));
