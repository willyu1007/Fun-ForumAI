#!/usr/bin/env node

import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import {
  validateCanonicalLaunchBuildProfile,
  validateDevOnlyStartupHardening,
  validateFrontendDeliveryAssets,
  REQUIRED_HOME_SHELF_ORDER,
  ROOT,
  validateLaunchMembershipBootstrapAssets,
  validateLaunchRuntimeContracts,
  validateLaunchWarmStartAssets,
  validateLaunchRuntimeOverlay,
  validatePackagingWireup,
  validatePublishWorkflowWireup,
  validateWorkerAssets,
} from './lib/launch-readiness.mjs';

const argv = process.argv.slice(2);
const ciMode = argv.includes('--ci');
const jsonMode = argv.includes('--json');
const stagingMode = argv.includes('--staging');

function readArg(name) {
  const index = argv.indexOf(`--${name}`);
  if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')) {
    return argv[index + 1];
  }
  return null;
}

const results = [];
let failCount = 0;

function pushResult(name, ok, detail, extra = {}) {
  results.push({
    name,
    ok,
    detail,
    ...extra,
  });
  if (!ok) failCount += 1;
  if (!jsonMode) {
    console.log(`  ${ok ? 'OK ' : 'ERR'} ${name}`);
    if (detail) {
      console.log(`     ${detail}`);
    }
  }
}

function runCommand(name, command) {
  try {
    execSync(command, {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 120_000,
      maxBuffer: 50 * 1024 * 1024,
    });
    pushResult(name, true, command, { command });
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? '';
    const stderr = error?.stderr?.toString?.() ?? '';
    const detail = `${command}\n${`${stdout}${stderr}`.trim().split('\n').slice(-4).join('\n')}`.trim();
    pushResult(name, false, detail, { command });
  }
}

async function fetchJson(url, input = {}) {
  const response = await fetch(url, input);
  const text = await response.text();
  const body = (() => {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return text;
    }
  })();
  return { status: response.status, body };
}

function normalizeBaseUrl(value) {
  return value ? value.replace(/\/+$/, '') : '';
}

function readLaunchCommunitySlugs() {
  const manifest = parseYaml(readFileSync(`${ROOT}/config/launch/manifest.v1.yaml`, 'utf8'));
  const communityRulesEntry = manifest?.contracts?.find?.((item) => item.id === 'community_rules');
  if (!communityRulesEntry?.path) {
    throw new Error('config/launch/manifest.v1.yaml is missing the community_rules contract');
  }
  const communityRules = parseYaml(readFileSync(`${ROOT}/${communityRulesEntry.path}`, 'utf8'));
  const communities = Array.isArray(communityRules?.communities) ? communityRules.communities : [];
  return communities
    .map((community) => community?.slug)
    .filter((slug) => typeof slug === 'string' && slug.length > 0);
}

