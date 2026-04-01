import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { loadFrontendBuildProfile } from '../../ops/packaging/scripts/frontend-build-profile.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '../..');

export const REQUIRED_LAUNCH_RUNTIME_FLAGS = [
  'FF_STAGE_SPEC_V1',
  'FF_STAGE_TIER_V1',
  'FF_STAGE_ROLE_RUNTIME_V1',
  'FF_MEMBERSHIPS_V1',
  'FF_MEMBERSHIP_STATUS_V1',
  'FF_STAGE_GOVERNANCE_V1',
  'FF_HOME_PROGRAMMING_V1',
  'FF_PROGRAMMING_OPS_V1',
  'FF_GLOBAL_HIGHLIGHTS_V1',
  'FF_LIGHTWEIGHT_PERSONALIZATION_V1',
  'FF_POST_LAUNCH_TUNING_V1',
  'FF_AUDIENCE_ZONE_V1',
  'FF_AFTERSHOW_V1',
  'FF_AFTERSHOW_AUDIENCE_SUMMARY_V1',
  'FF_AFTERSHOW_EVENT_PIPELINE_V1',
  'FF_ROLE_ASSIGNMENT_V1',
  'FF_AUDIENCE_AFTERSHOW_WEB_V1',
];

export const REQUIRED_WORKER_ASSETS = [
  'ops/deploy/workloads/eci-worker/README.md',
  'ops/deploy/workloads/eci-worker/role-contract.yaml',
  'ops/deploy/workloads/eci-worker/env-matrix.yaml',
  'ops/deploy/workloads/eci-worker/staging.container-group.yaml',
  'ops/deploy/workloads/eci-worker/prod.container-group.yaml',
  'ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md',
];

export const REQUIRED_WARM_START_ASSETS = [
  'src/backend/dev/launch-warm-start.ts',
  'src/backend/launch/launch-warm-start.ts',
];

export const REQUIRED_FRONTEND_DELIVERY_ASSETS = [
  'src/backend/routes/frontend-static.ts',
];

export const REQUIRED_HOME_SHELF_ORDER = [
  'must_watch_today',
  'conflict_rising',
  't4_today',
  'continue_storyline',
  'tonight_programming',
  'all_communities',
];

function readText(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function readYaml(relativePath) {
  return parseYaml(readText(relativePath));
}

export function validateLaunchRuntimeOverlay(relativePath, expectedAppEnv) {
  const pathname = resolve(ROOT, relativePath);
  if (!existsSync(pathname)) {
    return { ok: false, detail: `missing ${relativePath}` };
  }

  const parsed = readYaml(relativePath);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, detail: `${relativePath} is not a YAML object` };
  }

  const missing = REQUIRED_LAUNCH_RUNTIME_FLAGS.filter((key) => parsed[key] !== 'true');
  if (parsed.APP_ENV !== expectedAppEnv) {
    missing.unshift(`APP_ENV=${expectedAppEnv}`);
  }

  return {
    ok: missing.length === 0,
    detail: missing.length === 0
      ? 'launch runtime overlay complete'
      : `missing or disabled keys: ${missing.join(', ')}`,
  };
}

