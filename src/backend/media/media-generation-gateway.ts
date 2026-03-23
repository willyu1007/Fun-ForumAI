import type { CompiledMediaPrompt } from '../repos/types.js'

export interface MediaGenerationGatewayInput {
  compiled_prompt: CompiledMediaPrompt
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
