import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { parse as parseYaml } from 'yaml'
import { loadFrontendBuildProfile } from '../../ops/packaging/scripts/frontend-build-profile.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(__dirname, '../..')

const LEGACY_BACKEND_FLAG_PREFIX = ['FF', ''].join('_')
const LEGACY_FRONTEND_FLAG_PREFIX = ['VITE', 'FF', ''].join('_')
const LEGACY_MOBILE_FLAG_PREFIX = ['EXPO', 'PUBLIC', 'FF', ''].join('_')

export const REQUIRED_WORKER_ASSETS = [
  'ops/deploy/workloads/eci-worker/README.md',
  'ops/deploy/workloads/eci-worker/role-contract.yaml',
  'ops/deploy/workloads/eci-worker/env-matrix.yaml',
  'ops/deploy/workloads/eci-worker/staging.container-group.yaml',
  'ops/deploy/workloads/eci-worker/prod.container-group.yaml',
  'ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md',
]

export const REQUIRED_KICKOFF_ASSETS = [
  'src/backend/dev/launch-kickoff.ts',
  'src/backend/launch/kickoff.ts',
]

export const REQUIRED_FRONTEND_DELIVERY_ASSETS = [
  'src/backend/routes/frontend-static.ts',
  'scripts/ci/check-image-launch-proof.mjs',
  'scripts/launch-home-playwright-smoke.mjs',
]

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
]

const LEGACY_FRONTEND_PROFILE_FILES = [
  'ops/packaging/build-profiles/staging-launch.json',
  'ops/packaging/build-profiles/prod-launch.json',
]

const FILES_THAT_MUST_NOT_REFERENCE_LEGACY_FRONTEND_PROFILES = [
  '.github/workflows/ci.yml',
  '.github/workflows/publish-image.yml',
  'scripts/verify-launch-readiness.mjs',
  'ops/deploy/handbook/runbooks/ecs-web-eci-worker-rollout.md',
  'ops/packaging/scripts/__tests__/frontend-build-profile.test.ts',
]

const LEGACY_FRONTEND_PROFILE_PATTERNS = [
  'ops/packaging/build-profiles/staging-launch.json',
  'ops/packaging/build-profiles/prod-launch.json',
  '--build-profile staging-launch',
  '--build-profile prod-launch',
  "loadFrontendBuildProfile('staging-launch')",
  "loadFrontendBuildProfile('prod-launch')",
  "writeFrontendCapabilityProof('staging-launch'",
  "writeFrontendCapabilityProof('prod-launch'",
  "profile: 'staging-launch'",
  "profile: 'prod-launch'",
  "['FRONTEND_BUILD_PROFILE', 'staging-launch']",
  "['FRONTEND_BUILD_PROFILE', 'prod-launch']",
]

export const REQUIRED_HOME_SHELF_ORDER = [
  'must_watch_today',
  'conflict_rising',
  'notes_today',
  'continue_storyline',
  'tonight_programming',
  'all_communities',
]

const STRICT_CONVERGENCE_FORBIDDEN_ALIAS_REGEX =
  /(?<![A-Za-z0-9_])(headline_card|note_cover|evidence_strip|conflict_hero|weekly_picks|relationship_watch)(?![A-Za-z0-9_])/
const STRICT_CONVERGENCE_FLAT_FRONTEND_REGEX =
  /(?<![A-Za-z0-9_])(community_family|storyline_state|content_kind|format_kind|editorial_shelf_id|note_template_id|cover_mode|card_mode)(?![A-Za-z0-9_])/
const STRICT_CONVERGENCE_BADGE_DEBUG_COMPAT_REGEX =
  /\b(compat_outputs|compat_only|BadgeDebugCompat)\b/
const STRICT_CONVERGENCE_TARGETS = {
  launchConfig: [
    'config/launch/launch_community_rules.v1.yaml',
    'config/launch/visual_surface_rollout.v1.yaml',
    'config/launch/post_launch_optimization_and_tuning.v1.yaml',
  ],
  launchRuntime: [
    'src/backend/launch/community-rules.ts',
    'src/backend/launch/creator-note-templates.ts',
    'src/backend/launch/programming-projection.ts',
    'src/backend/launch/visual-rollout.ts',
  ],
  frontendRuntime: [
    'src/frontend/features/forum',
    'src/frontend/features/search',
    'src/frontend/features/agents',
    'src/frontend/shared/utils',
  ],
  backendRuntime: ['src/backend', 'src/frontend', 'scripts'],
}

function readText(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8')
}

function readYaml(relativePath) {
  return parseYaml(readText(relativePath))
}

function readSourceFile(relativePath) {
  const scriptKind = relativePath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : relativePath.endsWith('.ts')
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS
  return ts.createSourceFile(
    relativePath,
    readText(relativePath),
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  )
}

function literalText(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : null
}

