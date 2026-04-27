#!/usr/bin/env node
/**
 * deploy.mjs — ECS host deployment planner.
 *
 * This script validates repo-side deployment metadata and prints the exact
 * host-side command that a human operator must execute on the target ECS host.
 * It does not deploy remotely.
 */

import {
  loadReleaseIntent,
  loadVmPlanningContext,
  resolveVmTarget,
  listMissingVmFields,
  printVmReadiness,
  resolveVmPlannerOptions,
  quoteShell,
} from './_shared.mjs';

const HELP_TEXT = `
deploy.mjs — ECS host deployment planner

Usage:
  node ops/deploy/scripts/deploy.mjs --env <env> [options]

Options:
  --env <env>              Target environment (staging|prod) (required)
  --dry-run                Print the plan only (default behavior)
  --service <id>           Limit planning to one service
  --image-ref <repo:tag>   Immutable image reference (must use sha-<commit>)
  --sha <commit-sha>       40-character commit SHA (host resolves via ACR_IMAGE_REPOSITORY)
  --with-migrate           Include the one-shot migrate container in the plan
  --db-compat <mode>       backwards | incompatible
  --db-plan <ticket>       Required when --db-compat incompatible
  --notes <text>           Optional release notes written into the release record
  (no image args)          If ops/deploy/release-intents/<env>/desired.json exists, use its image_ref
  --help                   Show this help
`;

function renderDeployCommand(target) {
  const envPrefix = [
    `${target.pullUsernameEnv}=<readonly-user>`,
    `${target.pullPasswordEnv}=<readonly-password>`,
  ];
  if (target.imageMode === 'sha') {
    envPrefix.push(`${target.imageRepositoryEnv}=<acr-login-server>/<namespace>/app`);
  }

  const args = [`./${target.deployScript}`];
  if (target.imageMode === 'image-ref') {
    args.push('--image-ref', quoteShell(target.imageRef));
  } else if (target.imageMode === 'sha') {
    args.push('--sha', quoteShell(target.commitSha));
  } else {
    args.push('--image-ref', quoteShell('<acr-login-server>/<namespace>/app:sha-<commit>'));
  }
  if (target.withMigrate) args.push('--with-migrate');
  args.push('--db-compat', quoteShell(target.dbCompat ?? 'backwards'));
  if (target.dbPlan) args.push('--db-plan', quoteShell(target.dbPlan));
  if (target.notes) args.push('--notes', quoteShell(target.notes));

  return `cd ${quoteShell(target.appDir)} && ${envPrefix.join(' ')} ${args.join(' ')}`;
}

