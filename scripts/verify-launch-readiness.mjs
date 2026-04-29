#!/usr/bin/env node

import { execFileSync, execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import {
  validateCanonicalLaunchBuildProfile,
  validateDevOnlyStartupHardening,
  validateFrontendDeliveryAssets,
  REQUIRED_HOME_SHELF_ORDER,
  ROOT,
  validateLaunchMembershipBootstrapAssets,
  validateLaunchRuntimeContracts,
  validateKickoffAssets,
  validateLaunchRuntimeOverlay,
  validatePackagingWireup,
  validatePublishWorkflowWireup,
  validateStrictSemanticConvergence,
  validateWorkerAssets,
} from './lib/launch-readiness.mjs'

const argv = process.argv.slice(2)
const ciMode = argv.includes('--ci')
const jsonMode = argv.includes('--json')
const stagingMode = argv.includes('--staging')

function readArg(name) {
  const index = argv.indexOf(`--${name}`)
  if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')) {
    return argv[index + 1]
  }
  return null
}

const results = []
let failCount = 0
let lastPrintedGroup = null

function pushResult(group, name, ok, detail, extra = {}) {
  results.push({
    group,
    name,
    ok,
    detail,
    ...extra,
  })
  if (!ok) failCount += 1
  if (!jsonMode) {
    if (group !== lastPrintedGroup) {
      if (lastPrintedGroup !== null) {
        console.log('')
      }
      console.log(`[${group}]`)
      lastPrintedGroup = group
    }
    console.log(`  ${ok ? 'OK ' : 'ERR'} ${name}`)
    if (detail) {
      console.log(`     ${detail}`)
    }
  }
}

function runCommand(group, name, command) {
  try {
    execSync(command, {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 120_000,
      maxBuffer: 50 * 1024 * 1024,
    })
    pushResult(group, name, true, command, { command })
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? ''
    const stderr = error?.stderr?.toString?.() ?? ''
    const detail =
      `${command}\n${`${stdout}${stderr}`.trim().split('\n').slice(-4).join('\n')}`.trim()
    pushResult(group, name, false, detail, { command })
  }
}

function runNodeScriptCheck(group, name, filePath, args, options = {}) {
  const { env = {} } = options
  try {
    const output = execFileSync('node', [filePath, ...args], {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 120_000,
      maxBuffer: 50 * 1024 * 1024,
      env: {
        ...process.env,
        ...env,
      },
    }).toString()
    pushResult(group, name, true, output.trim())
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? ''
    const stderr = error?.stderr?.toString?.() ?? ''
    const detail = `${stdout}${stderr}`.trim() || `node ${filePath} failed`
    pushResult(group, name, false, detail)
  }
}

async function fetchJson(url, input = {}) {
  const response = await fetch(url, input)
  const text = await response.text()
  const body = (() => {
    try {
      return text ? JSON.parse(text) : null
    } catch {
      return text
    }
  })()
  return { status: response.status, body }
}

function normalizeBaseUrl(value) {
  return value ? value.replace(/\/+$/, '') : ''
}

