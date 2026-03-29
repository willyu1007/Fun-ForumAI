#!/usr/bin/env node
/**
 * rollback.mjs — ECS host rollback planner.
 *
 * This script validates repo-side rollback metadata and prints the exact
 * host-side command that a human operator must execute on the target ECS host.
 * It does not roll back remotely.
 */

import {
  parseArgs,
  loadJSON,
  loadEnvironmentConfig,
  validateEnvContract,
  validatePackagingTarget,
  resolveServices,
  resolveVmTarget,
  listMissingVmFields,
  validateImmutableImageRef,
  quoteShell,
} from './_shared.mjs';

function renderRollbackCommand(target, explicitImageRef, dbPlan, notes) {
  const envPrefix = [
    `${target.pullUsernameEnv}=<readonly-user>`,
    `${target.pullPasswordEnv}=<readonly-password>`,
  ];

  const args = [`./${target.rollbackScript}`];
  if (explicitImageRef) {
    args.push('--to-image-ref', quoteShell(explicitImageRef));
  }
  if (dbPlan) args.push('--db-plan', quoteShell(dbPlan));
  if (notes) args.push('--notes', quoteShell(notes));

  return `cd ${quoteShell(target.appDir)} && ${envPrefix.join(' ')} ${args.join(' ')}`;
}

function printPlan(envId, envCfg, envFile, envChecks, servicePlans, explicitImageRef, dbPlan, notes, deployConfig) {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║       ECS ROLLBACK PLAN (VM)             ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`Environment:   ${envId}`);
  console.log(`Model:         ${deployConfig.model} (${deployConfig.vm?.runtime || 'docker-compose'})`);
  console.log(`Approval:      ${envCfg?.requiresApproval ? 'REQUIRED' : 'not required'}`);
  if (envFile?.current_topology) {
    console.log(`Topology:      ${envFile.current_topology}`);
  }

  console.log('\nRepo-side checks:');
  for (const check of envChecks) {
    console.log(`  ${check.ok ? '✓' : '✗'} ${check.name} — ${check.detail}`);
  }

  console.log('\nHost-side rollback contract:');
  for (const { service, target, issues } of servicePlans) {
    console.log(`\nService: ${service.id}`);
    console.log(`  app dir:         ${target.appDir ?? '<missing>'}`);
    console.log(`  compose file:    ${target.composeFile ?? '<missing>'}`);
    console.log(`  release state:   ${target.releaseStateDir ? `${target.appDir}/${target.releaseStateDir}` : '<missing>'}`);
    console.log(`  shared proxy:    ${target.sharedProxyDir ?? '<missing>'}`);
    console.log(`  health url:      ${target.healthUrl ?? '<missing>'}`);
    console.log(`  rollback target: ${explicitImageRef ?? 'previous entry in releases/history.jsonl'}`);
    console.log(`  db recovery:     ${dbPlan ? dbPlan : 'not supplied (required only when current release is incompatible)'}`);
    console.log(`  pull creds env:  ${target.pullUsernameEnv}, ${target.pullPasswordEnv}`);
    console.log('  host command:');
    console.log(`    ${renderRollbackCommand(target, explicitImageRef, dbPlan, notes)}`);
    console.log('  fixed sequence:');
    console.log('    1. inspect releases/current.json and releases/history.jsonl');
    console.log('    2. refuse image-only rollback when current db_compat=incompatible and --db-plan is missing');
    console.log('    3. docker login with read-only ACR credentials');
    console.log('    4. docker compose pull web');
    console.log('    5. docker compose up -d --no-deps web');
    console.log(`    6. curl ${target.healthUrl ?? 'http://127.0.0.1:<loopback>/health'}`);
    console.log(`    7. ./${target.smokeScript ?? 'smoke.sh'}`);
    console.log('    8. append the rollback result to releases/history.jsonl');
    if (issues.length > 0) {
      console.log(`  issues:          ${issues.join(', ')}`);
    }
  }

  const allChecksPassed = envChecks.every((check) => check.ok);
  const allPlansReady = servicePlans.every((plan) => plan.issues.length === 0);
  console.log(`\nReady to hand off to operator: ${allChecksPassed && allPlansReady ? 'YES' : 'NO (fix issues above)'}`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(`
rollback.mjs — ECS host rollback planner

Usage:
  node ops/deploy/scripts/rollback.mjs --env <env> [options]

Options:
  --env <env>                 Target environment (staging|prod) (required)
  --dry-run                   Print the plan only (default behavior)
  --service <id>              Limit planning to one service
  --to-image-ref <repo:tag>   Optional explicit immutable image reference
  --db-plan <ticket>          Required only when the current host release is marked incompatible
  --notes <text>              Optional rollback notes
  --help                      Show this help
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

  if (deployConfig.model !== 'vm') {
    console.error(`[error] Expected ops/deploy/config.json model="vm" for ECS host planning (found "${deployConfig.model}")`);
    return 1;
  }

  const envCfg = deployConfig.environments.find((env) => env.id === opts.env);
  if (!envCfg) {
    console.error(`[error] Environment "${opts.env}" not configured in ops/deploy/config.json`);
    return 1;
  }
  if (!envCfg.canDeploy) {
    console.error(`[error] Environment "${opts.env}" is not handled by the VM/Compose rollback planner.`);
    return 1;
  }

  let explicitImageRef = null;
  try {
    if (opts['to-image-ref']) {
      explicitImageRef = validateImmutableImageRef(opts['to-image-ref'], '--to-image-ref');
    }
  } catch (err) {
    console.error(`[error] ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  const dbPlan = typeof opts['db-plan'] === 'string' ? opts['db-plan'].trim() : '';
  const notes = typeof opts.notes === 'string' ? opts.notes.trim() : '';

  const envChecks = validateEnvContract(opts.env);
  const envFile = loadEnvironmentConfig(opts.env);
  const pkgInfo = validatePackagingTarget();
  const serviceInfo = resolveServices(deployConfig, pkgInfo, opts.service);
  if (serviceInfo.error) {
    console.error(`[error] ${serviceInfo.error}`);
    return 1;
  }
  if (serviceInfo.missingPackagingTargets.length > 0) {
    console.error(
      `[error] Missing packaging target(s): ${serviceInfo.missingPackagingTargets.join(', ')}`,
    );
    return 1;
  }

  let servicePlans;
  try {
    servicePlans = serviceInfo.services.map((service) => {
      const target = resolveVmTarget(service, {});
      const issues = listMissingVmFields({
        ...target,
        imageMode: 'image-ref',
        imageRef: explicitImageRef ?? 'history-driven',
        dbCompat: target.dbCompat ?? 'backwards',
      }).filter((issue) => issue !== '--image-ref or --sha' && issue !== target.imageRepositoryEnv);
      return { service, target, issues };
    });
  } catch (err) {
    console.error(`[error] ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  printPlan(opts.env, envCfg, envFile, envChecks, servicePlans, explicitImageRef, dbPlan, notes, deployConfig);

  if (!opts['dry-run']) {
    console.log('\n[info] This script plans the rollback only. A human operator must execute rollback.sh on the target ECS host.');
  }

  return 0;
}

process.exit(main());