function runRepoChecks() {
  const launchRegressionTests = [
    'scripts/ci/__tests__/check-image-launch-proof.test.ts',
    'src/backend/app.test.ts',
    'src/backend/launch/__tests__/programming-contracts.test.ts',
    'src/backend/services/__tests__/agent-community-membership-service.test.ts',
    'src/backend/routes/__tests__/e2e-dev-seed.test.ts',
    'ops/packaging/scripts/__tests__/frontend-build-profile.test.ts',
    'scripts/lib/__tests__/launch-readiness.test.ts',
    'src/frontend/features/forum/pages/__tests__/HomePage.test.tsx',
    'src/frontend/features/forum/pages/__tests__/HighlightsPage.test.tsx',
    'src/frontend/features/forum/pages/__tests__/PostDetailPage.test.tsx',
  ].filter((relativePath) => existsSync(`${ROOT}/${relativePath}`));

  const membershipCheck = validateLaunchMembershipBootstrapAssets();
  pushResult('Membership bootstrap assets', membershipCheck.ok, membershipCheck.detail);

  const warmStartCheck = validateLaunchWarmStartAssets();
  pushResult('Launch warm-start assets', warmStartCheck.ok, warmStartCheck.detail);

  const workerCheck = validateWorkerAssets();
  pushResult('Worker workload assets', workerCheck.ok, workerCheck.detail);

  const runtimeContractsCheck = validateLaunchRuntimeContracts();
  pushResult('Runtime launch contracts', runtimeContractsCheck.ok, runtimeContractsCheck.detail);

  const stagingOverlayCheck = validateLaunchRuntimeOverlay('env/values/staging-launch.yaml', 'staging');
  pushResult('Staging launch runtime overlay', stagingOverlayCheck.ok, stagingOverlayCheck.detail);

  const prodOverlayCheck = validateLaunchRuntimeOverlay('env/values/prod-launch.yaml', 'prod');
  pushResult('Prod launch runtime overlay', prodOverlayCheck.ok, prodOverlayCheck.detail);

  const canonicalProfileCheck = validateCanonicalLaunchBuildProfile();
  pushResult('Canonical launch frontend build profile', canonicalProfileCheck.ok, canonicalProfileCheck.detail);

  const frontendDeliveryCheck = validateFrontendDeliveryAssets();
  pushResult('Frontend dist delivery', frontendDeliveryCheck.ok, frontendDeliveryCheck.detail);

  const packagingCheck = validatePackagingWireup();
  pushResult('Packaging launch wireup', packagingCheck.ok, packagingCheck.detail);

  const publishWorkflowCheck = validatePublishWorkflowWireup();
  pushResult('Publish workflow launch wireup', publishWorkflowCheck.ok, publishWorkflowCheck.detail);

  const startupHardeningCheck = validateDevOnlyStartupHardening();
  pushResult('Dev-only startup hardening', startupHardeningCheck.ok, startupHardeningCheck.detail);

  runCommand(
    'Typecheck',
    'pnpm typecheck',
  );
  runCommand(
    'Lint',
    'pnpm lint',
  );
  runCommand(
    'Build',
    'pnpm build',
  );
  runCommand(
    'Packaging dry-run (canonical launch profile)',
    'node ops/packaging/scripts/build.mjs --dry-run --target llm-forum --build-profile launch',
  );

  if (launchRegressionTests.length > 0) {
    runCommand(
      'Launch regression tests',
      `node scripts/run-vitest.mjs run ${launchRegressionTests.join(' ')}`,
    );
  }

  runCommand(
    'Governance lint',
    'node .ai/scripts/ctl-project-governance.mjs lint --check --project main',
  );
}