function printPlan(envId, envCfg, envFile, envChecks, servicePlans, deployConfig, releaseIntent) {
  const stagingWorkerProfile = envId === 'staging';
  const composePrefix = stagingWorkerProfile
    ? 'docker compose --profile staging-same-host-worker'
    : 'docker compose';
  const runtimeServices = stagingWorkerProfile ? 'web worker' : 'web';
  const pullServices = stagingWorkerProfile ? 'web worker migrate' : 'web migrate';

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║       ECS DEPLOYMENT PLAN (VM)           ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`Environment:   ${envId}`);
  console.log(`Model:         ${deployConfig.model} (${deployConfig.vm?.runtime || 'docker-compose'})`);
  console.log(`Approval:      ${envCfg?.requiresApproval ? 'REQUIRED' : 'not required'}`);
  if (envFile?.current_topology) {
    console.log(`Topology:      ${envFile.current_topology}`);
  }
  if (envFile?.entrypoint) {
    console.log(`Entry:         ${envFile.entrypoint}`);
  }
  if (envFile?.rollout_strategy) {
    console.log(`Rollout:       ${envFile.rollout_strategy}`);
  }

  if (releaseIntent) {
    console.log('\nDesired release intent:');
    console.log(`  image ref:    ${releaseIntent.image_ref}`);
    console.log(`  git sha:      ${releaseIntent.git_sha}`);
    console.log(`  status:       ${releaseIntent.status}`);
    console.log(`  approved at:  ${releaseIntent.approved_at ?? '<missing>'}`);
    console.log(`  approved by:  ${releaseIntent.approved_by ?? '<missing>'}`);
    const targetSummaries = Object.entries(releaseIntent.targets ?? {})
      .map(([targetId, targetState]) => `${targetId}=${targetState?.status ?? 'pending'}`);
    console.log(`  targets:      ${targetSummaries.length > 0 ? targetSummaries.join(', ') : '<missing>'}`);
  }

  console.log('\nRepo-side checks:');
  for (const check of envChecks) {
    console.log(`  ${check.ok ? '✓' : '✗'} ${check.name} — ${check.detail}`);
  }

  console.log('\nHost-side execution contract:');
  for (const { service, target, issues } of servicePlans) {
    console.log(`\nService: ${service.id}`);
    console.log(`  app dir:         ${target.appDir ?? '<missing>'}`);
    console.log(`  compose file:    ${target.composeFile ?? '<missing>'}`);
    console.log(`  release state:   ${target.releaseStateDir ? `${target.appDir}/${target.releaseStateDir}` : '<missing>'}`);
    console.log(`  shared proxy:    ${target.sharedProxyDir ?? '<missing>'}`);
    console.log(`  loopback:        127.0.0.1:${target.loopbackPort} -> container:${target.containerPort}`);
    console.log(`  health url:      ${target.healthUrl ?? '<missing>'}`);
    console.log(`  image selector:  ${target.imageMode === 'image-ref'
      ? target.imageRef
      : target.imageMode === 'sha'
        ? `sha-${target.commitSha}`
        : '<missing>'}`);
    console.log(`  db compat:       ${target.dbCompat ?? '<missing>'}`);
    console.log(`  run migrate:     ${target.withMigrate ? 'yes' : 'no'}`);
    console.log(`  pull creds env:  ${target.pullUsernameEnv}, ${target.pullPasswordEnv}`);
    if (target.imageMode === 'sha') {
      console.log(`  image repo env:  ${target.imageRepositoryEnv}`);
    }
    console.log('  host command:');
    console.log(`    ${renderDeployCommand(target)}`);
    console.log('  fixed sequence:');
    console.log('    1. validate files/env');
    console.log('    2. docker login with read-only ACR credentials');
    console.log(`    3. ${composePrefix} pull ${pullServices}`);
    console.log(`    4. ${target.withMigrate ? `${composePrefix} run --rm migrate` : 'skip migrate step'}`);
    console.log(`    5. ${composePrefix} up -d --no-deps ${runtimeServices}`);
    console.log(`    6. curl ${target.healthUrl ?? 'http://127.0.0.1:<loopback>/health'}`);
    console.log(`    7. ./${target.smokeScript ?? 'smoke.sh'}`);
    console.log('    8. write releases/current.json and releases/history.jsonl');
    if (issues.length > 0) {
      console.log(`  issues:          ${issues.join(', ')}`);
    }
  }

  printVmReadiness(envChecks, servicePlans);
}

function main() {
  const { opts, exitCode } = resolveVmPlannerOptions(process.argv.slice(2), HELP_TEXT);
  if (exitCode !== null) return exitCode;

  let context;
  try {
    context = loadVmPlanningContext(opts.env, opts.service, 'deploy');
  } catch (err) {
    console.error(`[error] ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  const { deployConfig, envCfg, envChecks, envFile, serviceInfo } = context;
  const releaseIntent = !opts['image-ref'] && !opts.sha ? loadReleaseIntent(opts.env) : null;

  let servicePlans;
  try {
    const effectiveOpts = releaseIntent
      ? {
          ...opts,
          'image-ref': releaseIntent.image_ref,
          'db-compat': opts['db-compat'] ?? releaseIntent.db_compat,
          'db-plan': opts['db-plan'] ?? releaseIntent.db_plan,
          notes: opts.notes ?? releaseIntent.notes,
        }
      : opts;
    servicePlans = serviceInfo.services.map((service) => {
      const target = resolveVmTarget(service, effectiveOpts);
      const issues = listMissingVmFields(target);
      if (opts.env === 'staging' && !target.withMigrate) {
        issues.push('staging requires --with-migrate');
      }
      if (target.dbCompat === 'incompatible' && !target.dbPlan) {
        issues.push('--db-plan (required when --db-compat incompatible)');
      }
      return { service, target, issues };
    });
  } catch (err) {
    console.error(`[error] ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  printPlan(opts.env, envCfg, envFile, envChecks, servicePlans, deployConfig, releaseIntent);

  if (!opts['dry-run']) {
    console.log('\n[info] This script plans the rollout only. A human operator must execute deploy.sh on the target ECS host.');
  }

  return 0;
}

process.exit(main());
