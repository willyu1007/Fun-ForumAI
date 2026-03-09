import { LlmClient } from '../llm/llm-client.js'
import { LLMGateway } from '../llm/llm-gateway.js'
import { PromptEngine } from '../llm/prompt-engine.js'
import { loadLlmRegistryBundle } from '../llm/registry-loader.js'
import { SecretResolver } from '../llm/secret-resolver.js'
import { CredentialBroker } from '../llm/credential-broker.js'
import { UsageLedgerWriter, InMemoryUsageLedgerRepository } from '../llm/usage-ledger.js'
import type { UsageLedgerRepository } from '../llm/usage-ledger.js'
import { createDefaultBudgetChecker } from '../llm/default-budget-checker.js'
import { BudgetGuard } from '../llm/budget-guard.js'
import { InclinationAssetService } from '../services/inclination-asset-service.js'
import { LocalStorageAdapter, S3StorageAdapter, type StorageAdapter } from '../services/storage-adapter.js'
import { VisionSummaryService } from '../services/vision-summary-service.js'
import { config } from '../lib/config.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { AgentConfigRepository } from '../repos/agent-repository.js'
import type { InclinationAssetRepository } from '../repos/inclination-asset-repository.js'
import type { PostMediaRepository } from '../repos/post-media-repository.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'

export function createLlmServices(deps: {
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  inclinationAssetRepo: InclinationAssetRepository
  postMediaRepo: PostMediaRepository
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  usageLedgerRepo?: UsageLedgerRepository
}) {
  const registryBundle = loadLlmRegistryBundle()

  const llmClient = new LlmClient({
    provider: {
      provider_id: config.llm.provider,
      base_url: config.llm.baseUrl,
      api_key: config.llm.apiKey,
      timeout_ms: config.llm.timeoutMs,
      max_retries: config.llm.maxRetries,
    },
    defaults: {
      model: config.llm.model,
      max_tokens: config.llm.maxTokens,
      temperature: config.llm.temperature,
    },
  })

  const promptEngine = new PromptEngine()
  const secretResolver = new SecretResolver()
  const credentialBroker = new CredentialBroker({
    bundle: registryBundle,
    secretResolver,
  })
  const ledgerRepo = deps.usageLedgerRepo ?? new InMemoryUsageLedgerRepository()
  const usageLedger = new UsageLedgerWriter()
  usageLedger.setRepository(ledgerRepo)
  const budgetGuard = new BudgetGuard(createDefaultBudgetChecker(ledgerRepo))
  const llmGateway = new LLMGateway({
    bundle: registryBundle,
    promptEngine,
    llmClient,
    credentialBroker,
    usageLedger,
    budgetGuard,
  })

  const inclinationAssetStorage: StorageAdapter =
    config.inclinationAssets.storageBackend === 's3' &&
    config.inclinationAssets.s3.bucket
      ? new S3StorageAdapter({
          bucket: config.inclinationAssets.s3.bucket,
          region: config.inclinationAssets.s3.region,
          endpoint: config.inclinationAssets.s3.endpoint || undefined,
          forcePathStyle: config.inclinationAssets.s3.forcePathStyle,
          accessKeyId: config.inclinationAssets.s3.accessKeyId || undefined,
          secretAccessKey: config.inclinationAssets.s3.secretAccessKey || undefined,
          publicBaseUrl: config.inclinationAssets.publicBaseUrl || undefined,
        })
      : new LocalStorageAdapter({
          baseDir: config.inclinationAssets.localDir,
        })

  const visionSummaryService = new VisionSummaryService({
    llmGateway,
    agentRepo: deps.agentRepo,
    agentConfigRepo: deps.agentConfigRepo,
    eventRepo: deps.eventRepo,
    agentRunRepo: deps.agentRunRepo,
  })
  const inclinationAssetService = new InclinationAssetService({
    agentRepo: deps.agentRepo,
    inclinationRepo: deps.inclinationAssetRepo,
    postMediaRepo: deps.postMediaRepo,
    storage: inclinationAssetStorage,
    visionSummaryService,
  })

  return {
    llmClient,
    llmGateway,
    promptEngine,
    secretResolver,
    credentialBroker,
    usageLedger,
    usageLedgerRepo: ledgerRepo,
    budgetGuard,
    inclinationAssetService,
  }
}
