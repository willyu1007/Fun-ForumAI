import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '../../..');

const RESERVED_DELIVERY_TAGS = new Set(['main', 'staging', 'prod', 'latest']);

export function parseArgs(args) {
  const result = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      result._.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const nextArg = args[i + 1];
    if (nextArg && !nextArg.startsWith('--')) {
      result[key] = nextArg;
      i++;
    } else {
      result[key] = true;
    }
  }
  return result;
}

export function loadJSON(relPath) {
  const filePath = resolve(ROOT, relPath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

export function loadYAML(relPath) {
  const filePath = resolve(ROOT, relPath);
  if (!existsSync(filePath)) return null;
  return YAML.parse(readFileSync(filePath, 'utf-8'));
}

function loadYAMLKeys(relPath) {
  const parsed = loadYAML(relPath);
  if (!parsed || typeof parsed !== 'object') return null;
  const variables = parsed.variables && typeof parsed.variables === 'object'
    ? Object.keys(parsed.variables)
    : [];
  return variables;
}

export function loadEnvironmentConfig(envId) {
  return loadYAML(`ops/deploy/environments/${envId}.yaml`);
}

export function validateEnvContract(envId) {
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
    name: valuesPath,
    ok: valuesExist,
    detail: valuesExist ? 'present' : 'missing',
  });

  const secretsPath = `env/secrets/${envId}.ref.yaml`;
  const secretsExist = existsSync(resolve(ROOT, secretsPath));
  checks.push({
    name: secretsPath,
    ok: secretsExist,
    detail: secretsExist ? 'present' : 'missing',
  });

  const envConfigPath = `ops/deploy/environments/${envId}.yaml`;
  const envConfigExists = existsSync(resolve(ROOT, envConfigPath));
  checks.push({
    name: envConfigPath,
    ok: envConfigExists,
    detail: envConfigExists ? 'present' : 'missing',
  });

  return checks;
}

export function validatePackagingTarget() {
  const registry = loadJSON('docs/packaging/registry.json');
  const targets = Array.isArray(registry?.targets) ? registry.targets : [];
  if (targets.length === 0) {
    return { ok: false, detail: 'No packaging targets registered', targets: [] };
  }
  return {
    ok: true,
    detail: targets.map((target) => target.id).join(', '),
    targets,
  };
}

export function resolveServices(deployConfig, pkgInfo, serviceId) {
  const services = Array.isArray(deployConfig?.services) ? deployConfig.services : [];
  if (services.length === 0) {
    return {
      services: [],
      missingPackagingTargets: [],
      error: 'No services configured in ops/deploy/config.json',
    };
  }

  const selected = serviceId ? services.filter((service) => service.id === serviceId) : services;
  if (serviceId && selected.length === 0) {
    return {
      services: [],
      missingPackagingTargets: [],
      error: `Service "${serviceId}" not configured in ops/deploy/config.json`,
    };
  }

  const targetsById = new Map(
    Array.isArray(pkgInfo?.targets) ? pkgInfo.targets.map((target) => [target.id, target]) : [],
  );

  const missingPackagingTargets = [];
  const resolvedServices = selected.map((service) => {
    const packagingTargetId = typeof service.packagingTarget === 'string'
      ? service.packagingTarget
      : service.id;
    const packagingTarget = targetsById.get(packagingTargetId) ?? null;
    if (!packagingTarget) {
      missingPackagingTargets.push(packagingTargetId);
    }

    const serviceVm = service.vm && typeof service.vm === 'object' ? service.vm : {};
    return {
      ...service,
      packagingTargetId,
      packagingTarget,
      healthPath:
        typeof service.healthPath === 'string'
          ? service.healthPath
          : packagingTarget?.healthPath ?? '/health',
      port:
        typeof service.port === 'number'
          ? service.port
          : typeof packagingTarget?.port === 'number'
            ? packagingTarget.port
            : null,
      vm: serviceVm,
    };
  });

  return {
    services: resolvedServices,
    missingPackagingTargets,
    error: null,
  };
}

function readString(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function safePositiveInt(rawValue, fallback) {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue > 0) {
    return Math.floor(rawValue);
  }
  if (typeof rawValue === 'string') {
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

export function normalizeCommitSha(rawValue) {
  const trimmed = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!/^[a-f0-9]{40}$/i.test(trimmed)) {
    throw new Error('commit sha must be a full 40-character hex sha.');
  }
  return trimmed.toLowerCase();
}

function validateImmutableTag(tag, label = 'image tag') {
  const normalized = typeof tag === 'string' ? tag.trim().toLowerCase() : '';
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  if (RESERVED_DELIVERY_TAGS.has(normalized)) {
    throw new Error(`${label} must not use the mutable delivery aliases main/staging/prod/latest.`);
  }
  if (!/^sha-[a-f0-9]{40}$/i.test(normalized)) {
    throw new Error(`${label} must use an immutable sha-<commit> tag.`);
  }
  return normalized;
}

export function validateImmutableImageRef(rawValue, label = 'image-ref') {
  const trimmed = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }

  const lastSlash = trimmed.lastIndexOf('/');
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon <= lastSlash) {
    throw new Error(`${label} must include an explicit image tag.`);
  }

  const repository = trimmed.slice(0, lastColon);
  const tag = trimmed.slice(lastColon + 1);
  if (!repository) {
    throw new Error(`${label} must include a repository path.`);
  }

  validateImmutableTag(tag, `${label} tag`);
  return trimmed;
}

