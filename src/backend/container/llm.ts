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
import {
  ArkSeedreamGateway,
  MediaAssetService,
  MediaBindingService,
  MediaGenerationService,
  MediaLifecycleService,
  MediaObservabilityService,
  MediaRolloutControllerService,
  ImagePlannerService,
  MediaProjectionService,
  MediaReuseGovernanceService,
  MediaSemanticService,
  MediaWriteBridge,
  SurfaceMediaPlanningService,
  VisualDirectiveService,
} from '../media/index.js'
import {
  LocalStorageAdapter,
  S3StorageAdapter,
  type StorageAdapter,
} from '../services/storage-adapter.js'
import { config } from '../lib/config.js'
import { resolvePreferredMultimodalModelId } from '../llm/model-preference.js'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { AgentConfigRepository } from '../repos/agent-repository.js'
import type { MediaAssetRepository } from '../repos/media-asset-repository.js'
import type { MediaSemanticSnapshotRepository } from '../repos/media-semantic-snapshot-repository.js'
import type { SceneMediaBindingRepository } from '../repos/scene-media-binding-repository.js'
import type { MediaContextProjectionRepository } from '../repos/media-context-projection-repository.js'
import type { PostMediaRepository } from '../repos/post-media-repository.js'
import type { VisualDirectiveRepository } from '../repos/visual-directive-repository.js'
import type { ImagePlanRepository } from '../repos/image-plan-repository.js'
import type { MediaReusePolicyRepository } from '../repos/media-reuse-policy-repository.js'
import type { MediaGenerationJobRepository } from '../repos/media-generation-job-repository.js'
import type { MediaObservabilityEventRepository } from '../repos/media-observability-event-repository.js'
import type { MediaRolloutControllerOverrideRepository } from '../repos/media-rollout-controller-override-repository.js'
import type { ForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'

export function createLlmServices(deps: {
  agentRepo: AgentRepository
  agentConfigRepo: AgentConfigRepository
  mediaAssetRepo: MediaAssetRepository
  mediaSemanticSnapshotRepo: MediaSemanticSnapshotRepository
  sceneMediaBindingRepo: SceneMediaBindingRepository
  mediaContextProjectionRepo: MediaContextProjectionRepository
  postMediaRepo: PostMediaRepository
  visualDirectiveRepo: VisualDirectiveRepository
  imagePlanRepo: ImagePlanRepository
  mediaReusePolicyRepo: MediaReusePolicyRepository
  mediaGenerationJobRepo: MediaGenerationJobRepository
  mediaObservabilityEventRepo: MediaObservabilityEventRepository
  mediaRolloutControllerOverrideRepo: MediaRolloutControllerOverrideRepository
  forumSceneMetadataRepo: ForumSceneMetadataRepository
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  usageLedgerRepo?: UsageLedgerRepository
}) {
  const registryBundle = loadLlmRegistryBundle()

  const llmClient = new LlmClient({
    provider: {
      provider_id: config.llm.provider,
      base_url: config.llm.baseUrl,
      api_key: '',
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
    config.inclinationAssets.storageBackend === 's3' && config.inclinationAssets.s3.bucket
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

  const mediaSemanticService = new MediaSemanticService({
    llmGateway,
    agentRepo: deps.agentRepo,
    agentConfigRepo: deps.agentConfigRepo,
    eventRepo: deps.eventRepo,
    agentRunRepo: deps.agentRunRepo,
    preferredModelId: resolvePreferredMultimodalModelId(config.llm.model),
  })
  const mediaBindingService = new MediaBindingService({
    sceneMediaBindingRepo: deps.sceneMediaBindingRepo,
  })
  const mediaObservabilityService = new MediaObservabilityService({
    mediaObservabilityEventRepo: deps.mediaObservabilityEventRepo,
  })
  const mediaRolloutControllerService = new MediaRolloutControllerService({
    mediaObservabilityService,
    mediaRolloutControllerOverrideRepo: deps.mediaRolloutControllerOverrideRepo,
  })
  const mediaProjectionService = new MediaProjectionService({
    mediaContextProjectionRepo: deps.mediaContextProjectionRepo,
  })
  const visualDirectiveService = new VisualDirectiveService({
    visualDirectiveRepo: deps.visualDirectiveRepo,
  })
  const mediaReuseGovernanceService = new MediaReuseGovernanceService({
    mediaAssetRepo: deps.mediaAssetRepo,
    mediaSemanticSnapshotRepo: deps.mediaSemanticSnapshotRepo,
    sceneMediaBindingRepo: deps.sceneMediaBindingRepo,
    mediaContextProjectionRepo: deps.mediaContextProjectionRepo,
    mediaReusePolicyRepo: deps.mediaReusePolicyRepo,
    mediaGenerationJobRepo: deps.mediaGenerationJobRepo,
    imagePlanRepo: deps.imagePlanRepo,
    mediaBindingService,
    mediaObservabilityService,
  })
  const imagePlannerService = new ImagePlannerService({
    imagePlanRepo: deps.imagePlanRepo,
    mediaAssetRepo: deps.mediaAssetRepo,
    mediaSemanticSnapshotRepo: deps.mediaSemanticSnapshotRepo,
    sceneMediaBindingRepo: deps.sceneMediaBindingRepo,
    mediaContextProjectionRepo: deps.mediaContextProjectionRepo,
    forumSceneMetadataRepo: deps.forumSceneMetadataRepo,
    mediaProjectionService,
    mediaReuseGovernanceService,
  })
  const mediaWriteBridge = new MediaWriteBridge({
    mediaAssetRepo: deps.mediaAssetRepo,
    mediaSemanticSnapshotRepo: deps.mediaSemanticSnapshotRepo,
    sceneMediaBindingRepo: deps.sceneMediaBindingRepo,
    mediaContextProjectionRepo: deps.mediaContextProjectionRepo,
    postMediaRepo: deps.postMediaRepo,
    imagePlanRepo: deps.imagePlanRepo,
    forumSceneMetadataRepo: deps.forumSceneMetadataRepo,
    storage: inclinationAssetStorage,
    mediaBindingService,
    mediaProjectionService,
    mediaObservabilityService,
  })
  const mediaAssetService = new MediaAssetService({
    mediaAssetRepo: deps.mediaAssetRepo,
    mediaSemanticSnapshotRepo: deps.mediaSemanticSnapshotRepo,
    sceneMediaBindingRepo: deps.sceneMediaBindingRepo,
    mediaContextProjectionRepo: deps.mediaContextProjectionRepo,
    storage: inclinationAssetStorage,
    mediaSemanticService,
    mediaBindingService,
    mediaProjectionService,
    mediaWriteBridge,
    mediaObservabilityService,
  })
  const mediaGenerationGateway = new ArkSeedreamGateway()
  const mediaGenerationService = new MediaGenerationService({
    imagePlanRepo: deps.imagePlanRepo,
    mediaGenerationJobRepo: deps.mediaGenerationJobRepo,
    mediaContextProjectionRepo: deps.mediaContextProjectionRepo,
    mediaAssetService,
    mediaReuseGovernanceService,
    mediaProjectionService,
    gateway: mediaGenerationGateway,
    mediaObservabilityService,
  })
  const surfaceMediaPlanningService = new SurfaceMediaPlanningService({
    visualDirectiveService,
    imagePlannerService,
    mediaProjectionService,
    mediaObservabilityService,
  })
  const mediaLifecycleService = new MediaLifecycleService({
    mediaAssetRepo: deps.mediaAssetRepo,
    sceneMediaBindingRepo: deps.sceneMediaBindingRepo,
    mediaContextProjectionRepo: deps.mediaContextProjectionRepo,
    mediaGenerationJobRepo: deps.mediaGenerationJobRepo,
    postMediaRepo: deps.postMediaRepo,
    mediaSemanticSnapshotRepo: deps.mediaSemanticSnapshotRepo,
    mediaAssetService,
  })
  const inclinationAssetService = new InclinationAssetService({
    agentRepo: deps.agentRepo,
    mediaAssetService,
  })

  return {
    registryBundle,
    llmClient,
    llmGateway,
    promptEngine,
    secretResolver,
    credentialBroker,
    usageLedger,
    usageLedgerRepo: ledgerRepo,
    budgetGuard,
    mediaSemanticService,
    mediaProjectionService,
    mediaObservabilityService,
    mediaRolloutControllerService,
    mediaWriteBridge,
    visualDirectiveService,
    imagePlannerService,
    mediaReuseGovernanceService,
    mediaGenerationGateway,
    mediaGenerationService,
    surfaceMediaPlanningService,
    mediaLifecycleService,
    mediaAssetService,
    inclinationAssetService,
  }
}