function readLaunchCommunitySlugs() {
  const manifest = parseYaml(readFileSync(`${ROOT}/config/launch/manifest.v1.yaml`, 'utf8'))
  const communityRulesEntry = manifest?.contracts?.find?.((item) => item.id === 'community_rules')
  if (!communityRulesEntry?.path) {
    throw new Error('config/launch/manifest.v1.yaml is missing the community_rules contract')
  }
  const communityRules = parseYaml(readFileSync(`${ROOT}/${communityRulesEntry.path}`, 'utf8'))
  const communities = Array.isArray(communityRules?.communities) ? communityRules.communities : []
  return communities
    .map((community) => community?.slug)
    .filter((slug) => typeof slug === 'string' && slug.length > 0)
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
  ].filter((relativePath) => existsSync(`${ROOT}/${relativePath}`))

  const membershipCheck = validateLaunchMembershipBootstrapAssets()
  pushResult('Contract', 'Membership bootstrap assets', membershipCheck.ok, membershipCheck.detail)

  const warmStartCheck = validateKickoffAssets()
  pushResult('Contract', 'Launch kickoff assets', warmStartCheck.ok, warmStartCheck.detail)

  const workerCheck = validateWorkerAssets()
  pushResult('Contract', 'Worker workload assets', workerCheck.ok, workerCheck.detail)

  const runtimeContractsCheck = validateLaunchRuntimeContracts()
  pushResult(
    'Contract',
    'Runtime launch contracts',
    runtimeContractsCheck.ok,
    runtimeContractsCheck.detail,
  )

  const stagingOverlayCheck = validateLaunchRuntimeOverlay(
    'env/values/staging-launch.yaml',
    'staging',
  )
  pushResult(
    'Contract',
    'Staging launch runtime overlay',
    stagingOverlayCheck.ok,
    stagingOverlayCheck.detail,
  )

  const prodOverlayCheck = validateLaunchRuntimeOverlay('env/values/prod-launch.yaml', 'prod')
  pushResult(
    'Contract',
    'Prod launch runtime overlay',
    prodOverlayCheck.ok,
    prodOverlayCheck.detail,
  )

  const canonicalProfileCheck = validateCanonicalLaunchBuildProfile()
  pushResult(
    'Contract',
    'Canonical launch frontend build profile',
    canonicalProfileCheck.ok,
    canonicalProfileCheck.detail,
  )

  const frontendDeliveryCheck = validateFrontendDeliveryAssets()
  pushResult(
    'Environment/Release',
    'Frontend dist delivery',
    frontendDeliveryCheck.ok,
    frontendDeliveryCheck.detail,
  )

  const packagingCheck = validatePackagingWireup()
  pushResult(
    'Environment/Release',
    'Packaging launch wireup',
    packagingCheck.ok,
    packagingCheck.detail,
  )

  const publishWorkflowCheck = validatePublishWorkflowWireup()
  pushResult(
    'Environment/Release',
    'Publish workflow launch wireup',
    publishWorkflowCheck.ok,
    publishWorkflowCheck.detail,
  )

  const startupHardeningCheck = validateDevOnlyStartupHardening()
  pushResult(
    'Contract',
    'Dev-only startup hardening',
    startupHardeningCheck.ok,
    startupHardeningCheck.detail,
  )

  const strictConvergenceCheck = validateStrictSemanticConvergence()
  pushResult(
    'Contract',
    'Strict semantic convergence',
    strictConvergenceCheck.ok,
    strictConvergenceCheck.detail,
  )

  runCommand('Environment/Release', 'Typecheck', 'pnpm typecheck')
  runCommand('Environment/Release', 'Lint', 'pnpm lint')
  runCommand('Environment/Release', 'Build', 'pnpm build')
  runCommand(
    'Environment/Release',
    'Packaging dry-run (canonical launch profile)',
    'node ops/packaging/scripts/build.mjs --dry-run --target llm-forum --build-profile launch',
  )

  if (launchRegressionTests.length > 0) {
    runCommand(
      'Environment/Release',
      'Launch regression tests',
      `node scripts/run-vitest.mjs run ${launchRegressionTests.join(' ')}`,
    )
  }

  runCommand(
    'Environment/Release',
    'Governance lint',
    'node .ai/scripts/ctl-project-governance.mjs lint --check --project main',
  )
}