async function runStagingChecks() {
  const webBaseUrl = normalizeBaseUrl(
    readArg('web-base-url') || process.env.LAUNCH_WEB_BASE_URL || '',
  );
  const workerBaseUrl = normalizeBaseUrl(
    readArg('worker-base-url') || process.env.LAUNCH_WORKER_BASE_URL || '',
  );
  const adminToken = readArg('admin-token') || process.env.LAUNCH_ADMIN_TOKEN || '';

  if (!webBaseUrl || !workerBaseUrl || !adminToken) {
    pushResult(
      'Staging launch inputs',
      false,
      'require --web-base-url, --worker-base-url, and --admin-token (or LAUNCH_WEB_BASE_URL / LAUNCH_WORKER_BASE_URL / LAUNCH_ADMIN_TOKEN)',
    );
    return;
  }

  const authHeaders = {
    Authorization: `Bearer ${adminToken}`,
  };

  const webHealth = await fetchJson(`${webBaseUrl}/health`);
  pushResult(
    'Web health',
    webHealth.status === 200 && webHealth.body?.ok === true,
    `status=${webHealth.status}`,
  );

  const workerHealth = await fetchJson(`${workerBaseUrl}/health`);
  pushResult(
    'Worker health',
    workerHealth.status === 200 && workerHealth.body?.ok === true,
    `status=${workerHealth.status}`,
  );

  const webRuntimeStats = await fetchJson(`${webBaseUrl}/v1/admin/runtime/stats`, {
    headers: authHeaders,
  });
  const webRuntime = webRuntimeStats.body?.data?.runtime ?? null;
  pushResult(
    'API runtime routing mode',
    webRuntimeStats.status === 200 && webRuntime?.routing_mode === 'policy_driven',
    webRuntimeStats.status === 200
      ? `routing_mode=${String(webRuntime?.routing_mode)}`
      : `status=${webRuntimeStats.status}`,
  );
  pushResult(
    'API env pins absent',
    webRuntimeStats.status === 200 && webRuntime?.authority_state?.env_pins_present !== true,
    webRuntimeStats.status === 200
      ? `env_pins_present=${String(webRuntime?.authority_state?.env_pins_present)}`
      : `status=${webRuntimeStats.status}`,
  );
  pushResult(
    'API debug signals absent',
    webRuntimeStats.status === 200 && webRuntime?.authority_state?.debug_signals_present !== true,
    webRuntimeStats.status === 200
      ? `debug_signals_present=${String(webRuntime?.authority_state?.debug_signals_present)}`
      : `status=${webRuntimeStats.status}`,
  );

  const runtimeStats = await fetchJson(`${workerBaseUrl}/v1/admin/runtime/stats`, {
    headers: authHeaders,
  });
  const workerRuntime = runtimeStats.body?.data?.runtime ?? null;
  const runtimeRunning = workerRuntime?.running === true;
  pushResult(
    'Worker runtime running',
    runtimeStats.status === 200 && runtimeRunning,
    runtimeStats.status === 200
      ? `running=${String(workerRuntime?.running)}`
      : `status=${runtimeStats.status}`,
  );
  pushResult(
    'Worker runtime routing mode',
    runtimeStats.status === 200 && workerRuntime?.routing_mode === 'policy_driven',
    runtimeStats.status === 200
      ? `routing_mode=${String(workerRuntime?.routing_mode)}`
      : `status=${runtimeStats.status}`,
  );
  pushResult(
    'Worker env pins absent',
    runtimeStats.status === 200 && workerRuntime?.authority_state?.env_pins_present !== true,
    runtimeStats.status === 200
      ? `env_pins_present=${String(workerRuntime?.authority_state?.env_pins_present)}`
      : `status=${runtimeStats.status}`,
  );
  pushResult(
    'Worker debug signals absent',
    runtimeStats.status === 200 && workerRuntime?.authority_state?.debug_signals_present !== true,
    runtimeStats.status === 200
      ? `debug_signals_present=${String(workerRuntime?.authority_state?.debug_signals_present)}`
      : `status=${runtimeStats.status}`,
  );

  const frontendFlags = await fetchJson(`${webBaseUrl}/frontend-build-flags.json`);
  const proofProfile = frontendFlags.body?.profile === 'launch';
  const homeFlag = frontendFlags.body?.frontend_flags?.VITE_FF_HOME_PROGRAMMING_V1 === 'true';
  const opsFlag = frontendFlags.body?.frontend_flags?.VITE_FF_PROGRAMMING_OPS_V1 === 'true';
  pushResult(
    'Launch frontend build proof',
    frontendFlags.status === 200 && proofProfile && homeFlag && opsFlag,
    frontendFlags.status === 200
      ? `profile=${String(frontendFlags.body?.profile)} home=${String(homeFlag)} programming_ops=${String(opsFlag)}`
      : `status=${frontendFlags.status}`,
  );

  const homeResponse = await fetchJson(`${webBaseUrl}/v1/home`);
  const homePayload = homeResponse.body?.data ?? null;
  const shelves = Array.isArray(homePayload?.shelves) ? homePayload.shelves : [];
  const shelfIds = shelves.map((shelf) => shelf.id);
  const shelvesById = new Map(shelves.map((shelf) => [shelf.id, shelf]));
  pushResult(
    'Launch home enabled',
    homeResponse.status === 200 && homePayload?.enabled === true,
    homeResponse.status === 200
      ? `enabled=${String(homePayload?.enabled)}`
      : `status=${homeResponse.status}`,
  );
  pushResult(
    'Launch shelf order',
    JSON.stringify(shelfIds) === JSON.stringify(REQUIRED_HOME_SHELF_ORDER),
    `actual=${JSON.stringify(shelfIds)}`,
  );
  pushResult(
    'must_watch_today non-empty',
    (shelvesById.get('must_watch_today')?.items?.length ?? 0) > 0,
    `count=${shelvesById.get('must_watch_today')?.items?.length ?? 0}`,
  );
  pushResult(
    'conflict_rising non-empty',
    (shelvesById.get('conflict_rising')?.items?.length ?? 0) > 0,
    `count=${shelvesById.get('conflict_rising')?.items?.length ?? 0}`,
  );
  pushResult(
    'notes_today threshold',
    (shelvesById.get('notes_today')?.items?.length ?? 0) >= 2,
    `count=${shelvesById.get('notes_today')?.items?.length ?? 0}`,
  );
  pushResult(
    'continue_storyline threshold',
    (shelvesById.get('continue_storyline')?.items?.length ?? 0) >= 2,
    `count=${shelvesById.get('continue_storyline')?.items?.length ?? 0}`,
  );
  pushResult(
    'tonight_programming non-empty',
    (shelvesById.get('tonight_programming')?.items?.length ?? 0) > 0,
    `count=${shelvesById.get('tonight_programming')?.items?.length ?? 0}`,
  );

  const launchCommunitySlugs = readLaunchCommunitySlugs();
  const communitiesResponse = await fetchJson(`${webBaseUrl}/v1/communities?limit=100`);
  const communities = Array.isArray(communitiesResponse.body?.data) ? communitiesResponse.body.data : [];
  const visibleCommunitySlugs = new Set(communities.map((community) => community?.slug).filter(Boolean));
  const missingLaunchCommunities = launchCommunitySlugs.filter((slug) => !visibleCommunitySlugs.has(slug));
  pushResult(
    'Launch community catalog completeness',
    communitiesResponse.status === 200 && missingLaunchCommunities.length === 0,
    communitiesResponse.status === 200
      ? `missing=${missingLaunchCommunities.join(', ') || 'none'}`
      : `status=${communitiesResponse.status}`,
  );

  const occupancyFailures = [];
  for (const slug of launchCommunitySlugs) {
    const community = communities.find((item) => item?.slug === slug);
    if (!community?.id) {
      occupancyFailures.push(`${slug}:missing-community`);
      continue;
    }
    const feedResponse = await fetchJson(`${webBaseUrl}/v1/feed?community_id=${encodeURIComponent(community.id)}&limit=1`);
    // `/v1/feed` returns `data: PostWithMeta[]` with pagination on `meta.cursor`.
    const itemCount = Array.isArray(feedResponse.body?.data) ? feedResponse.body.data.length : 0;
    if (feedResponse.status !== 200 || itemCount < 1) {
      occupancyFailures.push(`${slug}:${feedResponse.status}:${itemCount}`);
    }
  }
  pushResult(
    'Launch community occupancy',
    occupancyFailures.length === 0,
    occupancyFailures.length === 0
      ? `${launchCommunitySlugs.length}/${launchCommunitySlugs.length} communities have visible root posts`
      : occupancyFailures.join(', '),
  );

  try {
    execFileSync(process.execPath, [
      'scripts/launch-home-playwright-smoke.mjs',
      '--url',
      webBaseUrl,
    ], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    pushResult(
      'Launch home browser smoke',
      true,
      `${webBaseUrl}/ renders Home Programming`,
    );
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? '';
    const stderr = error?.stderr?.toString?.() ?? '';
    pushResult(
      'Launch home browser smoke',
      false,
      `${stdout}${stderr}`.trim() || 'browser smoke failed',
    );
  }
}

async function main() {
  if (!jsonMode) {
    console.log('');
    console.log(stagingMode ? 'Launch Readiness v2 — staging live gate' : 'Launch Readiness v2 — repo gate');
    console.log('');
  }

  if (stagingMode) {
    await runStagingChecks();
  } else {
    runRepoChecks();
  }

  const summary = {
    total: results.length,
    pass: results.length - failCount,
    fail: failCount,
  };

  if (jsonMode) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      mode: stagingMode ? 'staging' : 'repo',
      summary,
      checks: results,
    }, null, 2));
  } else {
    console.log('');
    console.log(`Result: ${summary.pass}/${summary.total} passed, ${summary.fail} failed`);
    console.log('');
  }

  process.exit(ciMode && failCount > 0 ? 1 : failCount > 0 ? 1 : 0);
}

main();
