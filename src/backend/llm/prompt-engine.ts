import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { LlmMessage } from './types.js'

export interface PromptTemplate {
  prompt_template_id: string
  version: number
  description: string
  system_prompt: string
  user_prompt: string
}

interface PromptRegistryFile {
  version: number
  templates: Array<{
    prompt_template_id: string
    version: number
    description: string
    system_prompt: string
    user_prompt: string
  }>
}

/**
 * Loads prompt templates from the YAML registry and renders them
 * with simple {{variable}} substitution.
 */
export class PromptEngine {
  private templates = new Map<string, PromptTemplate>()

  constructor(registryPath?: string) {
    const path = registryPath ?? this.defaultRegistryPath()
    this.loadRegistry(path)
  }

  render(
    templateId: string,
    variables: Record<string, string>,
  ): LlmMessage[] {
    const tpl = this.templates.get(templateId)
    if (!tpl) {
      throw new Error(`Prompt template not found: ${templateId}`)
    }

    return [
      { role: 'system', content: renderTemplate(tpl.system_prompt, variables) },
      { role: 'user', content: renderTemplate(tpl.user_prompt, variables) },
    ]
  }

  getTemplate(templateId: string): PromptTemplate | undefined {
    return this.templates.get(templateId)
  }

  get templateIds(): string[] {
    return Array.from(this.templates.keys())
  }

  private loadRegistry(path: string): void {
    try {
      const raw = readFileSync(path, 'utf-8')
      const data = parseSimpleYaml(raw) as PromptRegistryFile

      if (!data?.templates) {
        console.warn('[PromptEngine] No templates found in registry')
        return
      }

      for (const t of data.templates) {
        this.templates.set(t.prompt_template_id, {
          prompt_template_id: t.prompt_template_id,
          version: t.version,
          description: t.description,
          system_prompt: t.system_prompt,
          user_prompt: t.user_prompt,
        })
      }

      console.log(`[PromptEngine] Loaded ${this.templates.size} templates`)
    } catch (err) {
      console.warn(`[PromptEngine] Failed to load registry: ${(err as Error).message}`)
    }
  }

  private defaultRegistryPath(): string {
    const here = dirname(fileURLToPath(import.meta.url))
    return resolve(here, '../../../.ai/llm-config/registry/prompt_templates.yaml')
  }
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

/**
 * Minimal YAML subset parser for the prompt template registry.
 * Handles the specific structure we need without a full YAML dependency.
 * For production, consider using a proper YAML parser.
 */
function parseSimpleYaml(raw: string): PromptRegistryFile {
  const templates: PromptRegistryFile['templates'] = []
  let currentTemplate: Record<string, unknown> | null = null
  let currentField: string | null = null
  let multilineBuffer: string[] = []
  let inMultiline = false

  const lines = raw.split('\n')

  function flushMultiline() {
    if (currentTemplate && currentField && multilineBuffer.length > 0) {
      currentTemplate[currentField] = multilineBuffer.join('\n')
    }
    multilineBuffer = []
    inMultiline = false
    currentField = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.trimStart().startsWith('#') || line.trim() === '') {
      if (inMultiline) {
        if (line.trim() === '' && i + 1 < lines.length) {
          const nextLine = lines[i + 1]
          const nextIndent = nextLine.length - nextLine.trimStart().length
          if (nextIndent >= 6) {
            multilineBuffer.push('')
            continue
          }
        }
        if (line.trim() === '') {
          continue
        }
      }
      continue
    }

    const indent = line.length - line.trimStart().length

    if (inMultiline) {
      if (indent >= 6) {
        multilineBuffer.push(line.slice(6))
        continue
      } else {
        flushMultiline()
      }
    }

    const trimmed = line.trim()

    if (trimmed.startsWith('- prompt_template_id:')) {
      if (currentTemplate) {
        templates.push(currentTemplate as PromptRegistryFile['templates'][number])
      }
      currentTemplate = {
        prompt_template_id: trimmed.split(':').slice(1).join(':').trim(),
        version: 1,
        description: '',
        system_prompt: '',
        user_prompt: '',
      }
      continue
    }

    if (!currentTemplate) continue

    if (indent >= 4 && trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':')
      const key = trimmed.slice(0, colonIdx).trim()
      const value = trimmed.slice(colonIdx + 1).trim()

      if (['version', 'description', 'system_prompt', 'user_prompt'].includes(key)) {
        if (value === '|') {
          currentField = key
          inMultiline = true
          multilineBuffer = []
        } else {
          currentTemplate[key] = key === 'version' ? parseInt(value, 10) : value
        }
      }
    }
  }

  if (inMultiline) flushMultiline()
  if (currentTemplate) {
    templates.push(currentTemplate as PromptRegistryFile['templates'][number])
  }

  return { version: 1, templates }
}
