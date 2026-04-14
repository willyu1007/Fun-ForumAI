import {
  MediaGenerationGatewayError,
  type MediaGenerationGateway,
  type MediaGenerationGatewayAttempt,
  type MediaGenerationGatewayInput,
  type MediaGenerationGatewayResult,
} from './media-generation-gateway.js'

interface FallbackMediaGenerationGatewayDeps {
  primary: MediaGenerationGateway
  fallback?: MediaGenerationGateway | null
}

export const MEDIA_GENERATION_FALLBACK_ROUTE_PROVIDER_ID = 'media-generation-fallback'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function buildRouteModelName(deps: FallbackMediaGenerationGatewayDeps): string {
  const fallbackModel = deps.fallback?.modelName?.trim() || 'none'
  return `${deps.primary.modelName}__fallback__${fallbackModel}`
}

function toFailedAttempt(gateway: MediaGenerationGateway, error: unknown): MediaGenerationGatewayAttempt {
  const gatewayError = error instanceof MediaGenerationGatewayError ? error : null
  return {
    provider_id: gatewayError?.provider_id ?? gateway.providerId,
    model_name: gatewayError?.model_name ?? gateway.modelName,
    outcome: 'failed',
    error_message: error instanceof Error ? error.message : 'media_generation_failed',
  }
}

function toSucceededAttempt(
  gateway: MediaGenerationGateway,
  result: MediaGenerationGatewayResult,
): MediaGenerationGatewayAttempt {
  return {
    provider_id: result.provider_id ?? gateway.providerId,
    model_name: result.model_name ?? gateway.modelName,
    outcome: 'succeeded',
  }
}

function buildSummary(
  route: 'primary' | 'fallback' | 'primary_only_failed' | 'fallback_exhausted',
  attempts: MediaGenerationGatewayAttempt[],
  selected: { provider_id: string; model_name: string } | null,
): Record<string, unknown> {
  return {
    route,
    selected_provider_id: selected?.provider_id ?? null,
    selected_model_name: selected?.model_name ?? null,
    attempts,
  }
}

function mergeSummary(
  summary: Record<string, unknown>,
  extra: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!isRecord(extra)) return summary
  const rest = { ...extra }
  delete rest.route
  delete rest.selected_provider_id
  delete rest.selected_model_name
  delete rest.attempts
  return {
    ...rest,
    ...summary,
  }
}

export class FallbackMediaGenerationGateway implements MediaGenerationGateway {
  readonly providerId: string
  readonly modelName: string

  constructor(private readonly deps: FallbackMediaGenerationGatewayDeps) {
    this.providerId = MEDIA_GENERATION_FALLBACK_ROUTE_PROVIDER_ID
    this.modelName = buildRouteModelName(deps)
  }

  get isConfigured(): boolean {
    return this.deps.primary.isConfigured
  }

  async generate(input: MediaGenerationGatewayInput): Promise<MediaGenerationGatewayResult> {
    try {
      const primaryResult = await this.deps.primary.generate(input)
      return {
        ...primaryResult,
        provider_id: primaryResult.provider_id ?? this.deps.primary.providerId,
        model_name: primaryResult.model_name ?? this.deps.primary.modelName,
        provider_request_summary: mergeSummary(
          buildSummary('primary', [toSucceededAttempt(this.deps.primary, primaryResult)], {
            provider_id: primaryResult.provider_id ?? this.deps.primary.providerId,
            model_name: primaryResult.model_name ?? this.deps.primary.modelName,
          }),
          primaryResult.provider_request_summary,
        ),
      }
    } catch (primaryError) {
      const primaryAttempt = toFailedAttempt(this.deps.primary, primaryError)
      const fallback = this.deps.fallback
      if (!fallback?.isConfigured) {
        throw new MediaGenerationGatewayError(primaryAttempt.error_message ?? 'media_generation_failed', {
          cause: primaryError,
          provider_id: this.deps.primary.providerId,
          model_name: this.deps.primary.modelName,
          provider_request_summary: buildSummary('primary_only_failed', [primaryAttempt], null),
        })
      }

      try {
        const fallbackResult = await fallback.generate(input)
        return {
          ...fallbackResult,
          provider_id: fallbackResult.provider_id ?? fallback.providerId,
          model_name: fallbackResult.model_name ?? fallback.modelName,
          provider_request_summary: mergeSummary(
            buildSummary('fallback', [
              primaryAttempt,
              toSucceededAttempt(fallback, fallbackResult),
            ], {
              provider_id: fallbackResult.provider_id ?? fallback.providerId,
              model_name: fallbackResult.model_name ?? fallback.modelName,
            }),
            fallbackResult.provider_request_summary,
          ),
        }
      } catch (fallbackError) {
        const fallbackAttempt = toFailedAttempt(fallback, fallbackError)
        throw new MediaGenerationGatewayError(
          `media_generation_all_attempts_failed primary=${primaryAttempt.error_message ?? 'failed'} fallback=${fallbackAttempt.error_message ?? 'failed'}`,
          {
            cause: fallbackError,
            provider_id: fallback.providerId,
            model_name: fallback.modelName,
            provider_request_summary: buildSummary('fallback_exhausted', [
              primaryAttempt,
              fallbackAttempt,
            ], null),
          },
        )
      }
    }
  }
}
