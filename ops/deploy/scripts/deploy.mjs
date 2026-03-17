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

import {
  parseArgs,
  loadJSON,
  validateEnvContract,
  validatePackagingTarget,
  resolveServices,
  resolveK8sTarget,
  buildImagePlan,
  listMissingFields,
  formatKubectlBaseArgs,
  runCommand,
  checkHealth,
} from './_shared.mjs';

function printPlan(envId, envCfg, envChecks, servicePlans, deployConfig, pkgInfo) {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        DEPLOYMENT DRY-RUN PLAN           ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`Environment:  ${envId}`);
  console.log(`Model:        ${deployConfig.model} (${deployConfig.k8s?.tool || 'N/A'})`);
  console.log(`Approval:     ${envCfg?.requiresApproval ? 'REQUIRED' : 'not required'}`);

  console.log('\nEnvironment contract checks:');
  for (const check of envChecks) {
    console.log(`  ${check.ok ? '✓' : '✗'} ${check.name} — ${check.detail}`);
  }

  console.log(`\nPackaging targets: ${pkgInfo.ok ? pkgInfo.detail : pkgInfo.detail}`);

  console.log('\nDeployment steps (would execute):');
  for (const { service, target, missingFields } of servicePlans) {
    console.log(`\nService: ${service.id}`);
    console.log(`  namespace:  ${target.namespace ?? '<missing>'}`);
    console.log(`  deployment: ${target.deployment ?? '<missing>'}`);
    console.log(`  container:  ${target.container ?? '<missing>'}`);
    console.log(`  image:      ${buildImagePlan(target)}`);
    console.log(`  health:     ${target.healthUrl ?? '[skipped] provide --health-url to execute health checks'}`);
    console.log(`  1. kubectl ${formatKubectlBaseArgs(target).join(' ')} set image deployment/${target.deployment ?? '<deployment>'} ${target.container ?? '<container>'}=${buildImagePlan(target)}`);
    console.log(`  2. kubectl ${formatKubectlBaseArgs(target).join(' ')} rollout status deployment/${target.deployment ?? '<deployment>'} --timeout=${target.timeoutSec}s`);
    if (target.healthUrl) {
      console.log(`  3. GET ${target.healthUrl}`);
    }
    if (missingFields.length > 0) {
      console.log(`  missing:    ${missingFields.join(', ')}`);
    }
  }

  const allOk = envChecks.every((check) => check.ok) && servicePlans.every((plan) => plan.missingFields.length === 0);
  console.log(`\nReady to deploy: ${allOk ? 'YES' : 'NO (fix issues above)'}`);
}

async function deployService(service, target) {
  const kubectlBaseArgs = formatKubectlBaseArgs(target);

  console.log(`[exec] ${service.id}: set image -> ${target.imageRef}`);
  runCommand('kubectl', [
    ...kubectlBaseArgs,
    'set',
    'image',
    `deployment/${target.deployment}`,
    `${target.container}=${target.imageRef}`,
  ]);

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
      `${service.id} health check failed: ${health.error || `status ${health.status}`}`,
    );
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(`
deploy.mjs — Deployment pipeline

Usage:
  node ops/deploy/scripts/deploy.mjs --env <env> [options]

Options:
  --env <env>             Target environment (dev|staging|prod) (required)
  --dry-run               Show deployment plan without executing
  --service <id>          Deploy a specific service (default: all)
  --context <name>        Optional kubectl context override
  --namespace <name>      Optional k8s namespace override
  --deployment <name>     Optional deployment name override
  --container <name>      Optional container name override
  --image-ref <repo:tag>  Full image reference to deploy
  --image-repo <repo>     Image repository (combine with --tag)
  --tag <tag>             Image tag (combine with --image-repo or service k8s.imageRepo)
  --health-url <url>      Optional health endpoint for post-rollout verification
  --timeout-sec <sec>     Rollout timeout in seconds (default: 120)
  --health-timeout-ms <ms> Health check timeout in milliseconds (default: 5000)
  --help                  Show this help
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

  if (deployConfig.model !== 'k8s') {
    console.error(`[error] Actual deployment is only implemented for model="k8s" (found "${deployConfig.model}")`);
    return 1;
  }

  const envCfg = deployConfig.environments.find((env) => env.id === opts.env);
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

  const servicePlans = serviceInfo.services.map((service) => {
    const target = resolveK8sTarget(service, opts);
    const missingFields = listMissingFields(target, [
      'namespace',
      'deployment',
      'container',
      'imageRef',
    ]);
    return { service, target, missingFields };
  });

  if (opts['dry-run']) {
    printPlan(opts.env, envCfg, envChecks, servicePlans, deployConfig, pkgInfo);
    return 0;
  }

  const allChecksPassed = envChecks.every((check) => check.ok);
  if (!allChecksPassed) {
    console.error('[error] Pre-deployment checks failed. Run with --dry-run to see details.');
    return 1;
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
    console.log(`[info] Deployment to "${opts.env}" requires human approval.`);
    console.log('[info] Run with --dry-run to preview, then request approval before executing.');
    return 0;
  }

  for (const { service, target } of servicePlans) {
    await deployService(service, target);
  }

  console.log(`[ok] Deployment to "${opts.env}" completed successfully.`);
  return 0;
}

main().then((code) => process.exit(code));