export function buildImmutableImageRef(imageRepository, commitSha) {
  const repository = readString(imageRepository);
  if (!repository) {
    throw new Error('image repository is required when resolving --sha to a full image reference.');
  }
  return `${repository}:sha-${normalizeCommitSha(commitSha)}`;
}

function normalizeDbCompat(rawValue) {
  const value = readString(rawValue);
  if (!value) return null;
  if (value !== 'backwards' && value !== 'incompatible') {
    throw new Error('--db-compat must be either backwards or incompatible.');
  }
  return value;
}

export function resolveVmTarget(service, opts = {}) {
  const serviceVm = service.vm && typeof service.vm === 'object' ? service.vm : {};
  const loopbackPort = safePositiveInt(serviceVm.loopbackPort, 14000);
  const containerPort = safePositiveInt(serviceVm.containerPort, service.port ?? 4000);

  const imageRefInput = readString(opts['image-ref'], process.env.DEPLOY_IMAGE_REF);
  const shaInput = readString(opts.sha, process.env.DEPLOY_IMAGE_SHA);
  if (imageRefInput && shaInput) {
    throw new Error('Provide either --image-ref or --sha, not both.');
  }

  let imageMode = null;
  let imageRef = null;
  let commitSha = null;
  const imageRepository = readString(serviceVm.imageRepository, process.env.ACR_IMAGE_REPOSITORY);

  if (imageRefInput) {
    imageMode = 'image-ref';
    imageRef = validateImmutableImageRef(imageRefInput);
    commitSha = imageRef.slice(imageRef.lastIndexOf(':') + 1).replace(/^sha-/, '');
  } else if (shaInput) {
    imageMode = 'sha';
    commitSha = normalizeCommitSha(shaInput);
    imageRef = imageRepository ? buildImmutableImageRef(imageRepository, commitSha) : null;
  }

  return {
    appDir: readString(serviceVm.appDir),
    composeFile: readString(serviceVm.composeFile, 'compose.yaml'),
    deployScript: readString(serviceVm.deployScript, 'deploy.sh'),
    rollbackScript: readString(serviceVm.rollbackScript, 'rollback.sh'),
    smokeScript: readString(serviceVm.smokeScript, 'smoke.sh'),
    releaseStateDir: readString(serviceVm.releaseStateDir, 'releases'),
    composeProject: readString(serviceVm.composeProject, service.id),
    loopbackPort,
    containerPort,
    healthUrl: readString(
      opts['health-url'],
      process.env.DEPLOY_HEALTH_URL,
      serviceVm.healthUrl,
      `http://127.0.0.1:${loopbackPort}/health`,
    ),
    sharedProxyDir: readString(serviceVm.sharedProxyDir),
    imageRepositoryEnv: readString(serviceVm.imageRepositoryEnv, 'ACR_IMAGE_REPOSITORY'),
    pullUsernameEnv: readString(serviceVm.pullUsernameEnv, 'ACR_PULL_USERNAME'),
    pullPasswordEnv: readString(serviceVm.pullPasswordEnv, 'ACR_PULL_PASSWORD'),
    imageRepository,
    imageMode,
    imageRef,
    commitSha,
    withMigrate: Boolean(opts['with-migrate'] || process.env.DEPLOY_WITH_MIGRATE === 'true'),
    dbCompat: normalizeDbCompat(readString(opts['db-compat'], process.env.DEPLOY_DB_COMPAT)),
    dbPlan: readString(opts['db-plan'], process.env.DEPLOY_DB_PLAN) ?? '',
    notes: readString(opts.notes, process.env.DEPLOY_NOTES) ?? '',
  };
}

export function listMissingVmFields(target) {
  const missing = [];
  if (!target.appDir) missing.push('appDir');
  if (!target.composeFile) missing.push('composeFile');
  if (!target.deployScript) missing.push('deployScript');
  if (!target.rollbackScript) missing.push('rollbackScript');
  if (!target.smokeScript) missing.push('smokeScript');
  if (!target.sharedProxyDir) missing.push('sharedProxyDir');
  if (!target.healthUrl) missing.push('healthUrl');
  if (!target.imageMode) missing.push('--image-ref or --sha');
  if (target.imageMode === 'sha' && !target.imageRepository) {
    missing.push(target.imageRepositoryEnv);
  }
  if (!target.dbCompat) missing.push('--db-compat');
  return missing;
}

export function quoteShell(value) {
  const stringValue = String(value ?? '');
  return `'${stringValue.replace(/'/g, `'\\''`)}'`;
}

export function checkHealth(url, timeout = 5000) {
  return new Promise((resolvePromise) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout }, (res) => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolvePromise({ ok: true, status: res.statusCode });
      } else {
        resolvePromise({ ok: false, status: res.statusCode ?? 0 });
      }
    });

    req.on('error', (err) => {
      resolvePromise({ ok: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolvePromise({ ok: false, error: 'timeout' });
    });
  });
}
