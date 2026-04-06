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
  'scripts/ci/check-image-launch-proof.mjs',
  'scripts/launch-home-playwright-smoke.mjs',
];

export const REQUIRED_LAUNCH_RUNTIME_CONTRACTS = [
  'config/launch/manifest.v1.yaml',
  'config/launch/system_roster.launch.v1.yaml',
  'config/launch/launch_community_rules.v1.yaml',
  'config/launch/home_ia_and_shelves.v1.yaml',
  'config/launch/creator_note_templates.v1.yaml',
  'config/launch/visual_surface_rollout.v1.yaml',
  'config/launch/lightweight_personalization_and_relation_hints.v1.yaml',
  'config/launch/launch_programming_schedule.v1.yaml',
  'config/launch/community_governance_and_incubation.v1.yaml',
  'config/launch/post_launch_optimization_and_tuning.v1.yaml',
];

const LEGACY_FRONTEND_PROFILE_FILES = [
  'ops/packaging/build-profiles/staging-launch.json',
  'ops/packaging/build-profiles/prod-launch.json',
];

const FILES_THAT_MUST_NOT_REFERENCE_LEGACY_FRONTEND_PROFILES = [
  '.github/workflows/ci.yml',
  '.github/workflows/publish-image.yml',
  'scripts/verify-launch-readiness.mjs',
  'ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md',
  'ops/packaging/scripts/__tests__/frontend-build-profile.test.ts',
];

const LEGACY_FRONTEND_PROFILE_PATTERNS = [
  'ops/packaging/build-profiles/staging-launch.json',
  'ops/packaging/build-profiles/prod-launch.json',
  '--build-profile staging-launch',
  '--build-profile prod-launch',
  "loadFrontendBuildProfile('staging-launch')",
  "loadFrontendBuildProfile('prod-launch')",
  "writeFrontendFlagProof('staging-launch'",
  "writeFrontendFlagProof('prod-launch'",
  "profile: 'staging-launch'",
  "profile: 'prod-launch'",
  "['FRONTEND_BUILD_PROFILE', 'staging-launch']",
  "['FRONTEND_BUILD_PROFILE', 'prod-launch']",
];

export const REQUIRED_HOME_SHELF_ORDER = [
  'must_watch_today',
  'conflict_rising',
  'notes_today',
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

function validateLaunchContractManifestShape(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, detail: 'config/launch/manifest.v1.yaml is not a YAML object' };
  }
  if (manifest.version !== 1) {
    return { ok: false, detail: 'config/launch/manifest.v1.yaml must have version=1' };
  }
  if (!Array.isArray(manifest.contracts) || manifest.contracts.length === 0) {
    return { ok: false, detail: 'config/launch/manifest.v1.yaml must declare contracts[]' };
  }

  const missing = [];
  const seenIds = new Set();
  const seenLegacyKeys = new Set();
  for (const contract of manifest.contracts) {
    if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
      return { ok: false, detail: 'launch manifest contracts[] must contain objects' };
    }
    const { id, bundle_slug: bundleSlug, file_name: fileName, path } = contract;
    if (!id || !bundleSlug || !fileName || !path) {
      return { ok: false, detail: 'each launch manifest contract requires id, bundle_slug, file_name, and path' };
    }
    if (seenIds.has(id)) {
      return { ok: false, detail: `duplicate launch manifest contract id: ${id}` };
    }
    const legacyKey = `${bundleSlug}::${fileName}`;
    if (seenLegacyKeys.has(legacyKey)) {
      return { ok: false, detail: `duplicate launch manifest legacy mapping: ${legacyKey}` };
    }
    seenIds.add(id);
    seenLegacyKeys.add(legacyKey);
    if (!existsSync(resolve(ROOT, path))) {
      missing.push(path);
    }
  }

  return {
    ok: missing.length === 0,
    detail: missing.length === 0
      ? `${manifest.contracts.length} runtime launch contracts resolved from config/launch`
      : `manifest references missing runtime contracts: ${missing.join(', ')}`,
  };
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

