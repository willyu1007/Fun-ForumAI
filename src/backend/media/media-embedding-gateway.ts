import type {
  MediaEmbeddingIndexProfileId,
  MediaEmbeddingOutputType,
} from '../repos/types.js'

export interface MediaEmbeddingGatewayInput {
  text: string
  text_type: 'document' | 'query'
  index_profile_id: MediaEmbeddingIndexProfileId
  trace_id: string
  instruct?: string | null
}

export interface MediaEmbeddingGatewayResult {
  vector: number[]
  provider_id: string
  model_name: string
  output_type: MediaEmbeddingOutputType
  vector_dimension: number
  provider_request_summary?: Record<string, unknown> | null
}

export interface MediaEmbeddingGateway {
  readonly providerId: string
  readonly modelName: string
  readonly isConfigured: boolean
  embed(input: MediaEmbeddingGatewayInput): Promise<MediaEmbeddingGatewayResult>
}

export interface MediaEmbeddingGatewayErrorOptions {
  cause?: unknown
  provider_id?: string
  model_name?: string
  error_code?: string | null
  provider_request_summary?: Record<string, unknown> | null
}

export class MediaEmbeddingGatewayError extends Error {
  readonly provider_id: string | null
  readonly model_name: string | null
  readonly error_code: string | null
  readonly provider_request_summary: Record<string, unknown> | null

  constructor(message: string, options: MediaEmbeddingGatewayErrorOptions = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'MediaEmbeddingGatewayError'
    this.provider_id = options.provider_id ?? null
    this.model_name = options.model_name ?? null
    this.error_code = options.error_code ?? null
    this.provider_request_summary = options.provider_request_summary ?? null
  }
}

export function isMediaEmbeddingGatewayError(error: unknown): error is MediaEmbeddingGatewayError {
  return error instanceof MediaEmbeddingGatewayError
}