async function runStagingChecks() {
  const webBaseUrl = normalizeBaseUrl(
    readArg('web-base-url') || process.env.LAUNCH_WEB_BASE_URL || '',
  )
  const workerBaseUrl = normalizeBaseUrl(
    readArg('worker-base-url') || process.env.LAUNCH_WORKER_BASE_URL || '',
  )
  const adminToken = readArg('admin-token') || process.env.LAUNCH_ADMIN_TOKEN || ''

  if (!webBaseUrl || !workerBaseUrl || !adminToken) {
    pushResult(
      'Environment/Release',
      'Staging launch inputs',
      false,
      'require --web-base-url, --worker-base-url, and --admin-token (or LAUNCH_WEB_BASE_URL / LAUNCH_WORKER_BASE_URL / LAUNCH_ADMIN_TOKEN)',
    )
    return
  }

  const authHeaders = {
    Authorization: `Bearer ${adminToken}`,
  }

  const webHealth = await fetchJson(`${webBaseUrl}/health`)
  pushResult(
    'Environment/Release',
    'Web health',
    webHealth.status === 200 && webHealth.body?.ok === true,
    `status=${webHealth.status}`,
  )

  const workerHealth = await fetchJson(`${workerBaseUrl}/health`)
  pushResult(
    'Environment/Release',
    'Worker health',
    workerHealth.status === 200 && workerHealth.body?.ok === true,
    `status=${workerHealth.status}`,
  )

  const webRuntimeStats = await fetchJson(`${webBaseUrl}/v1/admin/runtime/stats`, {
    headers: authHeaders,
  })
  const webRuntime = webRuntimeStats.body?.data?.runtime ?? null
  pushResult(
    'Environment/Release',
    'API runtime routing mode',
    webRuntimeStats.status === 200 && webRuntime?.routing_mode === 'policy_driven',
    webRuntimeStats.status === 200
      ? `routing_mode=${String(webRuntime?.routing_mode)}`
      : `status=${webRuntimeStats.status}`,
  )
  pushResult(
    'Environment/Release',
    'API env pins absent',
    webRuntimeStats.status === 200 && webRuntime?.authority_state?.env_pins_present !== true,
    webRuntimeStats.status === 200
      ? `env_pins_present=${String(webRuntime?.authority_state?.env_pins_present)}`
      : `status=${webRuntimeStats.status}`,
  )
  pushResult(
    'Environment/Release',
    'API debug signals absent',
    webRuntimeStats.status === 200 && webRuntime?.authority_state?.debug_signals_present !== true,
    webRuntimeStats.status === 200
      ? `debug_signals_present=${String(webRuntime?.authority_state?.debug_signals_present)}`
      : `status=${webRuntimeStats.status}`,
  )

  const runtimeStats = await fetchJson(`${workerBaseUrl}/v1/admin/runtime/stats`, {
    headers: authHeaders,
  })
  const workerRuntime = runtimeStats.body?.data?.runtime ?? null
  const baselineAdmission = workerRuntime?.baseline_admission ?? null
  const runtimeRunning = workerRuntime?.running === true
  pushResult(
    'Environment/Release',
    'Worker runtime running',
    runtimeStats.status === 200 && runtimeRunning,
    runtimeStats.status === 200
      ? `running=${String(workerRuntime?.running)}`
      : `status=${runtimeStats.status}`,
  )
  pushResult(
    'Environment/Release',
    'Worker runtime routing mode',
    runtimeStats.status === 200 && workerRuntime?.routing_mode === 'policy_driven',
    runtimeStats.status === 200
      ? `routing_mode=${String(workerRuntime?.routing_mode)}`
      : `status=${runtimeStats.status}`,
  )
  pushResult(
    'Environment/Release',
    'Worker env pins absent',
    runtimeStats.status === 200 && workerRuntime?.authority_state?.env_pins_present !== true,
    runtimeStats.status === 200
      ? `env_pins_present=${String(workerRuntime?.authority_state?.env_pins_present)}`
      : `status=${runtimeStats.status}`,
  )
  pushResult(
    'Environment/Release',
    'Worker debug signals absent',
    runtimeStats.status === 200 && workerRuntime?.authority_state?.debug_signals_present !== true,
    runtimeStats.status === 200
      ? `debug_signals_present=${String(workerRuntime?.authority_state?.debug_signals_present)}`
      : `status=${runtimeStats.status}`,
  )
  pushResult(
    'Foundation Activation',
    'Worker kickoff baseline present',
    runtimeStats.status === 200 && baselineAdmission?.has_kickoff_baseline === true,
    runtimeStats.status === 200
      ? `has_kickoff_baseline=${String(baselineAdmission?.has_kickoff_baseline)}`
      : `status=${runtimeStats.status}`,
  )
  pushResult(
    'Runtime Readiness',
    'Worker kickoff baseline ready',
    runtimeStats.status === 200 && baselineAdmission?.kickoff_layer_ready === true,
    runtimeStats.status === 200
      ? `kickoff_layer_ready=${String(baselineAdmission?.kickoff_layer_ready)}`
      : `status=${runtimeStats.status}`,
  )
  pushResult(
    'Runtime Readiness',
    'Worker warmup baseline ready',
    runtimeStats.status === 200 && baselineAdmission?.warmup_layer_ready === true,
    runtimeStats.status === 200
      ? `warmup_layer_ready=${String(baselineAdmission?.warmup_layer_ready)}`
      : `status=${runtimeStats.status}`,
  )
  pushResult(
    'Runtime Readiness',
    'Worker runtime promotable',
    runtimeStats.status === 200
      && (baselineAdmission?.natural_allow_public_growth === true
        || baselineAdmission?.allow_public_growth === true),
    runtimeStats.status === 200
      ? `natural_allow_public_growth=${String(baselineAdmission?.natural_allow_public_growth)} allow_public_growth=${String(baselineAdmission?.allow_public_growth)} reasons=${JSON.stringify(baselineAdmission?.reasons ?? [])}`
      : `status=${runtimeStats.status}`,
  )
  pushResult(
    'Runtime Readiness',
    'Worker key communities ready',
    runtimeStats.status === 200 && baselineAdmission?.key_communities_ready === true,
    runtimeStats.status === 200
      ? `key_communities_ready=${String(baselineAdmission?.key_communities_ready)}`
      : `status=${runtimeStats.status}`,
  )
  pushResult(
    'Runtime Readiness',
    'Worker key shelves ready',
    runtimeStats.status === 200 && baselineAdmission?.key_shelves_ready === true,
    runtimeStats.status === 200
      ? `key_shelves_ready=${String(baselineAdmission?.key_shelves_ready)}`
      : `status=${runtimeStats.status}`,
  )
  pushResult(
    'Runtime Readiness',
    'Worker media access ready',
    runtimeStats.status === 200 && baselineAdmission?.media_access_ok === true,
    runtimeStats.status === 200
      ? `media_access_ok=${String(baselineAdmission?.media_access_ok)}`
      : `status=${runtimeStats.status}`,
  )
  pushResult(
    'Runtime Readiness',
    'Worker aftershow pipeline ready',
    runtimeStats.status === 200 && baselineAdmission?.aftershow_pipeline_ok === true,
    runtimeStats.status === 200
      ? `aftershow_pipeline_ok=${String(baselineAdmission?.aftershow_pipeline_ok)}`
      : `status=${runtimeStats.status}`,
  )

  const kickoffResponse = await fetchJson(`${webBaseUrl}/v1/admin/kickoff`, {
    headers: authHeaders,
  })
  const activeKickoff = kickoffResponse.body?.data ?? null
  pushResult(
    'Kickoff',
    'Active kickoff baseline present',
    kickoffResponse.status === 200 && Boolean(activeKickoff?.id),
    kickoffResponse.status === 200
      ? `kickoff_id=${String(activeKickoff?.id ?? '') || 'none'}`
      : `status=${kickoffResponse.status}`,
  )

  if (activeKickoff?.id) {
    pushResult(
      'Runtime Readiness',
      'Kickoff baseline verification',
      activeKickoff?.verification?.ok === true,
      `kickoff_ready=${String(activeKickoff?.verification?.ok)} reasons=${JSON.stringify(activeKickoff?.verification?.missing ?? [])}`,
    )
  }

  const warmupRunsResponse = await fetchJson(`${webBaseUrl}/v1/admin/warmup/runs`, {
    headers: authHeaders,
  })
  const warmupRuns = Array.isArray(warmupRunsResponse.body?.data) ? warmupRunsResponse.body.data : []
  const currentWarmupRun = warmupRuns.find((run) => run?.is_current === true) ?? null
  pushResult(
    'Warmup Runtime',
    'Current warmup run present',
    warmupRunsResponse.status === 200 && Boolean(currentWarmupRun?.id),
    warmupRunsResponse.status === 200
      ? `current_run_id=${String(currentWarmupRun?.id ?? '') || 'none'}`
      : `status=${warmupRunsResponse.status}`,
  )

  if (currentWarmupRun?.id) {
    pushResult(
      'Runtime Readiness',
      'Current warmup run interaction floor',
      (currentWarmupRun?.stats?.threads ?? 0) > 0 &&
        (currentWarmupRun?.stats?.turns ?? 0) > 0 &&
        (currentWarmupRun?.stats?.votes ?? 0) > 0,
      `threads=${currentWarmupRun?.stats?.threads ?? 0} turns=${currentWarmupRun?.stats?.turns ?? 0} votes=${currentWarmupRun?.stats?.votes ?? 0}`,
    )
    pushResult(
      'Runtime Readiness',
      'Current warmup run media floor',
      (currentWarmupRun?.stats?.media ?? 0) > 0 &&
        typeof currentWarmupRun?.stats?.media_coverage_ratio === 'number' &&
        currentWarmupRun.stats.media_coverage_ratio >= 0.35,
      `media=${currentWarmupRun?.stats?.media ?? 0} ratio=${String(currentWarmupRun?.stats?.media_coverage_ratio ?? 0)}`,
    )
  }

  runNodeScriptCheck(
    'Runtime Readiness',
    'Warm-up closure verifier',
    'scripts/verify-warmup-closure.mjs',
    ['--base-url', workerBaseUrl],
    {
      env: {
        LAUNCH_ADMIN_TOKEN: adminToken,
      },
    },
  )

  const frontendFlags = await fetchJson(`${webBaseUrl}/frontend-build-capabilities.json`)
  const proofProfile = frontendFlags.body?.profile === 'launch'
  const homeFlag = frontendFlags.body?.frontend_capabilities?.home_programming === true
  const opsFlag = frontendFlags.body?.frontend_capabilities?.programming_ops === true
  pushResult(
    'Environment/Release',
    'Launch frontend build proof',
    frontendFlags.status === 200 && proofProfile && homeFlag && opsFlag,
    frontendFlags.status === 200
      ? `profile=${String(frontendFlags.body?.profile)} home=${String(homeFlag)} programming_ops=${String(opsFlag)}`
      : `status=${frontendFlags.status}`,
  )

  const homeResponse = await fetchJson(`${webBaseUrl}/v1/home`)
  const homePayload = homeResponse.body?.data ?? null
  const shelves = Array.isArray(homePayload?.shelves) ? homePayload.shelves : []
  const shelfIds = shelves.map((shelf) => shelf.id)
  const shelvesById = new Map(shelves.map((shelf) => [shelf.id, shelf]))
  pushResult(
    'Runtime Readiness',
    'Launch home enabled',
    homeResponse.status === 200 && homePayload?.enabled === true,
    homeResponse.status === 200
      ? `enabled=${String(homePayload?.enabled)}`
      : `status=${homeResponse.status}`,
  )
  pushResult(
    'Runtime Readiness',
    'Launch shelf order',
    JSON.stringify(shelfIds) === JSON.stringify(REQUIRED_HOME_SHELF_ORDER),
    `actual=${JSON.stringify(shelfIds)}`,
  )
  pushResult(
    'Runtime Readiness',
    'must_watch_today non-empty',
    (shelvesById.get('must_watch_today')?.items?.length ?? 0) > 0,
    `count=${shelvesById.get('must_watch_today')?.items?.length ?? 0}`,
  )
  pushResult(
    'Runtime Readiness',
    'conflict_rising non-empty',
    (shelvesById.get('conflict_rising')?.items?.length ?? 0) > 0,
    `count=${shelvesById.get('conflict_rising')?.items?.length ?? 0}`,
  )
  pushResult(
    'Runtime Readiness',
    'notes_today threshold',
    (shelvesById.get('notes_today')?.items?.length ?? 0) >= 2,
    `count=${shelvesById.get('notes_today')?.items?.length ?? 0}`,
  )
  pushResult(
    'Runtime Readiness',
    'continue_storyline threshold',
    (shelvesById.get('continue_storyline')?.items?.length ?? 0) >= 2,
    `count=${shelvesById.get('continue_storyline')?.items?.length ?? 0}`,
  )
  pushResult(
    'Runtime Readiness',
    'tonight_programming non-empty',
    (shelvesById.get('tonight_programming')?.items?.length ?? 0) > 0,
    `count=${shelvesById.get('tonight_programming')?.items?.length ?? 0}`,
  )

  const launchCommunitySlugs = readLaunchCommunitySlugs()
  const communitiesResponse = await fetchJson(`${webBaseUrl}/v1/communities?limit=100`)
  const communities = Array.isArray(communitiesResponse.body?.data)
    ? communitiesResponse.body.data
    : []
  const visibleCommunitySlugs = new Set(
    communities.map((community) => community?.slug).filter(Boolean),
  )
  const missingLaunchCommunities = launchCommunitySlugs.filter(
    (slug) => !visibleCommunitySlugs.has(slug),
  )
  pushResult(
    'Runtime Readiness',
    'Launch community catalog completeness',
    communitiesResponse.status === 200 && missingLaunchCommunities.length === 0,
    communitiesResponse.status === 200
      ? `missing=${missingLaunchCommunities.join(', ') || 'none'}`
      : `status=${communitiesResponse.status}`,
  )

  const occupancyFailures = []
  for (const slug of launchCommunitySlugs) {
    const community = communities.find((item) => item?.slug === slug)
    if (!community?.id) {
      occupancyFailures.push(`${slug}:missing-community`)
      continue
    }
    const feedResponse = await fetchJson(
      `${webBaseUrl}/v1/feed?community_id=${encodeURIComponent(community.id)}&limit=1`,
    )
    // `/v1/feed` returns `data: PostWithMeta[]` with pagination on `meta.cursor`.
    const itemCount = Array.isArray(feedResponse.body?.data) ? feedResponse.body.data.length : 0
    if (feedResponse.status !== 200 || itemCount < 1) {
      occupancyFailures.push(`${slug}:${feedResponse.status}:${itemCount}`)
    }
  }
  pushResult(
    'Runtime Readiness',
    'Launch community occupancy',
    occupancyFailures.length === 0,
    occupancyFailures.length === 0
      ? `${launchCommunitySlugs.length}/${launchCommunitySlugs.length} communities have visible root posts`
      : occupancyFailures.join(', '),
  )

  try {
    execFileSync(
      process.execPath,
      ['scripts/launch-home-playwright-smoke.mjs', '--url', webBaseUrl],
      {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    pushResult(
      'Environment/Release',
      'Launch home browser smoke',
      true,
      `${webBaseUrl}/ renders Home Programming`,
    )
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? ''
    const stderr = error?.stderr?.toString?.() ?? ''
    pushResult(
      'Environment/Release',
      'Launch home browser smoke',
      false,
      `${stdout}${stderr}`.trim() || 'browser smoke failed',
    )
  }
}

async function main() {
  if (!jsonMode) {
    console.log('')
    console.log(
      stagingMode ? 'Launch Readiness v2 — staging live gate' : 'Launch Readiness v2 — repo gate',
    )
    console.log('')
  }

  if (stagingMode) {
    await runStagingChecks()
  } else {
    runRepoChecks()
  }

  const summary = {
    total: results.length,
    pass: results.length - failCount,
    fail: failCount,
  }

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          mode: stagingMode ? 'staging' : 'repo',
          summary,
          checks: results,
        },
        null,
        2,
      ),
    )
  } else {
    console.log('')
    console.log(`Result: ${summary.pass}/${summary.total} passed, ${summary.fail} failed`)
    console.log('')
  }

  process.exit(ciMode && failCount > 0 ? 1 : failCount > 0 ? 1 : 0)
}

main()