function unwrapExpression(node) {
  let current = ts.skipParentheses(node)
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = ts.skipParentheses(current.expression)
  }
  return current
}

function propertyNameText(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text
  }
  return null
}

function findAstNode(root, predicate) {
  let result = null
  function visit(node) {
    if (result) return
    if (predicate(node)) {
      result = node
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(root)
  return result
}

function hasAstNode(root, predicate) {
  return Boolean(findAstNode(root, predicate))
}

function hasStaticImport(sourceFile, moduleSpecifier) {
  return hasAstNode(sourceFile, (node) =>
    ts.isImportDeclaration(node) &&
    literalText(node.moduleSpecifier) === moduleSpecifier,
  )
}

function isDynamicImportCall(node, moduleSpecifier) {
  return (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length > 0 &&
    literalText(node.arguments[0]) === moduleSpecifier
  )
}

function hasDynamicImport(root, moduleSpecifier) {
  return hasAstNode(root, (node) => isDynamicImportCall(node, moduleSpecifier))
}

function findFunctionDeclaration(sourceFile, name) {
  return findAstNode(sourceFile, (node) =>
    ts.isFunctionDeclaration(node) &&
    node.name?.text === name,
  )
}

function callExpressionName(node) {
  if (!ts.isCallExpression(node)) return null
  const expression = ts.skipParentheses(node.expression)
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  return null
}

function hasIdentifierCall(root, identifierName) {
  return hasAstNode(root, (node) =>
    ts.isCallExpression(node) &&
    ts.isIdentifier(ts.skipParentheses(node.expression)) &&
    ts.skipParentheses(node.expression).text === identifierName,
  )
}

function hasPropertyCall(root, receiverName, methodName, sourceFile) {
  return hasAstNode(root, (node) => {
    if (!ts.isCallExpression(node)) return false
    const expression = ts.skipParentheses(node.expression)
    return (
      ts.isPropertyAccessExpression(expression) &&
      expression.expression.getText(sourceFile) === receiverName &&
      expression.name.text === methodName
    )
  })
}

function functionHasIdentifierCall(sourceFile, functionName, identifierName) {
  const fn = findFunctionDeclaration(sourceFile, functionName)
  return Boolean(fn && hasIdentifierCall(fn, identifierName))
}

function functionHasDefaultCall(sourceFile, functionName, callName) {
  const fn = findFunctionDeclaration(sourceFile, functionName)
  return Boolean(fn?.parameters.some((parameter) => {
    if (!parameter.initializer || !ts.isCallExpression(parameter.initializer)) return false
    return callExpressionName(parameter.initializer) === callName
  }))
}

function functionReturnsResolveWithString(sourceFile, functionName, value) {
  const fn = findFunctionDeclaration(sourceFile, functionName)
  return Boolean(fn && hasAstNode(fn, (node) => {
    if (!ts.isReturnStatement(node) || !node.expression) return false
    const expression = ts.skipParentheses(node.expression)
    return (
      ts.isCallExpression(expression) &&
      callExpressionName(expression) === 'resolve' &&
      expression.arguments.some((argument) => literalText(argument) === value)
    )
  }))
}

function hasPropertyAssignmentString(sourceFile, propertyName, value) {
  return hasAstNode(sourceFile, (node) =>
    ts.isPropertyAssignment(node) &&
    propertyNameText(node.name) === propertyName &&
    literalText(node.initializer) === value,
  )
}

function hasCallWithFirstStringArg(sourceFile, value) {
  return hasAstNode(sourceFile, (node) =>
    ts.isCallExpression(node) &&
    node.arguments.length > 0 &&
    literalText(node.arguments[0]) === value,
  )
}

function exportedConstArrayIncludes(sourceFile, constName, value) {
  return hasAstNode(sourceFile, (node) => {
    if (!ts.isVariableDeclaration(node)) return false
    if (!ts.isIdentifier(node.name) || node.name.text !== constName) return false
    if (!node.initializer) return false
    const initializer = unwrapExpression(node.initializer)
    if (!ts.isArrayLiteralExpression(initializer)) return false
    return initializer.elements.some((element) => literalText(element) === value)
  })
}

function hasPropertyAccessName(sourceFile, propertyName) {
  return hasAstNode(sourceFile, (node) =>
    ts.isPropertyAccessExpression(node) &&
    node.name.text === propertyName,
  )
}

function hasCallInFinally(sourceFile, identifierName) {
  return hasAstNode(sourceFile, (node) =>
    ts.isTryStatement(node) &&
    Boolean(node.finallyBlock && hasIdentifierCall(node.finallyBlock, identifierName)),
  )
}

function hasGatedDevRouteModules(sourceFile, moduleSpecifiers) {
  const declaration = findAstNode(sourceFile, (node) =>
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === 'devRouteModules',
  )
  if (!declaration?.initializer) return false
  const initializer = unwrapExpression(declaration.initializer)
  if (!ts.isConditionalExpression(initializer)) return false
  const conditionIsDevToolsGate = initializer.condition.getText(sourceFile) === 'config.allowDevTools'
  const disabledBranchEmpty =
    initializer.whenFalse.kind === ts.SyntaxKind.NullKeyword ||
    (
      ts.isArrayLiteralExpression(initializer.whenFalse) &&
      initializer.whenFalse.elements.length === 0
    )
  const enabledBranchImportsAll = moduleSpecifiers.every((moduleSpecifier) =>
    hasDynamicImport(initializer.whenTrue, moduleSpecifier),
  )
  return conditionIsDevToolsGate && disabledBranchEmpty && enabledBranchImportsAll
}

function normalizedDockerfileHas(dockerfile, snippet) {
  const normalize = (value) => value.replace(/\s+/g, ' ').trim()
  return normalize(dockerfile).includes(normalize(snippet))
}

function listRelativeFiles(target) {
  const pathname = resolve(ROOT, target)
  if (!existsSync(pathname)) return []
  const stats = statSync(pathname)
  if (stats.isFile()) return [target]
  if (!stats.isDirectory()) return []

  return readdirSync(pathname, { withFileTypes: true })
    .flatMap((entry) => listRelativeFiles(`${target}/${entry.name}`))
    .sort((left, right) => left.localeCompare(right))
}

function scanForMatches(targets, matcher, options = {}) {
  const { exclude = () => false, maxMatches = 8 } = options
  const files = [...new Set(targets.flatMap((target) => listRelativeFiles(target)))].filter(
    (relativePath) => !exclude(relativePath),
  )
  const matches = []

  for (const relativePath of files) {
    const lines = readText(relativePath).split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (matcher(line, relativePath)) {
        matches.push(`${relativePath}:${index + 1}`)
        if (matches.length >= maxMatches) {
          return matches
        }
      }
    }
  }

  return matches
}

function formatMatchDetail(label, matches) {
  return `${label}: ${matches.join(', ')}`
}

function validateLaunchContractManifestShape(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, detail: 'config/launch/manifest.v1.yaml is not a YAML object' }
  }
  if (manifest.version !== 1) {
    return { ok: false, detail: 'config/launch/manifest.v1.yaml must have version=1' }
  }
  if (!Array.isArray(manifest.contracts) || manifest.contracts.length === 0) {
    return { ok: false, detail: 'config/launch/manifest.v1.yaml must declare contracts[]' }
  }

  const missing = []
  const seenIds = new Set()
  const seenLegacyKeys = new Set()
  for (const contract of manifest.contracts) {
    if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
      return { ok: false, detail: 'launch manifest contracts[] must contain objects' }
    }
    const { id, bundle_slug: bundleSlug, file_name: fileName, path } = contract
    if (!id || !bundleSlug || !fileName || !path) {
      return {
        ok: false,
        detail: 'each launch manifest contract requires id, bundle_slug, file_name, and path',
      }
    }
    if (seenIds.has(id)) {
      return { ok: false, detail: `duplicate launch manifest contract id: ${id}` }
    }
    const legacyKey = `${bundleSlug}::${fileName}`
    if (seenLegacyKeys.has(legacyKey)) {
      return { ok: false, detail: `duplicate launch manifest legacy mapping: ${legacyKey}` }
    }
    seenIds.add(id)
    seenLegacyKeys.add(legacyKey)
    if (!existsSync(resolve(ROOT, path))) {
      missing.push(path)
    }
  }

  return {
    ok: missing.length === 0,
    detail:
      missing.length === 0
        ? `${manifest.contracts.length} runtime launch contracts resolved from config/launch`
        : `manifest references missing runtime contracts: ${missing.join(', ')}`,
  }
}

