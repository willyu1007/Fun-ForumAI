#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../..')

const UI_SPEC_PATHS = {
  tokens: 'ui/tokens/base.json',
  themes: 'ui/tokens/themes/*.json',
  contract: 'ui/contract/contract.json',
  styles_entry: 'ui/styles/ui.css',
  governance_config: 'ui/config/governance.json',
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function buildGovernanceGates(governance) {
  const gates = ['spec_validate']

  if (Object.values(governance.code_rules ?? {}).some(Boolean)) {
    gates.push('code_audit')
  }

  if (governance.tailwind_policy === 'semantic-token-guarded') {
    gates.push('tailwind_semantic_audit')
  }

  if ((governance.feature_css_rules?.disallow_properties?.length ?? 0) > 0) {
    gates.push('feature_css_audit')
  }

  return gates
}

function buildNotes(governance, specVersion) {
  const tailwindBoundary = governance.tailwind_policy === 'semantic-token-guarded'
    ? 'Tailwind utilities are allowed for structure and token-backed semantics, but raw palette hues, named colors, and arbitrary color literals are forbidden.'
    : 'Tailwind usage must follow the active governance policy.'

  const globalVsFeatureCss = (governance.feature_css_rules?.disallow_properties?.length ?? 0) > 0
    ? 'Global UI lives in ui/styles (layers reset/tokens/contract). Feature CSS must stay in @layer feature and must not define visual tokens.'
    : 'Feature CSS rules are policy-defined in ui/config/governance.json.'

  const changePolicy = governance.approvals?.enforce_spec_approval
    ? `Theme changes are ${governance.theme_policy ?? 'policy-defined'}. Contract expansion requires RFC + approval.`
    : `Theme changes are ${governance.theme_policy ?? 'policy-defined'}.`

  return {
    tailwind_boundary: tailwindBoundary,
    global_vs_feature_css: globalVsFeatureCss,
    change_policy: changePolicy,
    spec_version_notes: specVersion.notes ?? null,
  }
}

export function buildUiSpecModel() {
  const baseTokens = readJson(resolve(ROOT, UI_SPEC_PATHS.tokens))
  const contract = readJson(resolve(ROOT, UI_SPEC_PATHS.contract))
  const governance = readJson(resolve(ROOT, UI_SPEC_PATHS.governance_config))
  const specVersion = readJson(resolve(ROOT, 'ui/spec-version.json'))

  const roles = Object.keys(contract.roles ?? {}).sort()
  const themes = readdirSync(resolve(ROOT, 'ui/tokens/themes'))
    .filter((entry) => entry.endsWith('.json'))
    .sort()
    .map((entry) => {
      const themeJson = readJson(resolve(ROOT, 'ui/tokens/themes', entry))
      return String(themeJson.meta?.theme ?? entry.replace('.json', ''))
    })

  const tokensRequiredGroups = Object.keys(baseTokens).filter((key) => key !== 'meta')

  return {
    ui_spec_version: specVersion.ui_spec_version,
    generated_at_utc: specVersion.generated_at_utc,
    tailwind_policy: governance.tailwind_policy,
    theme_policy: governance.theme_policy,
    paths: UI_SPEC_PATHS,
    locked_parameters: {
      contract_roles_count: roles.length,
      tokens_required_groups: tokensRequiredGroups,
      governance_gates: buildGovernanceGates(governance),
    },
    themes,
    roles,
    notes: buildNotes(governance, specVersion),
  }
}
