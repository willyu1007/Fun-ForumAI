import type { AspectRatioHint } from '../repos/types.js'

export interface MediaGenerationGatewayInput {
  prompt_brief: string
  style_hint?: string | null
  aspect_ratio_hint?: AspectRatioHint | null
  trace_id: string
}

export interface MediaGenerationGatewayResult {
  image_url: string
  mime_type: string | null
}

export interface MediaGenerationGateway {
  readonly providerId: string
  readonly modelName: string
  readonly isConfigured: boolean
  generate(input: MediaGenerationGatewayInput): Promise<MediaGenerationGatewayResult>
}
