#!/usr/bin/env node

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import {
  parseArgs,
  loadEnvironmentConfig,
  buildImmutableImageRef,
  validateImmutableImageRef,
  normalizeCommitSha,
  resolveReleaseIntentPaths,
  loadReleaseIntent,
} from './_shared.mjs';

const DEFAULT_TARGETS_BY_ENV = Object.freeze({
  staging: ['ecs_web', 'eci_worker'],
  prod: ['ecs_web', 'eci_worker'],
});

const TARGET_STATUSES = new Set(['pending', 'applied', 'failed', 'skipped']);
const FORCE_SUPERSEDE_REQUIRED_STATUSES = new Set(['partially_applied', 'attention_required']);

function usage() {
  console.log(`
release-intent.mjs — repo-side desired release tracker

Usage:
  node ops/deploy/scripts/release-intent.mjs set --env <env> (--image-ref <acr/...:sha-<commit>> | --sha <40-char-commit>) --db-compat <backwards|incompatible> [options]
  node ops/deploy/scripts/release-intent.mjs show --env <env> [--json]
  node ops/deploy/scripts/release-intent.mjs resolve --env <env> [--field <image_ref|git_sha|db_compat|db_plan|status>]
  node ops/deploy/scripts/release-intent.mjs mark-target --env <env> --target <ecs_web|eci_worker> --status <pending|applied|failed|skipped> [--image-ref <acr/...:sha-<commit>>] [--notes <text>]

Options for set:
  --image-ref <repo:tag>    Immutable image reference using sha-<commit>
  --sha <commit-sha>        40-character commit SHA (requires ACR_IMAGE_REPOSITORY or --image-repository)
  --image-repository <repo> Repository used to build an immutable image ref from --sha
  --db-compat <mode>        backwards | incompatible
  --db-plan <ticket>        Required when --db-compat incompatible
  --approved-by <actor>     Human who approved the release intent
  --published-at <iso>      Build/publish time (defaults to now)
  --approved-at <iso>       Approval time (defaults to now)
  --notes <text>            Optional release notes
  --targets <csv>           Override tracked targets (default: ecs_web,eci_worker)
  --force-supersede         Required when replacing a partially applied / attention_required desired release

Options for mark-target:
  --target <id>             Target id to update
  --status <status>         pending | applied | failed | skipped
  --image-ref <repo:tag>    Required when --status applied; must match the current desired image_ref
  --notes <text>            Optional target-level note
  --updated-at <iso>        Override update time (defaults to now)
`);
}

function die(message) {
  console.error(`[error] ${message}`);
  return 1;
}

function nowIso() {
  return new Date().toISOString();
}

function assertEnv(envId) {
  if (!envId) {
    throw new Error('--env is required.');
  }
  if (!loadEnvironmentConfig(envId)) {
    throw new Error(`ops/deploy/environments/${envId}.yaml not found.`);
  }
}

function extractShaFromImageRef(imageRef) {
  validateImmutableImageRef(imageRef);
  const tag = imageRef.slice(imageRef.lastIndexOf(':') + 1);
  return normalizeCommitSha(tag.slice(4));
}

function normalizeDbCompat(rawValue) {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (value !== 'backwards' && value !== 'incompatible') {
    throw new Error('--db-compat must be either backwards or incompatible.');
  }
  return value;
}

function parseTargets(rawValue, envId) {
  const source = typeof rawValue === 'string' && rawValue.trim().length > 0
    ? rawValue
    : DEFAULT_TARGETS_BY_ENV[envId]?.join(',') ?? 'ecs_web';

  const targets = [...new Set(
    source
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )];

  if (targets.length === 0) {
    throw new Error('At least one rollout target is required.');
  }
  for (const target of targets) {
    if (!/^[a-z0-9_]+$/i.test(target)) {
      throw new Error(`Invalid target "${target}". Use letters, digits, and underscores only.`);
    }
  }
  return targets;
}

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function snapshot(record, historyEvent, historyAt) {
  return {
    ...record,
    history_event: historyEvent,
    history_at: historyAt,
  };
}

function appendHistory(paths, record, historyEvent, historyAt) {
  ensureDir(paths.absDir);
  appendFileSync(paths.absHistory, `${JSON.stringify(snapshot(record, historyEvent, historyAt))}\n`);
}

function writeDesired(paths, record) {
  ensureDir(paths.absDir);
  writeFileSync(paths.absDesired, `${JSON.stringify(record, null, 2)}\n`);
}

function mergeTargets(existingTargets, targetIds, changedAt) {
  const result = {};
  for (const targetId of targetIds) {
    const prior = existingTargets?.[targetId];
    if (prior && typeof prior === 'object') {
      result[targetId] = {
        status: typeof prior.status === 'string' ? prior.status : 'pending',
        notes: typeof prior.notes === 'string' ? prior.notes : '',
        updated_at: typeof prior.updated_at === 'string' ? prior.updated_at : changedAt,
        ...(typeof prior.applied_at === 'string' ? { applied_at: prior.applied_at } : {}),
        ...(typeof prior.failed_at === 'string' ? { failed_at: prior.failed_at } : {}),
      };
      continue;
    }
    result[targetId] = {
      status: 'pending',
      notes: '',
      updated_at: changedAt,
    };
  }
  return result;
}