export function validateCanonicalLaunchBuildProfile() {
  const profileCheck = validateFrontendBuildProfile('launch');
  if (!profileCheck.ok) {
    return profileCheck;
  }

  const existingLegacyProfiles = LEGACY_FRONTEND_PROFILE_FILES.filter((relativePath) =>
    existsSync(resolve(ROOT, relativePath)));
  if (existingLegacyProfiles.length > 0) {
    return {
      ok: false,
      detail: `legacy frontend build profiles must be removed: ${existingLegacyProfiles.join(', ')}`,
    };
  }

  const legacyReferences = FILES_THAT_MUST_NOT_REFERENCE_LEGACY_FRONTEND_PROFILES.filter((relativePath) => {
    const text = readText(relativePath);
    return LEGACY_FRONTEND_PROFILE_PATTERNS.some((pattern) => text.includes(pattern));
  });
  if (legacyReferences.length > 0) {
    return {
      ok: false,
      detail: `legacy frontend build profile references remain in: ${legacyReferences.join(', ')}`,
    };
  }

  return {
    ok: true,
    detail: 'canonical launch frontend build profile is the only remaining frontend build profile',
  };
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
    'COPY config ./config',
    'COPY env/contract.yaml ./env/contract.yaml',
    'COPY env/secrets ./env/secrets',
  ];
  const missing = requiredSnippets.filter((snippet) => !dockerfile.includes(snippet));
  const hasLegacyDevDocsCopy =
    dockerfile.includes('COPY dev-docs/active ./dev-docs/active')
    || dockerfile.includes('COPY dev-docs/archive ./dev-docs/archive');
  return {
    ok: missing.length === 0 && !hasLegacyDevDocsCopy,
    detail: missing.length === 0 && !hasLegacyDevDocsCopy
      ? 'Dockerfile wires launch build args and proof artifact'
      : hasLegacyDevDocsCopy
        ? 'Dockerfile still copies runtime launch contracts from dev-docs'
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
    warmStartModule.includes('community_occupancy') &&
    warmStartModule.includes('required_community_floor') &&
    warmStartCli.includes('runLaunchWarmStart');

  return {
    ok,
    detail: ok
      ? 'launch warm-start command and curated bootstrap module exist'
      : 'launch warm-start wiring or curated bootstrap assets are incomplete',
  };
}

export function validateLaunchRuntimeContracts() {
  const missing = REQUIRED_LAUNCH_RUNTIME_CONTRACTS.filter((relativePath) => !existsSync(resolve(ROOT, relativePath)));
  if (missing.length > 0) {
    return {
      ok: false,
      detail: `missing launch runtime contracts: ${missing.join(', ')}`,
    };
  }

  const manifestValidation = validateLaunchContractManifestShape(
    readYaml('config/launch/manifest.v1.yaml'),
  );
  if (!manifestValidation.ok) {
    return manifestValidation;
  }

  const contractResolver = readText('src/backend/launch/contract-paths.ts');
  const launchModules = [
    'src/backend/launch/community-rules.ts',
    'src/backend/launch/system-roster.ts',
    'src/backend/launch/home-programming.ts',
    'src/backend/launch/creator-note-templates.ts',
    'src/backend/launch/visual-rollout.ts',
    'src/backend/launch/lightweight-personalization.ts',
    'src/backend/launch/programming-schedule.ts',
    'src/backend/launch/post-launch-tuning.ts',
  ].map((relativePath) => readText(relativePath));
  const runtimeReadsDevDocs =
    contractResolver.includes('dev-docs/')
    || launchModules.some((source) => source.includes('dev-docs/'));

  return {
    ok: manifestValidation.ok && !runtimeReadsDevDocs,
    detail: manifestValidation.ok && !runtimeReadsDevDocs
      ? manifestValidation.detail
      : 'runtime launch contract loading still references dev-docs',
  };
}

export function validateDevOnlyStartupHardening() {
  const appModule = readText('src/backend/app.ts');
  const fixtureModule = readText('src/backend/dev/dev-seed-fixtures.ts');
  const ok =
    !appModule.includes("import { devSeedRouter } from './routes/dev-seed.js'") &&
    appModule.includes("await import('./routes/dev-seed.js')") &&
    fixtureModule.includes('function getCanonicalCommunities()') &&
    !fixtureModule.includes('const CANONICAL_COMMUNITIES: DevSeedCommunitySpec[] = listLaunchCommunitySeeds()');

  return {
    ok,
    detail: ok
      ? 'production startup no longer statically imports dev-seed launch fixtures'
      : 'dev-only startup hardening is incomplete',
  };
}

export function validatePublishWorkflowWireup() {
  const workflow = readText('.github/workflows/publish-image.yml');
  const publishContext = readText('scripts/ci/publish-image-context.mjs');
  const workflowChecks = [
    {
      snippet: 'node ops/packaging/scripts/build.mjs \\',
      minCount: 1,
    },
    {
      snippet: '--build-profile "$FRONTEND_BUILD_PROFILE"',
      minCount: 1,
    },
    {
      snippet: 'node scripts/ci/check-image-launch-proof.mjs \\',
      minCount: 2,
    },
    {
      snippet: '--expected-profile "$FRONTEND_BUILD_PROFILE"',
      minCount: 2,
    },
  ];
  const workflowMissing = workflowChecks
    .filter(({ snippet, minCount }) => workflow.split(snippet).length - 1 < minCount)
    .map(({ snippet }) => snippet);
  const contextOk =
    publishContext.includes("frontend_build_profile: 'launch'") &&
    publishContext.includes("runtime_overlay: 'env/values/staging-launch.yaml'") &&
    publishContext.includes("runtime_overlay: 'env/values/prod-launch.yaml'");

  return {
    ok: workflowMissing.length === 0 && contextOk,
    detail: workflowMissing.length === 0 && contextOk
      ? 'publish workflow builds and promotes the canonical launch image with proof checks'
      : workflowMissing.length > 0
        ? `publish workflow is missing launch wireup: ${workflowMissing.join(' | ')}`
        : 'publish-image-context.mjs is missing canonical launch outputs',
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