export function validateLaunchRuntimeOverlay(relativePath, expectedAppEnv) {
  const pathname = resolve(ROOT, relativePath)
  if (!existsSync(pathname)) {
    return { ok: false, detail: `missing ${relativePath}` }
  }

  const parsed = readYaml(relativePath)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, detail: `${relativePath} is not a YAML object` }
  }

  const overlayKeys = Object.keys(parsed)
  const legacyPins = overlayKeys.filter(
    (key) =>
      key.startsWith(LEGACY_BACKEND_FLAG_PREFIX) ||
      key.startsWith(LEGACY_FRONTEND_FLAG_PREFIX) ||
      key.startsWith(LEGACY_MOBILE_FLAG_PREFIX),
  )
  const issues = []
  if (parsed.APP_ENV !== expectedAppEnv) {
    issues.push(`APP_ENV=${expectedAppEnv}`)
  }
  if (legacyPins.length > 0) {
    issues.push(`legacy capability pins present: ${legacyPins.join(', ')}`)
  }

  return {
    ok: issues.length === 0,
    detail:
      issues.length === 0
        ? 'launch runtime overlay is free of legacy feature pins'
        : issues.join('; '),
  }
}

export function validateLocalKindMediaPersistence() {
  const overlayPath = 'ops/deploy/k8s/overlays/local-kind/kustomization.yaml'
  const configPatchPath = 'ops/deploy/k8s/overlays/local-kind/patch-configmap.yaml'
  const pvcPath = 'ops/deploy/k8s/overlays/local-kind/backend-media-pvc.yaml'
  const storagePatchPath = 'ops/deploy/k8s/overlays/local-kind/patch-backend-media-storage.yaml'

  const missingFiles = [overlayPath, configPatchPath, pvcPath, storagePatchPath].filter(
    (relativePath) => !existsSync(resolve(ROOT, relativePath)),
  )
  if (missingFiles.length > 0) {
    return {
      ok: false,
      detail: `missing local-kind media persistence assets: ${missingFiles.join(', ')}`,
    }
  }

  const overlay = readYaml(overlayPath)
  const configPatch = readYaml(configPatchPath)
  const pvc = readYaml(pvcPath)
  const storagePatch = readYaml(storagePatchPath)
  const overlayResources = Array.isArray(overlay?.resources) ? overlay.resources : []
  const overlayPatches = Array.isArray(overlay?.patches) ? overlay.patches : []
  const overlayHasPvc = overlayResources.includes('backend-media-pvc.yaml')
  const overlayHasStoragePatch = overlayPatches.some((entry) =>
    typeof entry === 'string'
      ? entry === 'patch-backend-media-storage.yaml'
      : entry?.path === 'patch-backend-media-storage.yaml',
  )
  const mediaLocalDirOk = configPatch?.data?.MEDIA_LOCAL_DIR === '/var/media-assets'
  const pvcOk =
    pvc?.kind === 'PersistentVolumeClaim' &&
    pvc?.metadata?.name === 'backend-media-assets' &&
    pvc?.spec?.resources?.requests?.storage === '5Gi'
  const backendContainer = Array.isArray(storagePatch?.spec?.template?.spec?.containers)
    ? storagePatch.spec.template.spec.containers.find((container) => container?.name === 'backend')
    : null
  const mountOk =
    Array.isArray(backendContainer?.volumeMounts) &&
    backendContainer.volumeMounts.some(
      (mount) => mount?.name === 'backend-media-assets' && mount?.mountPath === '/var/media-assets',
    )
  const volumeOk =
    Array.isArray(storagePatch?.spec?.template?.spec?.volumes) &&
    storagePatch.spec.template.spec.volumes.some(
      (volume) =>
        volume?.name === 'backend-media-assets' &&
        volume?.persistentVolumeClaim?.claimName === 'backend-media-assets',
    )

  const ok =
    overlayHasPvc && overlayHasStoragePatch && mediaLocalDirOk && pvcOk && mountOk && volumeOk
  return {
    ok,
    detail: ok
      ? 'local-kind backend media assets persist on a dedicated PVC'
      : 'local-kind backend media persistence is incomplete',
  }
}

