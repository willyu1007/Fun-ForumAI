#!/usr/bin/env node
/**
 * rollback.mjs — Provider-agnostic rollback entry.
 *
 * Validates rollback prerequisites and either prints a dry-run plan
 * or executes the rollback procedure.
 *
 * Usage:
 *   node ops/deploy/scripts/rollback.mjs --env <env> [--dry-run] [--to <revision>]
 */

import {
  parseArgs,
  loadJSON,
  validatePackagingTarget,
  resolveServices,
  resolveK8sTarget,
  listMissingFields,
  formatKubectlBaseArgs,
  runCommand,
  checkHealth,
} from './_shared.mjs';

function normalizeRevision(rawValue) {
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== trimmed) {
    throw new Error('--to must be a positive rollout revision number.');
  }
  return parsed;
}

function printPlan(envId, deployConfig, servicePlans, revision) {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║         ROLLBACK DRY-RUN PLAN            ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`Environment:   ${envId}`);
  console.log(`Rollback to:   ${revision ? `revision ${revision}` : 'previous revision'}`);
  console.log(`Model:         ${deployConfig.model}`);

  console.log('\nRollback steps (would execute):');
  for (const { service, target, missingFields } of servicePlans) {
    console.log(`\nService: ${service.id}`);
    console.log(`  namespace:  ${target.namespace ?? '<missing>'}`);
    console.log(`  deployment: ${target.deployment ?? '<missing>'}`);
    console.log(`  health:     ${target.healthUrl ?? '[skipped] provide --health-url to execute health checks'}`);
    if (revision) {
      console.log(`  1. kubectl ${formatKubectlBaseArgs(target).join(' ')} rollout undo deployment/${target.deployment ?? '<deployment>'} --to-revision=${revision}`);
    } else {
      console.log(`  1. kubectl ${formatKubectlBaseArgs(target).join(' ')} rollout undo deployment/${target.deployment ?? '<deployment>'}`);
    }
    console.log(`  2. kubectl ${formatKubectlBaseArgs(target).join(' ')} rollout status deployment/${target.deployment ?? '<deployment>'} --timeout=${target.timeoutSec}s`);
    if (target.healthUrl) {
      console.log(`  3. GET ${target.healthUrl}`);
    }
    if (missingFields.length > 0) {
      console.log(`  missing:    ${missingFields.join(', ')}`);
    }
  }

  console.log('\nPre-rollback checklist:');
  console.log('  ✓ Confirm current version is broken or needs reverting');
  console.log('  ✓ Notify on-call / stakeholders');
  console.log('  ✓ Check DB migration compatibility (no destructive migrations since target)');

  const ready = servicePlans.every((plan) => plan.missingFields.length === 0);
  console.log(`\nReady to rollback: ${ready ? 'YES' : 'NO (fix issues above)'}`);
}

async function rollbackService(service, target, revision) {
  const kubectlBaseArgs = formatKubectlBaseArgs(target);
  const rollbackArgs = [
    ...kubectlBaseArgs,
    'rollout',
    'undo',
    `deployment/${target.deployment}`,
  ];
  if (revision) {
    rollbackArgs.push(`--to-revision=${revision}`);
  }

  console.log(
    `[exec] ${service.id}: rollback ${revision ? `to revision ${revision}` : 'to previous revision'}`,
  );
  runCommand('kubectl', rollbackArgs);

  console.log(`[exec] ${service.id}: waiting for rollout`);
  runCommand('kubectl', [
    ...kubectlBaseArgs,
    'rollout',
    'status',
    `deployment/${target.deployment}`,
    `--timeout=${target.timeoutSec}s`,
  ]);

  if (!target.healthUrl) {
    console.log(`[warn] ${service.id}: health check skipped (no --health-url / DEPLOY_HEALTH_URL)`);
    return;
  }

  console.log(`[exec] ${service.id}: checking health -> ${target.healthUrl}`);
  const health = await checkHealth(target.healthUrl, target.healthTimeoutMs);
  if (!health.ok) {
    throw new Error(
      `${service.id} health check failed after rollback: ${health.error || `status ${health.status}`}`,
    );
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(`
rollback.mjs — Deployment rollback

Usage:
  node ops/deploy/scripts/rollback.mjs --env <env> [options]

Options:
  --env <env>              Target environment (required)
  --to <revision>          Specific rollout revision to roll back to
  --dry-run                Show rollback plan without executing
  --service <id>           Roll back a specific service (default: all)
  --context <name>         Optional kubectl context override
  --namespace <name>       Optional k8s namespace override
  --deployment <name>      Optional deployment name override
  --health-url <url>       Optional health endpoint for post-rollback verification
  --timeout-sec <sec>      Rollout timeout in seconds (default: 120)
  --health-timeout-ms <ms> Health check timeout in milliseconds (default: 5000)
  --help                   Show this help
`);
    return 0;
  }

  if (!opts.env) {
    console.error('[error] --env is required. Use --help for usage.');
    return 1;
  }

  let revision;
  try {
    revision = normalizeRevision(opts.to);
  } catch (err) {
    console.error(`[error] ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  const deployConfig = loadJSON('ops/deploy/config.json');
  if (!deployConfig) {
    console.error('[error] ops/deploy/config.json not found');
    return 1;
  }

  if (deployConfig.model !== 'k8s') {
    console.error(`[error] Actual rollback is only implemented for model="k8s" (found "${deployConfig.model}")`);
    return 1;
  }

  const envCfg = deployConfig.environments.find((env) => env.id === opts.env);
  if (!envCfg) {
    console.error(`[error] Environment "${opts.env}" not configured`);
    return 1;
  }

  const pkgInfo = validatePackagingTarget();
  const serviceInfo = resolveServices(deployConfig, pkgInfo, opts.service);
  if (serviceInfo.error) {
    console.error(`[error] ${serviceInfo.error}`);
    return 1;
  }

  const servicePlans = serviceInfo.services.map((service) => {
    const target = resolveK8sTarget(service, opts);
    const missingFields = listMissingFields(target, ['namespace', 'deployment']);
    return { service, target, missingFields };
  });

  if (opts['dry-run']) {
    printPlan(opts.env, deployConfig, servicePlans, revision);
    return 0;
  }

  const missingForExecution = servicePlans.filter((plan) => plan.missingFields.length > 0);
  if (missingForExecution.length > 0) {
    for (const plan of missingForExecution) {
      console.error(
        `[error] Service "${plan.service.id}" is missing execution inputs: ${plan.missingFields.join(', ')}`,
      );
    }
    console.error('[error] Provide the missing CLI flags or set them in ops/deploy/config.json / environment variables.');
    return 1;
  }

  if (envCfg.requiresApproval) {
    console.log(`[info] Rollback on "${opts.env}" requires human approval.`);
    console.log('[info] Run with --dry-run to preview the rollback plan, then request approval before executing.');
    return 0;
  }

  for (const { service, target } of servicePlans) {
    await rollbackService(service, target, revision);
  }

  console.log(`[ok] Rollback on "${opts.env}" completed successfully.`);
  return 0;
}

main().then((code) => process.exit(code));