function recomputeOverallStatus(record, changedAt) {
  const targets = Object.values(record.targets ?? {});
  if (targets.length === 0) {
    record.status = 'pending';
    delete record.fulfilled_at;
    return record;
  }

  const statuses = targets.map((target) => target.status);
  if (statuses.some((status) => status === 'failed')) {
    record.status = 'attention_required';
    delete record.fulfilled_at;
    return record;
  }

  if (statuses.every((status) => status === 'applied' || status === 'skipped')) {
    record.status = 'fulfilled';
    record.fulfilled_at = record.fulfilled_at ?? changedAt;
    return record;
  }

  if (statuses.some((status) => status === 'applied' || status === 'skipped')) {
    record.status = 'partially_applied';
    delete record.fulfilled_at;
    return record;
  }

  record.status = 'pending';
  delete record.fulfilled_at;
  return record;
}

function resolveImageRefFromArgs(opts) {
  const imageRefInput = typeof opts['image-ref'] === 'string' ? opts['image-ref'].trim() : '';
  const shaInput = typeof opts.sha === 'string' ? opts.sha.trim() : '';
  if (imageRefInput && shaInput) {
    throw new Error('Provide either --image-ref or --sha, not both.');
  }
  if (!imageRefInput && !shaInput) {
    throw new Error('One of --image-ref or --sha is required.');
  }

  if (imageRefInput) {
    return {
      imageRef: validateImmutableImageRef(imageRefInput),
      gitSha: extractShaFromImageRef(imageRefInput),
    };
  }

  const repository = typeof opts['image-repository'] === 'string' && opts['image-repository'].trim().length > 0
    ? opts['image-repository'].trim()
    : process.env.ACR_IMAGE_REPOSITORY;
  const gitSha = normalizeCommitSha(shaInput);
  return {
    imageRef: buildImmutableImageRef(repository, gitSha),
    gitSha,
  };
}

function setIntent(opts) {
  const envId = opts.env;
  assertEnv(envId);

  const { imageRef, gitSha } = resolveImageRefFromArgs(opts);
  const dbCompat = normalizeDbCompat(opts['db-compat']);
  const dbPlan = typeof opts['db-plan'] === 'string' ? opts['db-plan'].trim() : '';
  if (dbCompat === 'incompatible' && !dbPlan) {
    throw new Error('--db-plan is required when --db-compat incompatible.');
  }

  const changedAt = nowIso();
  const publishedAt = typeof opts['published-at'] === 'string' && opts['published-at'].trim().length > 0
    ? opts['published-at'].trim()
    : changedAt;
  const approvedAt = typeof opts['approved-at'] === 'string' && opts['approved-at'].trim().length > 0
    ? opts['approved-at'].trim()
    : changedAt;
  const approvedBy = typeof opts['approved-by'] === 'string' && opts['approved-by'].trim().length > 0
    ? opts['approved-by'].trim()
    : 'unknown';
  const notes = typeof opts.notes === 'string' ? opts.notes : '';
  const targetIds = parseTargets(opts.targets, envId);
  const paths = resolveReleaseIntentPaths(envId);
  const existing = loadReleaseIntent(envId);
  const forceSupersede = Boolean(opts['force-supersede']);

  if (
    existing &&
    existing.image_ref !== imageRef &&
    FORCE_SUPERSEDE_REQUIRED_STATUSES.has(existing.status) &&
    !forceSupersede
  ) {
    throw new Error(
      `Current desired release for ${envId} is ${existing.status}. Replacing ${existing.image_ref} with ${imageRef} requires --force-supersede.`,
    );
  }

  if (existing && existing.image_ref !== imageRef) {
    const archived = {
      ...existing,
      status: existing.status === 'fulfilled' ? 'fulfilled' : 'superseded',
      superseded_at: changedAt,
      superseded_by: imageRef,
    };
    appendHistory(paths, archived, 'superseded', changedAt);
  }

  const record = {
    schema_version: 1,
    env: envId,
    image_ref: imageRef,
    git_sha: gitSha,
    published_at: publishedAt,
    approved_at: approvedAt,
    approved_by: approvedBy,
    recorded_at: existing?.image_ref === imageRef ? existing.recorded_at ?? changedAt : changedAt,
    updated_at: changedAt,
    db_compat: dbCompat,
    db_plan: dbPlan,
    notes,
    targets: mergeTargets(existing?.image_ref === imageRef ? existing.targets : null, targetIds, changedAt),
    status: 'pending',
  };

  recomputeOverallStatus(record, changedAt);
  writeDesired(paths, record);
  appendHistory(paths, record, existing?.image_ref === imageRef ? 'refresh' : 'set', changedAt);

  console.log(`[ok] Recorded desired release for ${envId}`);
  console.log(`  image_ref: ${record.image_ref}`);
  console.log(`  git_sha:   ${record.git_sha}`);
  console.log(`  status:    ${record.status}`);
  console.log(`  targets:   ${Object.entries(record.targets).map(([targetId, target]) => `${targetId}=${target.status}`).join(', ')}`);
}

