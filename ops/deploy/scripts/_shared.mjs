import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '../../..');

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

function loadYAMLKeys(relPath) {
  const filePath = resolve(ROOT, relPath);
  if (!existsSync(filePath)) return null;

  const text = readFileSync(filePath, 'utf-8');
  const keys = [];
  for (const line of text.split('\n')) {
    const match = line.match(/^\s{2}(\w+):\s*$/);
    if (match) keys.push(match[1]);
  }
  return keys;
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

    const serviceK8s = service.k8s && typeof service.k8s === 'object' ? service.k8s : {};
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
      k8s: serviceK8s,
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

export function resolveK8sTarget(service, opts = {}) {
  const serviceK8s = service.k8s && typeof service.k8s === 'object' ? service.k8s : {};
  const imageRef = readString(
    opts['image-ref'],
    process.env.DEPLOY_IMAGE_REF,
  );
  const imageRepo = readString(
    opts['image-repo'],
    process.env.DEPLOY_IMAGE_REPO,
    serviceK8s.imageRepo,
  );
  const tag = readString(opts.tag, process.env.DEPLOY_IMAGE_TAG);

  return {
    context: readString(opts.context, process.env.KUBECTL_CONTEXT),
    namespace: readString(
      opts.namespace,
      process.env.DEPLOY_K8S_NAMESPACE,
      serviceK8s.namespace,
    ),
    deployment: readString(
      opts.deployment,
      process.env.DEPLOY_K8S_DEPLOYMENT,
      serviceK8s.deployment,
    ),
    container: readString(
      opts.container,
      process.env.DEPLOY_K8S_CONTAINER,
      serviceK8s.container,
    ),
    imageRepo,
    imageRef: imageRef ?? (imageRepo && tag ? `${imageRepo}:${tag}` : null),
    healthUrl: readString(opts['health-url'], process.env.DEPLOY_HEALTH_URL),
    timeoutSec: safePositiveInt(opts['timeout-sec'], 120),
    healthTimeoutMs: safePositiveInt(opts['health-timeout-ms'], 5000),
  };
}

export function buildImagePlan(target) {
  if (target.imageRef) return target.imageRef;
  if (target.imageRepo) return `${target.imageRepo}:<tag required>`;
  return '<image-ref required>';
}

export function listMissingFields(target, fields) {
  return fields.filter((field) => !target[field]);
}

export function formatKubectlBaseArgs(target) {
  const args = [];
  if (target.context) {
    args.push('--context', target.context);
  }
  args.push('-n', target.namespace);
  return args;
}

export function runCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const details = stderr || stdout || `exit code ${result.status}`;
    throw new Error(`${command} ${args.join(' ')} failed: ${details}`);
  }

  return {
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
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
