import type { LlmMessage } from './types.js'
import { config } from '../lib/config.js'
import {
  LLMGatewayContractError,
  type PromptTemplateRef,
} from './gateway-contract.js'
import {
  loadPromptTemplatesRegistry,
  type PromptTemplateRegistryEntry,
  type PromptVariableSchema,
} from './registry-loader.js'

export type PromptTemplate = PromptTemplateRegistryEntry

const PRIVATE_BOUNDARY_OPTIONAL_PLACEHOLDERS: Record<string, string[]> = {
  'agent-private-chat-reply@1': ['layer_showrunner'],
  'agent-proactive-dm-opening@1': ['layer_showrunner'],
}

/**
 * Loads prompt templates from the registry and renders them
 * with simple {{variable}} substitution.
 */
export class PromptEngine {
  private readonly templates = new Map<string, PromptTemplate>()

  constructor(registryPath?: string) {
    this.loadRegistry(registryPath)
  }

  render(
    promptRef: PromptTemplateRef,
    variables: Record<string, string>,
  ): LlmMessage[] {
    const tpl = this.getTemplateOrThrow(promptRef)
    validatePromptVariables(promptRef, tpl.variables_schema, variables)
    validateTemplatePlaceholders(promptRef, tpl, variables)

    return [
      { role: 'system', content: renderTemplate(tpl.system_prompt, variables) },
      { role: 'user', content: renderTemplate(tpl.user_prompt, variables) },
    ]
  }

  getTemplate(promptRef: PromptTemplateRef): PromptTemplate | undefined {
    return this.templates.get(getPromptTemplateKey(promptRef))
  }

  get templateRefs(): PromptTemplateRef[] {
    return Array.from(this.templates.values()).map((template) => ({
      id: template.prompt_template_id,
      version: template.version,
    }))
  }

  private getTemplateOrThrow(promptRef: PromptTemplateRef): PromptTemplate {
    const template = this.getTemplate(promptRef)
    if (!template) {
      throw new LLMGatewayContractError(
        'RegistryResolutionError',
        `Prompt template not found: ${promptRef.id}@${promptRef.version}`,
        { prompt_ref: promptRef },
      )
    }
    return template
  }

  private loadRegistry(registryPath?: string): void {
    const data = loadPromptTemplatesRegistry(registryPath)
    for (const template of data.templates) {
      this.templates.set(
        getPromptTemplateKey({
          id: template.prompt_template_id,
          version: template.version,
        }),
        template,
      )
    }

    if (this.templates.size === 0) {
      throw new LLMGatewayContractError(
        'RegistryResolutionError',
        'Prompt template registry loaded without any templates',
      )
    }

    console.log(`[PromptEngine] Loaded ${this.templates.size} prompt template versions`)
  }
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

function getPromptTemplateKey(promptRef: PromptTemplateRef): string {
  return `${promptRef.id}@${promptRef.version}`
}

function validatePromptVariables(
  promptRef: PromptTemplateRef,
  schema: PromptVariableSchema,
  variables: Record<string, string>,
): void {
  if (schema.type !== 'object') {
    throw new LLMGatewayContractError(
      'PromptValidationError',
      `Prompt variables schema must be an object: ${promptRef.id}@${promptRef.version}`,
      { prompt_ref: promptRef, schema_type: schema.type },
    )
  }

  const missingRequired = schema.required.filter((key) => !hasNonEmptyString(variables[key]))
  if (missingRequired.length > 0) {
    throw new LLMGatewayContractError(
      'PromptValidationError',
      `Missing required prompt variables for ${promptRef.id}@${promptRef.version}: ${missingRequired.join(', ')}`,
      {
        prompt_ref: promptRef,
        missing_required: missingRequired,
      },
    )
  }

  const invalidTypedKeys = Object.entries(schema.properties)
    .filter(([, definition]) => definition.type === 'string')
    .filter(([key]) => key in variables && typeof variables[key] !== 'string')
    .map(([key]) => key)

  if (invalidTypedKeys.length > 0) {
    throw new LLMGatewayContractError(
      'PromptValidationError',
      `Prompt variables must be strings for ${promptRef.id}@${promptRef.version}: ${invalidTypedKeys.join(', ')}`,
      {
        prompt_ref: promptRef,
        invalid_typed_keys: invalidTypedKeys,
      },
    )
  }
}

function validateTemplatePlaceholders(
  promptRef: PromptTemplateRef,
  template: PromptTemplate,
  variables: Record<string, string>,
): void {
  const placeholders = new Set<string>()
  collectPlaceholders(template.system_prompt, placeholders)
  collectPlaceholders(template.user_prompt, placeholders)

  const missingPlaceholders = Array.from(placeholders)
    .filter((key) => !(key in variables))
    .filter((key) => !canOmitPlaceholder(promptRef, key))

  if (missingPlaceholders.length > 0) {
    throw new LLMGatewayContractError(
      'PromptValidationError',
      `Missing prompt placeholders for ${promptRef.id}@${promptRef.version}: ${missingPlaceholders.join(', ')}`,
      {
        prompt_ref: promptRef,
        missing_placeholders: missingPlaceholders,
      },
    )
  }
}

function canOmitPlaceholder(promptRef: PromptTemplateRef, key: string): boolean {
  if (!config.features.privateDirectorBoundaryV1) return false
  const allowlist = PRIVATE_BOUNDARY_OPTIONAL_PLACEHOLDERS[getPromptTemplateKey(promptRef)] ?? []
  return allowlist.includes(key)
}

function collectPlaceholders(template: string, output: Set<string>): void {
  for (const match of template.matchAll(/\{\{(\w+)\}\}/g)) {
    output.add(match[1])
  }
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