export function validateFrontendBuildProfile(profileId, target = 'llm-forum') {
  try {
    const profile = loadFrontendBuildProfile(profileId);
    if (profile.target !== target) {
      return {
        ok: false,
        detail: `profile target mismatch: expected ${target}, got ${profile.target}`,
      };
    }

    return {
      ok: true,
      detail: `${profileId} -> ${Object.keys(profile.frontend_flags).length} launch flags`,
    };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export function validatePackagingWireup() {
  const dockerfilePath = 'ops/packaging/services/llm-forum.Dockerfile';
  if (!existsSync(resolve(ROOT, dockerfilePath))) {
    return { ok: false, detail: `missing ${dockerfilePath}` };
  }
  const dockerfile = readText(dockerfilePath);
  const requiredSnippets = [
    'ARG FRONTEND_BUILD_PROFILE=""',
    'ARG VITE_FF_HOME_PROGRAMMING_V1=false',
    'ARG VITE_FF_PROGRAMMING_OPS_V1=false',
    'node ops/packaging/scripts/frontend-build-profile.mjs --profile "$FRONTEND_BUILD_PROFILE" --out dist/frontend/frontend-build-flags.json',
  ];
  const missing = requiredSnippets.filter((snippet) => !dockerfile.includes(snippet));
  return {
    ok: missing.length === 0,
    detail: missing.length === 0
      ? 'Dockerfile wires launch build args and proof artifact'
      : `missing Dockerfile snippets: ${missing.join(' | ')}`,
  };
}

export function validateFrontendDeliveryAssets() {
  const missing = REQUIRED_FRONTEND_DELIVERY_ASSETS.filter((relativePath) => !existsSync(resolve(ROOT, relativePath)));
  if (missing.length > 0) {
    return {
      ok: false,
      detail: `missing frontend delivery assets: ${missing.join(', ')}`,
    };
  }

  const appModule = readText('src/backend/app.ts');
  const frontendStaticModule = readText('src/backend/routes/frontend-static.ts');
  const ok =
    appModule.includes('createFrontendStaticRouter') &&
    frontendStaticModule.includes("'/frontend-build-flags.json'") &&
    frontendStaticModule.includes('res.sendFile(indexPath)');

  return {
    ok,
    detail: ok
      ? 'frontend dist delivery exposes build proof and SPA fallback'
      : 'frontend build proof or SPA delivery wiring is incomplete',
  };
}

export function validateLaunchMembershipBootstrapAssets() {
  const packageJson = JSON.parse(readText('package.json'));
  const bootstrapScript = packageJson.scripts?.['launch:bootstrap:memberships'];
  if (bootstrapScript !== 'tsx src/backend/dev/bootstrap-launch-memberships.ts') {
    return {
      ok: false,
      detail: 'package.json is missing launch:bootstrap:memberships',
    };
  }

  const bootstrapFile = 'src/backend/dev/bootstrap-launch-memberships.ts';
  const seedRunnerFile = 'src/backend/dev/dev-seed-runner.ts';
  const e2eTestFile = 'src/backend/routes/__tests__/e2e-dev-seed.test.ts';
  for (const pathname of [bootstrapFile, seedRunnerFile, e2eTestFile]) {
    if (!existsSync(resolve(ROOT, pathname))) {
      return { ok: false, detail: `missing ${pathname}` };
    }
  }

  const seedRunner = readText(seedRunnerFile);
  const e2eTest = readText(e2eTestFile);
  const ok =
    seedRunner.includes("if (profile === 'launch')") &&
    seedRunner.includes('bootstrapLaunchRosterMemberships') &&
    e2eTest.includes('launch-membership-bootstrap-e2e');

  return {
    ok,
    detail: ok
      ? 'launch seed bootstraps memberships and launch e2e assertions exist'
      : 'launch membership bootstrap wiring or coverage is incomplete',
  };
}

export function validateLaunchWarmStartAssets() {
  const packageJson = JSON.parse(readText('package.json'));
  const warmStartScript = packageJson.scripts?.['launch:warm-start'];
  if (warmStartScript !== 'tsx src/backend/dev/launch-warm-start.ts') {
    return {
      ok: false,
      detail: 'package.json is missing launch:warm-start',
    };
  }

  const missing = REQUIRED_WARM_START_ASSETS.filter((relativePath) => !existsSync(resolve(ROOT, relativePath)));
  if (missing.length > 0) {
    return {
      ok: false,
      detail: `missing warm-start assets: ${missing.join(', ')}`,
    };
  }

  const warmStartModule = readText('src/backend/launch/launch-warm-start.ts');
  const warmStartCli = readText('src/backend/dev/launch-warm-start.ts');
  const ok =
    warmStartModule.includes('runLaunchWarmStart') &&
    warmStartModule.includes('CURATED_LAUNCH_WARM_START_POSTS') &&
    warmStartCli.includes('runLaunchWarmStart');

  return {
    ok,
    detail: ok
      ? 'launch warm-start command and curated bootstrap module exist'
      : 'launch warm-start wiring or curated bootstrap assets are incomplete',
  };
}

export function validateWorkerAssets() {
  const missing = REQUIRED_WORKER_ASSETS.filter((relativePath) => !existsSync(resolve(ROOT, relativePath)));
  if (missing.length > 0) {
    return {
      ok: false,
      detail: `missing worker assets: ${missing.join(', ')}`,
    };
  }

  const roleContract = readYaml('ops/deploy/workloads/eci-worker/role-contract.yaml');
  const envMatrix = readYaml('ops/deploy/workloads/eci-worker/env-matrix.yaml');
  const roleOk = roleContract?.runtime_role?.required_env?.RUNTIME_ENABLED === 'true';
  const probeOk = roleContract?.health_probe?.url === 'http://127.0.0.1:4000/health';
  const envOk =
    Array.isArray(envMatrix?.shared_env_files?.staging) &&
    envMatrix.shared_env_files.staging.includes('env/values/staging-launch.yaml') &&
    (
      envMatrix?.required_env?.role_overrides?.RUNTIME_ENABLED === 'true'
      || envMatrix?.role_overrides?.RUNTIME_ENABLED === 'true'
    );

  return {
    ok: roleOk && probeOk && envOk,
    detail: roleOk && probeOk && envOk
      ? 'worker templates, health probe, and env matrix are complete'
      : 'worker contract is missing runtime/env/probe guarantees',
  };
}
