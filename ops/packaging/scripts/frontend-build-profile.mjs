#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const PROFILE_DIR = resolve(ROOT, 'ops/packaging/build-profiles');

export const REQUIRED_LAUNCH_FRONTEND_FLAGS = [
  'VITE_FF_GLOBAL_HIGHLIGHTS_V1',
  'VITE_FF_AUDIENCE_AFTERSHOW_WEB_V1',
  'VITE_FF_AUDIENCE_ZONE_V1',
  'VITE_FF_AFTERSHOW_V1',
  'VITE_FF_ROLE_ASSIGNMENT_V1',
  'VITE_FF_HOME_PROGRAMMING_V1',
  'VITE_FF_PROGRAMMING_OPS_V1',
  'VITE_FF_MULTIMODAL_AGENT_MEDIA_V1',
];

function parseArgs(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = args[index + 1];
    if (next && !next.startsWith('--')) {
      result[key] = next;
      index += 1;
      continue;
    }
    result[key] = true;
  }
  return result;
}

function assertProfileShape(profile, profileId) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error(`Invalid frontend build profile "${profileId}": expected an object`);
  }
  if (profile.version !== 1) {
    throw new Error(`Invalid frontend build profile "${profileId}": version must be 1`);
  }
  if (typeof profile.profile !== 'string' || profile.profile.trim().length === 0) {
    throw new Error(`Invalid frontend build profile "${profileId}": profile is required`);
  }
  if (typeof profile.target !== 'string' || profile.target.trim().length === 0) {
    throw new Error(`Invalid frontend build profile "${profileId}": target is required`);
  }
  const frontendFlags = profile.frontend_flags;
  if (!frontendFlags || typeof frontendFlags !== 'object' || Array.isArray(frontendFlags)) {
    throw new Error(`Invalid frontend build profile "${profileId}": frontend_flags is required`);
  }

  for (const key of REQUIRED_LAUNCH_FRONTEND_FLAGS) {
    const value = frontendFlags[key];
    if (value !== 'true' && value !== 'false') {
      throw new Error(
        `Invalid frontend build profile "${profileId}": ${key} must be "true" or "false"`,
      );
    }
  }

  for (const [key, value] of Object.entries(frontendFlags)) {
    if (!key.startsWith('VITE_FF_')) {
      throw new Error(
        `Invalid frontend build profile "${profileId}": ${key} must start with VITE_FF_`,
      );
    }
    if (value !== 'true' && value !== 'false') {
      throw new Error(
        `Invalid frontend build profile "${profileId}": ${key} must be "true" or "false"`,
      );
    }
  }
}

export function getFrontendBuildProfilePath(profileId) {
  return resolve(PROFILE_DIR, `${profileId}.json`);
}

export function loadFrontendBuildProfile(profileId) {
  const pathname = getFrontendBuildProfilePath(profileId);
  if (!existsSync(pathname)) {
    throw new Error(`Frontend build profile not found: ${profileId}`);
  }

  const parsed = JSON.parse(readFileSync(pathname, 'utf8'));
  assertProfileShape(parsed, profileId);
  return parsed;
}

export function buildFrontendFlagProof(profile) {
  return {
    version: 1,
    profile: profile.profile,
    target: profile.target,
    description: profile.description ?? '',
    frontend_flags: profile.frontend_flags,
  };
}

export function toDockerBuildArgs(profile) {
  const buildArgs = [
    ['FRONTEND_BUILD_PROFILE', profile.profile],
  ];
  for (const [key, value] of Object.entries(profile.frontend_flags)) {
    buildArgs.push([key, value]);
  }
  return buildArgs;
}

export function writeFrontendFlagProof(profileId, outPath) {
  const profile = loadFrontendBuildProfile(profileId);
  const proof = buildFrontendFlagProof(profile);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  return proof;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const profileId = typeof args.profile === 'string' ? args.profile : '';
  const out = typeof args.out === 'string' ? args.out : '';

  if (!profileId || !out) {
    console.error(
      'Usage: node ops/packaging/scripts/frontend-build-profile.mjs --profile <id> --out <path>',
    );
    return 1;
  }

  writeFrontendFlagProof(profileId, resolve(ROOT, out));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code));
}
