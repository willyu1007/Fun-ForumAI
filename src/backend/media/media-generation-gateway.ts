import type { CompiledMediaPrompt } from '../repos/types.js'

export interface MediaGenerationGatewayInput {
  compiled_prompt: CompiledMediaPrompt
  trace_id: string
}

export interface MediaGenerationGatewayAttempt {
  provider_id: string
  model_name: string
  outcome: 'succeeded' | 'failed'
  error_message?: string | null
}

export interface MediaGenerationGatewayResult {
  image_url: string
  mime_type: string | null
  provider_id?: string
  model_name?: string
  provider_request_summary?: Record<string, unknown> | null
}

export interface MediaGenerationGateway {
  readonly providerId: string
  readonly modelName: string
  readonly isConfigured: boolean
  generate(input: MediaGenerationGatewayInput): Promise<MediaGenerationGatewayResult>
}

export interface MediaGenerationGatewayErrorOptions {
  cause?: unknown
  provider_id?: string
  model_name?: string
  provider_request_summary?: Record<string, unknown> | null
}

export class MediaGenerationGatewayError extends Error {
  readonly provider_id: string | null
  readonly model_name: string | null
  readonly provider_request_summary: Record<string, unknown> | null

  constructor(message: string, options: MediaGenerationGatewayErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'MediaGenerationGatewayError'
    this.provider_id = options.provider_id ?? null
    this.model_name = options.model_name ?? null
    this.provider_request_summary = options.provider_request_summary ?? null
  }
}

export function isMediaGenerationGatewayError(error: unknown): error is MediaGenerationGatewayError {
  return error instanceof MediaGenerationGatewayError
}
