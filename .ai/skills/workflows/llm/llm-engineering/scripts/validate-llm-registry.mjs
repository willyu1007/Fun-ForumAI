#!/usr/bin/env node

/**
 * LLM Registry Validator
 *
 * Validates the repo's LLM SSOT registries under:
 *   .ai/llm-config/registry/*
 *
 * Usage:
 *   node .ai/skills/workflows/llm/llm-engineering/scripts/validate-llm-registry.mjs
 *   node .../validate-llm-registry.mjs --strict
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_TIERS = new Set(['lite', 'base', 'premium']);
const VALID_VISIBILITIES = new Set(['visible', 'hidden', 'identity_write', 'dev_only']);
const VALID_INTENTS = new Set([
  'forum_reply',
  'chat_reply',
  'scheduled_post',
  'private_reply',
  'proactive_opening',
  'public_observation_digest',
  'private_digest',
  'vision_summary',
  'identity_write',
  'director_plan',
]);
const VALID_FALLBACK_LEVELS = new Set([
  'same-line',
  'same-family',
  'cross-family-hidden',
  'rare-reanchor',
]);
const VALID_QUALITY_CLASSES = new Set(['fast', 'balanced', 'premium']);

const colors = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
};

function die(msg) {
  console.error(colors.red(msg));
  process.exit(1);
}

function warn(msg) {
  console.warn(colors.yellow(msg));
}

function main() {
  const strict = process.argv.includes('--strict');

  console.log(colors.cyan('========================================'));
  console.log(colors.cyan('  LLM Registry Validator'));
  console.log(colors.cyan('========================================'));
  console.log(colors.gray(`Mode: ${strict ? 'STRICT (template placeholders are errors)' : 'STANDARD (template placeholders are warnings)'}`));
  console.log('');

  const repoRoot = findRepoRoot(__dirname);
  if (!repoRoot) {
    die('Unable to locate repo root (expected `.ai/llm-config/registry/config_keys.yaml`).');
  }

  const registryDir = path.join(repoRoot, '.ai', 'llm-config', 'registry');
  const validVoiceLineIds = loadVoiceLineIds(repoRoot);
  const files = {
    providers: path.join(registryDir, 'providers.yaml'),
    profiles: path.join(registryDir, 'model_profiles.yaml'),
    prompts: path.join(registryDir, 'prompt_templates.yaml'),
    configKeys: path.join(registryDir, 'config_keys.yaml'),
  };

  for (const [key, filePath] of Object.entries(files)) {
    if (!fs.existsSync(filePath)) {
      die(`Missing registry file: ${path.relative(repoRoot, filePath)} (${key})`);
    }
  }

  const rawProviders = readYamlFile(files.providers, 'providers.yaml');
  const rawProfiles = readYamlFile(files.profiles, 'model_profiles.yaml');
  const rawPrompts = readYamlFile(files.prompts, 'prompt_templates.yaml');
  const rawConfig = readFileSafe(files.configKeys);

  if (!rawConfig) {
    die('Failed to read config_keys.yaml');
  }

  const providers = parseRegistry(rawProviders, 'providers.yaml');
  const profiles = parseRegistry(rawProfiles, 'model_profiles.yaml');
  const prompts = parseRegistry(rawPrompts, 'prompt_templates.yaml');

  validateVersion(providers, 'providers.yaml');
  validateVersion(profiles, 'model_profiles.yaml');
  validateVersion(prompts, 'prompt_templates.yaml');
  validateConfigVersion(rawConfig);

  validateProviders(providers);
  validateProfiles(profiles, providers, validVoiceLineIds);
  validatePromptTemplates(prompts);
  validateTemplateMode(strict, rawProviders, rawProfiles, rawPrompts, rawConfig);

  const providerIds = providers.providers.map((entry) => entry.provider_id);
  const profileIds = profiles.profiles.map((entry) => entry.profile_id);
  const promptPairs = prompts.templates.map((entry) => `${entry.prompt_template_id}@${entry.version}`);
  const configKeys = parseConfigKeys(rawConfig);

  console.log(colors.gray(`Registry dir: ${path.relative(repoRoot, registryDir)}`));
  console.log(colors.gray(`Providers: ${providerIds.length}`));
  console.log(colors.gray(`Profiles: ${profileIds.length}`));
  console.log(colors.gray(`Prompt templates: ${promptPairs.length}`));
  console.log(colors.gray(`Config keys: ${configKeys.length}`));
  console.log('');
  console.log(colors.green('OK: registries are structurally and contractually valid.'));
}

function validateProviders(doc) {
  assertArray(doc.providers, 'providers.yaml providers');
  const providerIds = [];

  for (const provider of doc.providers) {
    assertObject(provider, 'provider entry');
    const providerId = requireNonEmptyString(provider.provider_id, 'provider_id');
    providerIds.push(providerId);
    requireNonEmptyString(provider.display_name, `providers.${providerId}.display_name`);
    requireOneOf(provider.gateway_kind, ['openai_compatible', 'native'], `providers.${providerId}.gateway_kind`);

    assertObject(provider.auth, `providers.${providerId}.auth`);
    requireOneOf(provider.auth.type, ['api_key'], `providers.${providerId}.auth.type`);
    requireBoolean(provider.auth.credential_ref_required, `providers.${providerId}.auth.credential_ref_required`);
    requireNonEmptyString(provider.auth.credential_ref, `providers.${providerId}.auth.credential_ref`);

    assertObject(provider.routing, `providers.${providerId}.routing`);
    assertArray(provider.routing.regions, `providers.${providerId}.routing.regions`);
    if (provider.routing.regions.length === 0) {
      die(`providers.${providerId}.routing.regions must contain at least one region`);
    }
    provider.routing.regions.forEach((region, index) => {
      requireNonEmptyString(region, `providers.${providerId}.routing.regions[${index}]`);
    });
    const defaultRegion = requireNonEmptyString(provider.routing.default_region, `providers.${providerId}.routing.default_region`);
    if (!provider.routing.regions.includes(defaultRegion)) {
      die(`providers.${providerId}.routing.default_region must be listed in routing.regions`);
    }

    assertObject(provider.capabilities, `providers.${providerId}.capabilities`);
    requireBoolean(provider.capabilities.chat, `providers.${providerId}.capabilities.chat`);
    requireBoolean(provider.capabilities.json_mode, `providers.${providerId}.capabilities.json_mode`);
    requireBoolean(provider.capabilities.tool_calling, `providers.${providerId}.capabilities.tool_calling`);
    requireBoolean(provider.capabilities.streaming, `providers.${providerId}.capabilities.streaming`);

    assertObject(provider.defaults, `providers.${providerId}.defaults`);
    requirePositiveInteger(provider.defaults.timeout_ms, `providers.${providerId}.defaults.timeout_ms`);
    requireNonNegativeInteger(provider.defaults.max_retries, `providers.${providerId}.defaults.max_retries`);
  }

  assertUnique(providerIds, 'provider_id');
}

function validateProfiles(doc, providersDoc, validVoiceLineIds) {
  assertArray(doc.profiles, 'model_profiles.yaml profiles');
  const profileIds = [];
  const providersById = new Map(providersDoc.providers.map((entry) => [entry.provider_id, entry]));

  for (const profile of doc.profiles) {
    assertObject(profile, 'profile entry');
    const profileId = requireNonEmptyString(profile.profile_id, 'profile_id');
    profileIds.push(profileId);

    const voiceLineId = requireNonEmptyString(profile.voice_line_id, `profiles.${profileId}.voice_line_id`);
    if (!validVoiceLineIds.has(voiceLineId)) {
      die(`profiles.${profileId}.voice_line_id must be one of: ${Array.from(validVoiceLineIds).join(', ')}`);
    }

    const tier = requireNonEmptyString(profile.tier, `profiles.${profileId}.tier`);
    if (!VALID_TIERS.has(tier)) {
      die(`profiles.${profileId}.tier must be one of: ${Array.from(VALID_TIERS).join(', ')}`);
    }

    const intent = requireNonEmptyString(profile.intent, `profiles.${profileId}.intent`);
    if (!VALID_INTENTS.has(intent)) {
      die(`profiles.${profileId}.intent must be one of: ${Array.from(VALID_INTENTS).join(', ')}`);
    }

    const visibility = requireNonEmptyString(profile.visibility, `profiles.${profileId}.visibility`);
    if (!VALID_VISIBILITIES.has(visibility)) {
      die(`profiles.${profileId}.visibility must be one of: ${Array.from(VALID_VISIBILITIES).join(', ')}`);
    }
    if (visibility === 'dev_only') {
      die(`profiles.${profileId}.visibility cannot be dev_only in model_profiles.yaml`);
    }

    if (voiceLineId === 'deepseek-director-v1' && visibility !== 'hidden') {
      die(`profiles.${profileId} uses director line ${voiceLineId} but visibility is not hidden`);
    }
    if (visibility === 'identity_write' && intent !== 'identity_write') {
      die(`profiles.${profileId} visibility=identity_write requires intent=identity_write`);
    }

    assertArray(profile.candidates, `profiles.${profileId}.candidates`);
    if (profile.candidates.length === 0) {
      die(`profiles.${profileId}.candidates must contain at least one candidate`);
    }

    for (const [index, candidate] of profile.candidates.entries()) {
      assertObject(candidate, `profiles.${profileId}.candidates[${index}]`);
      const providerId = requireNonEmptyString(candidate.provider_id, `profiles.${profileId}.candidates[${index}].provider_id`);
      const provider = providersById.get(providerId);
      if (!provider) {
        die(`profiles.${profileId} references unknown provider_id ${providerId}`);
      }
      requireNonEmptyString(candidate.model_id, `profiles.${profileId}.candidates[${index}].model_id`);
      const region = requireNonEmptyString(candidate.region, `profiles.${profileId}.candidates[${index}].region`);
      if (!provider.routing.regions.includes(region)) {
        die(`profiles.${profileId}.candidates[${index}].region=${region} is not allowed for provider ${providerId}`);
      }
      requireNonEmptyString(candidate.endpoint_id, `profiles.${profileId}.candidates[${index}].endpoint_id`);
      requirePositiveNumber(candidate.weight, `profiles.${profileId}.candidates[${index}].weight`);
      requireOneOf(candidate.quality_class, Array.from(VALID_QUALITY_CLASSES), `profiles.${profileId}.candidates[${index}].quality_class`);
    }

    assertArray(profile.fallback, `profiles.${profileId}.fallback`);
    for (const [index, fallback] of profile.fallback.entries()) {
      assertObject(fallback, `profiles.${profileId}.fallback[${index}]`);
      requireOneOf(fallback.level, Array.from(VALID_FALLBACK_LEVELS), `profiles.${profileId}.fallback[${index}].level`);
      requireNonEmptyString(fallback.reason, `profiles.${profileId}.fallback[${index}].reason`);
      if (fallback.profile_id !== undefined) {
        requireNonEmptyString(fallback.profile_id, `profiles.${profileId}.fallback[${index}].profile_id`);
      }
      if (fallback.provider_id !== undefined) {
        requireNonEmptyString(fallback.provider_id, `profiles.${profileId}.fallback[${index}].provider_id`);
      }
      if (fallback.model_id !== undefined) {
        requireNonEmptyString(fallback.model_id, `profiles.${profileId}.fallback[${index}].model_id`);
      }
    }
  }

  assertUnique(profileIds, 'profile_id');

  const profileIdSet = new Set(profileIds);
  for (const profile of doc.profiles) {
    for (const fallback of profile.fallback) {
      if (fallback.profile_id && !profileIdSet.has(fallback.profile_id)) {
        die(`profiles.${profile.profile_id} fallback references unknown profile_id ${fallback.profile_id}`);
      }
    }
  }
}

function loadVoiceLineIds(repoRoot) {
  const personaCatalogPath = path.join(repoRoot, 'src', 'shared', 'agent-persona-catalog.ts');
  const raw = readFileSafe(personaCatalogPath);
  if (!raw) {
    die('Failed to read src/shared/agent-persona-catalog.ts');
  }

  const match = raw.match(/export const VOICE_LINE_IDS = \[([\s\S]*?)\] as const/u);
  if (!match) {
    die('Unable to parse VOICE_LINE_IDS from src/shared/agent-persona-catalog.ts');
  }

  const ids = Array.from(match[1].matchAll(/'([^']+)'/g), (entry) => entry[1]);
  if (ids.length === 0) {
    die('VOICE_LINE_IDS in src/shared/agent-persona-catalog.ts is empty');
  }

  return new Set(ids);
}

function validatePromptTemplates(doc) {
  assertArray(doc.templates, 'prompt_templates.yaml templates');
  const promptPairs = [];

  for (const template of doc.templates) {
    assertObject(template, 'prompt template entry');
    const templateId = requireNonEmptyString(template.prompt_template_id, 'prompt_template_id');
    const version = requirePositiveInteger(template.version, `templates.${templateId}.version`);
    promptPairs.push(`${templateId}@${version}`);
    requireNonEmptyString(template.description, `templates.${templateId}.description`);
    requireNonEmptyString(template.system_prompt, `templates.${templateId}.system_prompt`);
    requireNonEmptyString(template.user_prompt, `templates.${templateId}.user_prompt`);

    assertObject(template.variables_schema, `templates.${templateId}.variables_schema`);
    if (template.variables_schema.type !== 'object') {
      die(`templates.${templateId}.variables_schema.type must be "object"`);
    }

    assertObject(template.variables_schema.properties, `templates.${templateId}.variables_schema.properties`);
    const propertyKeys = Object.keys(template.variables_schema.properties);
    if (propertyKeys.length === 0) {
      die(`templates.${templateId}.variables_schema.properties must define at least one key`);
    }

    for (const key of propertyKeys) {
      assertObject(template.variables_schema.properties[key], `templates.${templateId}.variables_schema.properties.${key}`);
      if (template.variables_schema.properties[key].type !== 'string') {
        die(`templates.${templateId}.variables_schema.properties.${key}.type must be "string"`);
      }
    }

    assertArray(template.variables_schema.required, `templates.${templateId}.variables_schema.required`);
    for (const requiredKey of template.variables_schema.required) {
      requireNonEmptyString(requiredKey, `templates.${templateId}.variables_schema.required[]`);
      if (!propertyKeys.includes(requiredKey)) {
        die(`templates.${templateId}.variables_schema.required references undeclared property ${requiredKey}`);
      }
    }

    const placeholders = collectTemplatePlaceholders(template.system_prompt, template.user_prompt);
    for (const placeholder of placeholders) {
      if (!propertyKeys.includes(placeholder)) {
        die(`templates.${templateId}@${version} uses undeclared placeholder ${placeholder}`);
      }
    }
  }

  assertUnique(promptPairs, 'prompt_template_id@version');
}

function validateTemplateMode(strict, ...rawFiles) {
  const warnings = [];
  const labels = ['providers.yaml', 'model_profiles.yaml', 'prompt_templates.yaml', 'config_keys.yaml'];

  rawFiles.forEach((raw, index) => {
    if (hasTemplateHeader(raw)) {
      warnings.push(`${labels[index]} header still marked as (template)`);
    }
  });

  const placeholderIds = [];
  const placeholderPattern = /^example\-/i;

  const providers = parseRegistry(rawFiles[0], 'providers.yaml');
  providers.providers.forEach((entry) => {
    if (placeholderPattern.test(entry.provider_id)) {
      placeholderIds.push(`provider_id:${entry.provider_id}`);
    }
  });

  const profiles = parseRegistry(rawFiles[1], 'model_profiles.yaml');
  profiles.profiles.forEach((entry) => {
    if (placeholderPattern.test(entry.profile_id)) {
      placeholderIds.push(`profile_id:${entry.profile_id}`);
    }
  });

  const prompts = parseRegistry(rawFiles[2], 'prompt_templates.yaml');
  prompts.templates.forEach((entry) => {
    if (placeholderPattern.test(entry.prompt_template_id)) {
      placeholderIds.push(`prompt_template_id:${entry.prompt_template_id}`);
    }
  });

  if (placeholderIds.length) {
    warnings.push(`placeholder identifiers present: ${Array.from(new Set(placeholderIds)).join(', ')}`);
  }

  if (warnings.length === 0) {
    return;
  }

  if (strict) {
    die(`Registry still in TEMPLATE mode:\n- ${warnings.join('\n- ')}\n\nFix: replace placeholders with real org/project data (and remove "(template)" markers).`);
  }

  console.log('');
  warn('Registry appears to be in TEMPLATE mode (this is fine for the template repo, but not for production):');
  warnings.forEach((item) => warn(`- ${item}`));
  console.log(colors.gray('Tip: run with `--strict` in CI to prevent shipping template registries.'));
}

function validateVersion(doc, fileName) {
  if (!Number.isInteger(doc.version) || doc.version <= 0) {
    die(`${fileName} missing top-level \`version: <int>\``);
  }
}

function validateConfigVersion(rawConfig) {
  const match = rawConfig.match(/^\s*version\s*:\s*([0-9]+)\s*$/m);
  if (!match) {
    die('config_keys.yaml missing top-level `version: <int>`');
  }
}

function parseConfigKeys(raw) {
  const keys = [];
  let mode = null;

  raw.replace(/\r\n/g, '\n').split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    if (trimmed === 'keys:') {
      mode = 'keys';
      return;
    }
    if (trimmed === 'scope_prefixes:') {
      mode = 'scope_prefixes';
      return;
    }
    const match = trimmed.match(/^\-\s*(.+)\s*$/);
    if (!match) return;
    if (mode === 'keys') {
      keys.push(match[1].replace(/^['"]|['"]$/g, ''));
    }
  });

  return keys;
}

function collectTemplatePlaceholders(...templates) {
  const placeholders = new Set();
  templates.forEach((template) => {
    for (const match of String(template).matchAll(/\{\{(\w+)\}\}/g)) {
      placeholders.add(match[1]);
    }
  });
  return placeholders;
}

function assertUnique(values, label) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) {
    die(`Duplicate ${label}(s): ${Array.from(new Set(duplicates)).join(', ')}`);
  }
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    die(`${label} must be a positive integer`);
  }
  return value;
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    die(`${label} must be a non-negative integer`);
  }
  return value;
}

function requirePositiveNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    die(`${label} must be a positive number`);
  }
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') {
    die(`${label} must be a boolean`);
  }
}

function requireOneOf(value, choices, label) {
  if (!choices.includes(value)) {
    die(`${label} must be one of: ${choices.join(', ')}`);
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    die(`${label} must be a non-empty string`);
  }
  return value;
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    die(`${label} must be an array`);
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    die(`${label} must be an object`);
  }
}

function parseRegistry(raw, fileName) {
  try {
    return parseYaml(raw);
  } catch (error) {
    die(`Failed to parse ${fileName}: ${error instanceof Error ? error.message : 'Unknown YAML parse error'}`);
  }
}

function readYamlFile(filePath, label) {
  const raw = readFileSafe(filePath);
  if (!raw) {
    die(`Failed to read ${label}`);
  }
  return raw;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function findRepoRoot(startDir) {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, '.ai', 'llm-config', 'registry', 'config_keys.yaml');
    if (fs.existsSync(candidate)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function hasTemplateHeader(raw) {
  const head = raw.split(/\r?\n/).slice(0, 5).join('\n');
  return head.toLowerCase().includes('(template)');
}

main();