export function validateFrontendBuildProfile(profileId, target = 'llm-forum') {
  try {
    const profile = loadFrontendBuildProfile(profileId)
    if (profile.target !== target) {
      return {
        ok: false,
        detail: `profile target mismatch: expected ${target}, got ${profile.target}`,
      }
    }

    return {
      ok: true,
      detail: `${profileId} -> ${Object.keys(profile.frontend_capabilities).length} launch capabilities`,
    }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export function validateCanonicalLaunchBuildProfile() {
  const profileCheck = validateFrontendBuildProfile('launch')
  if (!profileCheck.ok) {
    return profileCheck
  }

  const existingLegacyProfiles = LEGACY_FRONTEND_PROFILE_FILES.filter((relativePath) =>
    existsSync(resolve(ROOT, relativePath)),
  )
  if (existingLegacyProfiles.length > 0) {
    return {
      ok: false,
      detail: `legacy frontend build profiles must be removed: ${existingLegacyProfiles.join(', ')}`,
    }
  }

  const legacyReferences = FILES_THAT_MUST_NOT_REFERENCE_LEGACY_FRONTEND_PROFILES.filter(
    (relativePath) => {
      const text = readText(relativePath)
      return LEGACY_FRONTEND_PROFILE_PATTERNS.some((pattern) => text.includes(pattern))
    },
  )
  if (legacyReferences.length > 0) {
    return {
      ok: false,
      detail: `legacy frontend build profile references remain in: ${legacyReferences.join(', ')}`,
    }
  }

  return {
    ok: true,
    detail: 'canonical launch frontend build profile is the only remaining frontend build profile',
  }
}

export function validatePackagingWireup() {
  const dockerfilePath = 'ops/packaging/services/llm-forum.Dockerfile'
  if (!existsSync(resolve(ROOT, dockerfilePath))) {
    return { ok: false, detail: `missing ${dockerfilePath}` }
  }
  const dockerfile = readText(dockerfilePath)
  const requiredSnippets = [
    'ARG FRONTEND_BUILD_PROFILE=""',
    'node ops/packaging/scripts/frontend-build-profile.mjs --profile "$FRONTEND_BUILD_PROFILE" --out dist/frontend/frontend-build-capabilities.json',
    'COPY config ./config',
    'COPY env/contract.yaml ./env/contract.yaml',
    'COPY env/secrets ./env/secrets',
    'Unexpected repo test files in image:',
  ]
  const missing = requiredSnippets.filter((snippet) => !dockerfile.includes(snippet))
  const dockerignorePath = '.dockerignore'
  if (!existsSync(resolve(ROOT, dockerignorePath))) {
    return { ok: false, detail: `missing ${dockerignorePath}` }
  }
  const dockerignore = readText(dockerignorePath)
  const requiredDockerignorePatterns = ['**/__tests__/', '**/*.test.*', '**/*.spec.*', 'tests/']
  const missingDockerignorePatterns = requiredDockerignorePatterns.filter(
    (pattern) => !dockerignore.includes(pattern),
  )
  const hasLegacyDevDocsCopy =
    dockerfile.includes('COPY dev-docs/active ./dev-docs/active') ||
    dockerfile.includes('COPY dev-docs/archive ./dev-docs/archive')
  return {
    ok: missing.length === 0 && missingDockerignorePatterns.length === 0 && !hasLegacyDevDocsCopy,
    detail:
      missing.length === 0 && missingDockerignorePatterns.length === 0 && !hasLegacyDevDocsCopy
        ? 'Dockerfile and dockerignore enforce launch build proof and repo test-file exclusion'
        : hasLegacyDevDocsCopy
          ? 'Dockerfile still copies runtime launch contracts from dev-docs'
          : missing.length > 0
            ? `missing Dockerfile snippets: ${missing.join(' | ')}`
            : `missing dockerignore patterns: ${missingDockerignorePatterns.join(' | ')}`,
  }
}

export function validateFrontendDeliveryAssets() {
  const missing = REQUIRED_FRONTEND_DELIVERY_ASSETS.filter(
    (relativePath) => !existsSync(resolve(ROOT, relativePath)),
  )
  if (missing.length > 0) {
    return {
      ok: false,
      detail: `missing frontend delivery assets: ${missing.join(', ')}`,
    }
  }

  const appModule = readText('src/backend/app.ts')
  const frontendStaticModule = readText('src/backend/routes/frontend-static.ts')
  const ok =
    appModule.includes('createFrontendStaticRouter') &&
    frontendStaticModule.includes("'/frontend-build-capabilities.json'") &&
    frontendStaticModule.includes('res.sendFile(indexPath)')

  return {
    ok,
    detail: ok
      ? 'frontend dist delivery exposes build proof and SPA fallback'
      : 'frontend build proof or SPA delivery wiring is incomplete',
  }
}

export function validateLaunchMembershipBootstrapAssets() {
  const packageJson = JSON.parse(readText('package.json'))
  const bootstrapScript = packageJson.scripts?.['launch:bootstrap:memberships']
  if (bootstrapScript !== 'tsx src/backend/dev/bootstrap-launch-memberships.ts') {
    return {
      ok: false,
      detail: 'package.json is missing launch:bootstrap:memberships',
    }
  }

  const bootstrapFile = 'src/backend/dev/bootstrap-launch-memberships.ts'
  const seedRunnerFile = 'src/backend/dev/dev-seed-runner.ts'
  const e2eTestFile = 'src/backend/routes/__tests__/e2e-dev-seed.test.ts'
  for (const pathname of [bootstrapFile, seedRunnerFile, e2eTestFile]) {
    if (!existsSync(resolve(ROOT, pathname))) {
      return { ok: false, detail: `missing ${pathname}` }
    }
  }

  const seedRunner = readText(seedRunnerFile)
  const e2eTest = readText(e2eTestFile)
  const ok =
    seedRunner.includes("if (profile === 'launch')") &&
    seedRunner.includes('bootstrapLaunchRosterMemberships') &&
    e2eTest.includes('launch-membership-bootstrap-e2e')

  return {
    ok,
    detail: ok
      ? 'launch seed bootstraps memberships and launch e2e assertions exist'
      : 'launch membership bootstrap wiring or coverage is incomplete',
  }
}

export function validateKickoffAssets() {
  const packageJson = JSON.parse(readText('package.json'))
  const kickoffScript = packageJson.scripts?.['launch.kickoff']
  if (kickoffScript !== 'tsx src/backend/dev/launch-kickoff.ts') {
    return {
      ok: false,
      detail: 'package.json is missing launch.kickoff',
    }
  }
  if (packageJson.scripts?.['launch:warm-start']) {
    return {
      ok: false,
      detail: 'legacy launch:warm-start script must be removed',
    }
  }

  const missing = REQUIRED_KICKOFF_ASSETS.filter(
    (relativePath) => !existsSync(resolve(ROOT, relativePath)),
  )
  if (missing.length > 0) {
    return {
      ok: false,
      detail: `missing kickoff assets: ${missing.join(', ')}`,
    }
  }

  const forbiddenKickoffAssets = [
    'src/backend/assets/warm-start-foundation',
    'public/kickoff-boards',
  ].filter((relativePath) => existsSync(resolve(ROOT, relativePath)))
  if (forbiddenKickoffAssets.length > 0) {
    return {
      ok: false,
      detail: `kickoff assets must not live outside .ai/.tmp: ${forbiddenKickoffAssets.join(', ')}`,
    }
  }

  const kickoffModule = readSourceFile('src/backend/launch/kickoff.ts')
  const kickoffCli = readSourceFile('src/backend/dev/launch-kickoff.ts')
  const warmStartService = readSourceFile('src/backend/services/warmup-governance-service.ts')
  const adminKickoffRoutes = readSourceFile('src/backend/routes/admin/admin-kickoff-routes.ts')
  const warmupVerifierShared = readSourceFile('src/shared/warmup-verifier.ts')
  const launchVerifyScript = readSourceFile('scripts/verify-launch-readiness.mjs')
  const driftScanSources = [
    readText('src/backend/services/warmup-governance-service.ts'),
    readText('src/backend/routes/admin/admin-kickoff-routes.ts'),
    readText('src/shared/warmup-verifier.ts'),
    readText('scripts/verify-launch-readiness.mjs'),
  ]
  const driftTokens = [
    'foundation_candidate',
    'warmup_candidate',
    'warmup_topup_candidate',
    'suite_resolution',
    'suite-snapshot',
    'has_active_baseline',
    'foundation_layer_ready',
    'last_review_decision_ok',
  ]
  const driftFree = !driftTokens.some((token) =>
    driftScanSources.some((text) => text.includes(token)),
  )
  const checks = [
    {
      ok: functionReturnsResolveWithString(
        kickoffModule,
        'defaultKickoffManifestPath',
        'kickoff/manifest.v1.yaml',
      ),
      label: 'default kickoff manifest path helper',
    },
    {
      ok:
        functionHasIdentifierCall(kickoffModule, 'resolveKickoffAssetPath', 'ensurePathInsideKickoffTmp') &&
        functionHasIdentifierCall(kickoffModule, 'resolveKickoffAssetPath', 'ensureKickoffPathExists'),
      label: 'kickoff asset path guard',
    },
    {
      ok: functionHasDefaultCall(kickoffModule, 'loadKickoffBundle', 'defaultKickoffManifestPath'),
      label: 'kickoff bundle loader default manifest',
    },
    {
      ok: hasPropertyCall(
        kickoffCli,
        'warmupGovernanceService',
        'importKickoffBaseline',
        kickoffCli,
      ),
      label: 'launch.kickoff import call',
    },
    {
      ok: hasPropertyAssignmentString(warmStartService, 'generation_mode', 'kickoff_import'),
      label: 'kickoff import generation mode',
    },
    {
      ok: hasPropertyAssignmentString(warmStartService, 'generation_mode', 'warmup_runtime'),
      label: 'warmup runtime generation mode',
    },
    {
      ok:
        hasCallWithFirstStringArg(adminKickoffRoutes, '/admin/kickoff') &&
        hasCallWithFirstStringArg(adminKickoffRoutes, '/admin/warmup/runs'),
      label: 'admin kickoff and warmup run routes',
    },
    {
      ok: exportedConstArrayIncludes(
        warmupVerifierShared,
        'WARMUP_VERIFIER_PHASES',
        'kickoff_resolution',
      ),
      label: 'warmup verifier kickoff phase',
    },
    {
      ok:
        hasPropertyAccessName(launchVerifyScript, 'has_kickoff_baseline') &&
        hasPropertyAccessName(launchVerifyScript, 'kickoff_layer_ready'),
      label: 'launch verifier kickoff admission fields',
    },
    {
      ok: driftFree,
      label: 'legacy warm-start drift tokens absent',
    },
  ]
  const failed = checks.filter((check) => !check.ok).map((check) => check.label)
  const ok = failed.length === 0

  return {
    ok,
    detail: ok
      ? 'launch.kickoff wiring and runtime-only warmup guardrails are in place'
      : `launch kickoff assets incomplete: ${failed.join(', ')}`,
  }
}

export function validateLaunchRuntimeContracts() {
  const missing = REQUIRED_LAUNCH_RUNTIME_CONTRACTS.filter(
    (relativePath) => !existsSync(resolve(ROOT, relativePath)),
  )
  if (missing.length > 0) {
    return {
      ok: false,
      detail: `missing launch runtime contracts: ${missing.join(', ')}`,
    }
  }

  const manifestValidation = validateLaunchContractManifestShape(
    readYaml('config/launch/manifest.v1.yaml'),
  )
  if (!manifestValidation.ok) {
    return manifestValidation
  }

  const contractResolver = readText('src/backend/launch/contract-paths.ts')
  const launchModules = [
    'src/backend/launch/community-rules.ts',
    'src/backend/launch/system-roster.ts',
    'src/backend/launch/home-programming.ts',
    'src/backend/launch/creator-note-templates.ts',
    'src/backend/launch/visual-rollout.ts',
    'src/backend/launch/lightweight-personalization.ts',
    'src/backend/launch/programming-schedule.ts',
    'src/backend/launch/post-launch-tuning.ts',
  ].map((relativePath) => readText(relativePath))
  const runtimeReadsDevDocs =
    contractResolver.includes('dev-docs/') ||
    launchModules.some((source) => source.includes('dev-docs/'))

  return {
    ok: manifestValidation.ok && !runtimeReadsDevDocs,
    detail:
      manifestValidation.ok && !runtimeReadsDevDocs
        ? manifestValidation.detail
        : 'runtime launch contract loading still references dev-docs',
  }
}

export function validateDevOnlyStartupHardening() {
  const appModule = readSourceFile('src/backend/app.ts')
  const dockerfile = readText('ops/packaging/services/llm-forum.Dockerfile')
  const kickoffCli = readSourceFile('src/backend/dev/launch-kickoff.ts')
  const devRouteModules = [
    './routes/dev-seed.js',
    './routes/dev-kickoff.js',
    './routes/dev-badge-debug.js',
    './routes/dev-guidance.js',
  ]
  const checks = [
    {
      ok: devRouteModules.every((moduleSpecifier) => !hasStaticImport(appModule, moduleSpecifier)),
      label: 'dev routes are not statically imported',
    },
    {
      ok: hasGatedDevRouteModules(appModule, devRouteModules),
      label: 'dev route dynamic imports are gated by config.allowDevTools',
    },
    {
      ok: normalizedDockerfileHas(dockerfile, 'COPY package.json ./package.json'),
      label: 'runtime image copies package manifest',
    },
    {
      ok: normalizedDockerfileHas(dockerfile, 'COPY --from=builder /app/public ./public'),
      label: 'runtime image copies public assets',
    },
    {
      ok: normalizedDockerfileHas(dockerfile, 'mkdir -p /app/.ai/.tmp'),
      label: 'runtime image creates writable .ai tmp root',
    },
    {
      ok:
        hasCallInFinally(kickoffCli, 'closeRuntimeInfrastructure') &&
        hasCallInFinally(kickoffCli, 'disconnectPrisma'),
      label: 'launch.kickoff closes runtime infrastructure and Prisma',
    },
  ]
  const failed = checks.filter((check) => !check.ok).map((check) => check.label)
  const ok = failed.length === 0

  return {
    ok,
    detail: ok
      ? 'startup preserves ESM semantics, bundled public assets, writable .ai/.tmp, and clean kickoff CLI shutdown'
      : `dev-only startup hardening is incomplete: ${failed.join(', ')}`,
  }
}

export function validatePublishWorkflowWireup() {
  const workflow = readText('.github/workflows/publish-image.yml')
  const publishContext = readText('scripts/ci/publish-image-context.mjs')
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
  ]
  const workflowMissing = workflowChecks
    .filter(({ snippet, minCount }) => workflow.split(snippet).length - 1 < minCount)
    .map(({ snippet }) => snippet)
  const contextOk =
    publishContext.includes("frontend_build_profile: 'launch'") &&
    publishContext.includes("runtime_overlay: 'env/values/staging-launch.yaml'") &&
    publishContext.includes("runtime_overlay: 'env/values/prod-launch.yaml'")

  return {
    ok: workflowMissing.length === 0 && contextOk,
    detail:
      workflowMissing.length === 0 && contextOk
        ? 'publish workflow builds and promotes the canonical launch image with proof checks'
        : workflowMissing.length > 0
          ? `publish workflow is missing launch wireup: ${workflowMissing.join(' | ')}`
          : 'publish-image-context.mjs is missing canonical launch outputs',
  }
}

export function validateWorkerAssets() {
  const missing = REQUIRED_WORKER_ASSETS.filter(
    (relativePath) => !existsSync(resolve(ROOT, relativePath)),
  )
  if (missing.length > 0) {
    return {
      ok: false,
      detail: `missing worker assets: ${missing.join(', ')}`,
    }
  }

  const roleContract = readYaml('ops/deploy/workloads/eci-worker/role-contract.yaml')
  const envMatrix = readYaml('ops/deploy/workloads/eci-worker/env-matrix.yaml')
  const roleOk = roleContract?.runtime_role?.required_env?.RUNTIME_ENABLED === 'true'
  const probeOk = roleContract?.health_probe?.url === 'http://127.0.0.1:4000/health'
  const envOk =
    Array.isArray(envMatrix?.shared_env_files?.staging) &&
    envMatrix.shared_env_files.staging.includes('env/values/staging-launch.yaml') &&
    (envMatrix?.required_env?.role_overrides?.RUNTIME_ENABLED === 'true' ||
      envMatrix?.role_overrides?.RUNTIME_ENABLED === 'true')

  return {
    ok: roleOk && probeOk && envOk,
    detail:
      roleOk && probeOk && envOk
        ? 'worker templates, health probe, and env matrix are complete'
        : 'worker contract is missing runtime/env/probe guarantees',
  }
}

export function validateStrictSemanticConvergence() {
  const failures = []

  const legacyLaunchConfigKeys = scanForMatches(STRICT_CONVERGENCE_TARGETS.launchConfig, (line) =>
    /\b(preferred_visual_modes|allowed_content_shapes)\b/.test(line),
  )
  if (legacyLaunchConfigKeys.length > 0) {
    failures.push(formatMatchDetail('legacy launch config keys remain', legacyLaunchConfigKeys))
  }

  const communityVisualCoverModes = scanForMatches(
    ['config/launch/launch_community_rules.v1.yaml'],
    (line) => /\bpreferred_cover_modes\b/.test(line),
  )
  if (communityVisualCoverModes.length > 0) {
    failures.push(
      formatMatchDetail(
        'community visual policy still declares preferred_cover_modes',
        communityVisualCoverModes,
      ),
    )
  }

  const legacyAliasMatches = scanForMatches(
    [...STRICT_CONVERGENCE_TARGETS.launchConfig, ...STRICT_CONVERGENCE_TARGETS.launchRuntime],
    (line) => STRICT_CONVERGENCE_FORBIDDEN_ALIAS_REGEX.test(line),
  )
  if (legacyAliasMatches.length > 0) {
    failures.push(
      formatMatchDetail(
        'legacy creator/card/template aliases remain in runtime/config',
        legacyAliasMatches,
      ),
    )
  }

  const frontendFlatSemanticReads = scanForMatches(
    STRICT_CONVERGENCE_TARGETS.frontendRuntime,
    (line) => STRICT_CONVERGENCE_FLAT_FRONTEND_REGEX.test(line),
    {
      exclude: (relativePath) =>
        relativePath.includes('/__tests__/') ||
        /\.test\.[^.]+$/.test(relativePath) ||
        relativePath.includes('/api/'),
    },
  )
  if (frontendFlatSemanticReads.length > 0) {
    failures.push(
      formatMatchDetail(
        'frontend runtime still references flat semantic fields',
        frontendFlatSemanticReads,
      ),
    )
  }

  const legacyAuthorBadgeReads = scanForMatches(
    STRICT_CONVERGENCE_TARGETS.backendRuntime,
    (line) => /\bdisplay_badges\b/.test(line),
    {
      exclude: (relativePath) =>
        relativePath.includes('/__tests__/') || /\.test\.[^.]+$/.test(relativePath),
    },
  )
  if (legacyAuthorBadgeReads.length > 0) {
    failures.push(
      formatMatchDetail('legacy author badge fields remain in runtime', legacyAuthorBadgeReads),
    )
  }

  const legacyHighlightsReaders = scanForMatches(['src/backend'], (line) =>
    /\bgetPublicHighlights\s*\(/.test(line),
  )
  if (legacyHighlightsReaders.length > 0) {
    failures.push(
      formatMatchDetail(
        'runtime still consumes legacy public highlights DTOs',
        legacyHighlightsReaders,
      ),
    )
  }

  const legacyForumReadParity = scanForMatches(
    ['src/backend/services/forum-read-service.ts'],
    (line) =>
      /\b(resolveLegacyPostMediaAltText|recordRootPostReadModelParity|root_post_read_model_parity_mismatch|legacy_media)\b/.test(
        line,
      ),
  )
  if (legacyForumReadParity.length > 0) {
    failures.push(
      formatMatchDetail(
        'forum read still carries legacy parity dual-read code',
        legacyForumReadParity,
      ),
    )
  }

  const legacyBadgeDebugCompat = scanForMatches(
    [
      'src/shared/badges/debug-catalog.ts',
      'src/backend/identity/badge-debug-catalog.ts',
      'src/frontend/widgets/dev',
    ],
    (line) => STRICT_CONVERGENCE_BADGE_DEBUG_COMPAT_REGEX.test(line),
    {
      exclude: (relativePath) =>
        relativePath.includes('/__tests__/') || /\.test\.[^.]+$/.test(relativePath),
    },
  )
  if (legacyBadgeDebugCompat.length > 0) {
    failures.push(
      formatMatchDetail(
        'debug surfaces still teach compat badge outputs as primary vocabulary',
        legacyBadgeDebugCompat,
      ),
    )
  }

  return {
    ok: failures.length === 0,
    detail:
      failures.length === 0 ? 'strict semantic convergence gate passed' : failures.join(' | '),
  }
}
