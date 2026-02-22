#!/usr/bin/env node
/**
 * build.mjs — Provider-agnostic packaging entry.
 *
 * Reads docs/packaging/registry.json, validates each target, and either
 * prints a dry-run plan or delegates to docker-build.mjs.
 *
 * Usage:
 *   node ops/packaging/scripts/build.mjs [--dry-run] [--target <id>] [--tag <tag>]
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');

function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--dry-run') { result.dryRun = true; continue; }
    if (a === '--target' && args[i + 1]) { result.target = args[++i]; continue; }
    if (a === '--tag' && args[i + 1]) { result.tag = args[++i]; continue; }
    if (a === '--help') { result.help = true; continue; }
  }
  return result;
}

function loadRegistry() {
  const p = resolve(ROOT, 'docs/packaging/registry.json');
  if (!existsSync(p)) {
    console.error('[error] docs/packaging/registry.json not found');
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, 'utf-8'));
}

function validateTarget(t) {
  const issues = [];
  const df = resolve(ROOT, t.dockerfile);
  if (!existsSync(df)) issues.push(`Dockerfile not found: ${t.dockerfile}`);
  const ctx = resolve(ROOT, t.context || '.');
  if (!existsSync(ctx)) issues.push(`Build context not found: ${t.context}`);
  if (!t.port) issues.push('No port defined');
  return issues;
}

function checkPrerequisites() {
  const checks = [];

  const pkgLock = existsSync(resolve(ROOT, 'pnpm-lock.yaml'));
  checks.push({ name: 'pnpm-lock.yaml', ok: pkgLock });

  const prismaSchema = existsSync(resolve(ROOT, 'prisma/schema.prisma'));
  checks.push({ name: 'prisma/schema.prisma', ok: prismaSchema });

  const viteConfig = existsSync(resolve(ROOT, 'vite.config.ts'));
  checks.push({ name: 'vite.config.ts', ok: viteConfig });

  let dockerAvailable = false;
  try {
    execSync('docker --version', { stdio: 'pipe' });
    dockerAvailable = true;
  } catch { /* no docker */ }
  checks.push({ name: 'docker CLI', ok: dockerAvailable });

  return checks;
}

function printPlan(target, tag, prereqs) {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║        PACKAGING DRY-RUN PLAN            ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`Target:      ${target.id}`);
  console.log(`Type:        ${target.type}`);
  console.log(`Dockerfile:  ${target.dockerfile}`);
  console.log(`Context:     ${target.context || '.'}`);
  console.log(`Tag:         ${tag}`);
  console.log(`Port:        ${target.port}`);
  console.log(`Health:      ${target.healthPath || 'N/A'}`);

  console.log('\nPrerequisites:');
  for (const c of prereqs) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name}`);
  }

  console.log('\nBuild steps (would execute):');
  console.log('  1. docker build -f', target.dockerfile, '-t', tag, target.context || '.');
  console.log('  2. Verify image: docker inspect', tag);
  console.log('  3. (optional) docker push', tag);

  const allOk = prereqs.every(c => c.ok);
  console.log(`\nReady to build: ${allOk ? 'YES' : 'NO (fix prerequisites above)'}`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(`
build.mjs — Packaging build pipeline

Usage:
  node ops/packaging/scripts/build.mjs [options]

Options:
  --dry-run         Show build plan without executing
  --target <id>     Build a specific target (default: all)
  --tag <tag>       Override image tag
  --help            Show this help
`);
    return 0;
  }

  const registry = loadRegistry();

  if (registry.targets.length === 0) {
    console.log('[warn] No packaging targets registered in docs/packaging/registry.json');
    return 0;
  }

  const targets = opts.target
    ? registry.targets.filter(t => t.id === opts.target)
    : registry.targets;

  if (targets.length === 0) {
    console.error(`[error] Target "${opts.target}" not found in registry`);
    return 1;
  }

  const prereqs = checkPrerequisites();
  let exitCode = 0;

  for (const t of targets) {
    const issues = validateTarget(t);
    if (issues.length > 0) {
      console.error(`\n[error] Target "${t.id}" has issues:`);
      for (const i of issues) console.error(`  - ${i}`);
      exitCode = 1;
      continue;
    }

    const tag = opts.tag || `${t.id}:local-dev`;

    if (opts.dryRun) {
      printPlan(t, tag, prereqs);
    } else {
      console.log(`\n[build] ${t.id} → ${tag}`);
      try {
        execSync(
          `node ops/packaging/scripts/docker-build.mjs --dockerfile ${t.dockerfile} --tag ${tag} --context ${t.context || '.'}`,
          { stdio: 'inherit', cwd: ROOT }
        );
        console.log(`[ok] ${t.id} built successfully`);
      } catch {
        console.error(`[error] ${t.id} build failed`);
        exitCode = 1;
      }
    }
  }

  return exitCode;
}

main().then(code => process.exit(code));
