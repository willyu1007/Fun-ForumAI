import { config } from '../lib/config.js'
import {
  MediaEmbeddingGatewayError,
  type MediaEmbeddingGateway,
  type MediaEmbeddingGatewayInput,
  type MediaEmbeddingGatewayResult,
} from './media-embedding-gateway.js'

function resolveEmbeddingEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '')
  const suffix = '/api/v1/services/embeddings/text-embedding/text-embedding'
  return normalized.endsWith(suffix) ? normalized : `${normalized}${suffix}`
}

function extractVector(payload: unknown): number[] | null {
  if (!payload || typeof payload !== 'object') return null
  const output = (payload as { output?: unknown }).output
  if (!output || typeof output !== 'object') return null
  const embeddings = (output as { embeddings?: Array<{ embedding?: number[] }> }).embeddings
  const vector = embeddings?.[0]?.embedding
  return Array.isArray(vector) ? vector.filter((item): item is number => typeof item === 'number') : null
}

export class DashScopeTextEmbeddingGateway implements MediaEmbeddingGateway {
  readonly providerId = 'dashscope-text-embedding'
  readonly modelName = config.mediaRetrieval.textEmbeddingModel

  get isConfigured(): boolean {
    return config.launch.capabilities.mediaRetrievalV1
      && config.mediaRetrieval.dashscopeApiKey.trim().length > 0
  }

  async embed(input: MediaEmbeddingGatewayInput): Promise<MediaEmbeddingGatewayResult> {
    if (!this.isConfigured) {
      throw new MediaEmbeddingGatewayError('media retrieval embedding gateway is not configured', {
        provider_id: this.providerId,
        model_name: this.modelName,
        error_code: 'not_configured',
      })
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.mediaRetrieval.timeoutMs)
    try {
      const response = await fetch(resolveEmbeddingEndpoint(config.mediaRetrieval.dashscopeBaseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.mediaRetrieval.dashscopeApiKey}`,
          'X-DashScope-DataInspection': 'disable',
        },
        body: JSON.stringify({
          model: this.modelName,
          input: {
            texts: [input.text],
          },
          parameters: {
            text_type: input.text_type,
            dimension: config.mediaRetrieval.vectorDimension,
            output_type: config.mediaRetrieval.outputType,
            ...(input.instruct?.trim() ? { instruct: input.instruct.trim() } : {}),
          },
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new MediaEmbeddingGatewayError(
          `dashscope_text_embedding_failed status=${response.status} body=${body.slice(0, 300)}`,
          {
            provider_id: this.providerId,
            model_name: this.modelName,
            error_code: 'http_error',
          },
        )
      }

      const payload = await response.json()
      const vector = extractVector(payload)
      if (!vector || vector.length === 0) {
        throw new MediaEmbeddingGatewayError('dashscope_text_embedding_missing_vector', {
          provider_id: this.providerId,
          model_name: this.modelName,
          error_code: 'missing_vector',
        })
      }
      if (vector.length !== config.mediaRetrieval.vectorDimension) {
        throw new MediaEmbeddingGatewayError(
          `dashscope_text_embedding_unexpected_dimension expected=${config.mediaRetrieval.vectorDimension} actual=${vector.length}`,
          {
            provider_id: this.providerId,
            model_name: this.modelName,
            error_code: 'unexpected_vector_dimension',
          },
        )
      }

      return {
        vector,
        provider_id: this.providerId,
        model_name: this.modelName,
        output_type: config.mediaRetrieval.outputType,
        vector_dimension: vector.length,
        provider_request_summary: {
          endpoint: 'dashscope_native_embedding',
          index_profile_id: input.index_profile_id,
          text_type: input.text_type,
        },
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new MediaEmbeddingGatewayError('dashscope_text_embedding_timeout', {
          cause: error,
          provider_id: this.providerId,
          model_name: this.modelName,
          error_code: 'timeout',
        })
      }
      if (error instanceof MediaEmbeddingGatewayError) {
        throw error
      }
      throw new MediaEmbeddingGatewayError(
        error instanceof Error ? error.message : 'dashscope_text_embedding_failed',
        {
          cause: error,
          provider_id: this.providerId,
          model_name: this.modelName,
          error_code: 'unknown',
        },
      )
    } finally {
      clearTimeout(timer)
    }
  }
}