function renderIntent(record, asJson) {
  if (asJson) {
    console.log(JSON.stringify(record, null, 2));
    return;
  }

  console.log(`env:         ${record.env}`);
  console.log(`image_ref:   ${record.image_ref}`);
  console.log(`git_sha:     ${record.git_sha}`);
  console.log(`status:      ${record.status}`);
  console.log(`published:   ${record.published_at}`);
  console.log(`approved:    ${record.approved_at} by ${record.approved_by}`);
  console.log(`db_compat:   ${record.db_compat}`);
  console.log(`db_plan:     ${record.db_plan || '<none>'}`);
  console.log(`notes:       ${record.notes || '<none>'}`);
  console.log('targets:');
  for (const [targetId, target] of Object.entries(record.targets ?? {})) {
    console.log(`  - ${targetId}: ${target.status}${target.applied_at ? ` (applied_at=${target.applied_at})` : ''}`);
  }
}

function showIntent(opts) {
  const envId = opts.env;
  assertEnv(envId);
  const record = loadReleaseIntent(envId);
  if (!record) {
    throw new Error(`No desired release recorded for ${envId}.`);
  }
  renderIntent(record, Boolean(opts.json));
}

function resolveIntentField(opts) {
  const envId = opts.env;
  assertEnv(envId);
  const record = loadReleaseIntent(envId);
  if (!record) {
    throw new Error(`No desired release recorded for ${envId}.`);
  }

  const field = typeof opts.field === 'string' && opts.field.trim().length > 0
    ? opts.field.trim()
    : 'image_ref';
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Field "${field}" is not a string on the current desired release.`);
  }
  console.log(value);
}

function markTarget(opts) {
  const envId = opts.env;
  assertEnv(envId);
  const targetId = typeof opts.target === 'string' ? opts.target.trim() : '';
  const targetStatus = typeof opts.status === 'string' ? opts.status.trim() : '';
  if (!targetId) {
    throw new Error('--target is required.');
  }
  if (!TARGET_STATUSES.has(targetStatus)) {
    throw new Error(`--status must be one of: ${[...TARGET_STATUSES].join(', ')}`);
  }

  const record = loadReleaseIntent(envId);
  if (!record) {
    throw new Error(`No desired release recorded for ${envId}.`);
  }
  if (!record.targets || typeof record.targets[targetId] !== 'object') {
    throw new Error(`Target "${targetId}" is not tracked in the current desired release.`);
  }

  const changedAt = typeof opts['updated-at'] === 'string' && opts['updated-at'].trim().length > 0
    ? opts['updated-at'].trim()
    : nowIso();
  const notes = typeof opts.notes === 'string' ? opts.notes : '';
  const targetImageRef = typeof opts['image-ref'] === 'string' && opts['image-ref'].trim().length > 0
    ? validateImmutableImageRef(opts['image-ref'].trim())
    : '';
  if (targetStatus === 'applied' && !targetImageRef) {
    throw new Error('--image-ref is required when --status applied.');
  }
  if (targetImageRef && targetImageRef !== record.image_ref) {
    throw new Error(`--image-ref ${targetImageRef} does not match current desired release ${record.image_ref}.`);
  }

  const target = {
    ...record.targets[targetId],
    status: targetStatus,
    notes,
    updated_at: changedAt,
  };

  if (targetStatus === 'applied') {
    target.applied_at = target.applied_at ?? changedAt;
    target.applied_image_ref = targetImageRef;
    delete target.failed_at;
  } else if (targetStatus === 'failed') {
    target.failed_at = changedAt;
    delete target.applied_at;
    delete target.applied_image_ref;
  } else {
    delete target.applied_at;
    delete target.failed_at;
    delete target.applied_image_ref;
  }

  record.targets[targetId] = target;
  record.updated_at = changedAt;
  recomputeOverallStatus(record, changedAt);

  const paths = resolveReleaseIntentPaths(envId);
  writeDesired(paths, record);
  appendHistory(paths, record, `mark-target:${targetId}:${targetStatus}`, changedAt);

  console.log(`[ok] Updated ${envId} target ${targetId} -> ${targetStatus}`);
  console.log(`  release: ${record.image_ref}`);
  console.log(`  status:  ${record.status}`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === '--help' || command === 'help') {
    usage();
    return 0;
  }

  const opts = parseArgs(rest);

  try {
    switch (command) {
      case 'set':
        setIntent(opts);
        return 0;
      case 'show':
        showIntent(opts);
        return 0;
      case 'resolve':
        resolveIntentField(opts);
        return 0;
      case 'mark-target':
        markTarget(opts);
        return 0;
      default:
        return die(`Unknown command: ${command}`);
    }
  } catch (error) {
    return die(error instanceof Error ? error.message : String(error));
  }
}

process.exit(main());
