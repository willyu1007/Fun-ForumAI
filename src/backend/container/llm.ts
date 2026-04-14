import { LlmClient } from '../llm/llm-client.js'
import { LLMGateway } from '../llm/llm-gateway.js'
import { PromptEngine } from '../llm/prompt-engine.js'
import { loadLlmRegistryBundle } from '../llm/registry-loader.js'
import { SecretResolver } from '../llm/secret-resolver.js'
import { config } from '../lib/config.js'
import { CredentialBroker } from '../llm/credential-broker.js'
import { UsageLedgerWriter, InMemoryUsageLedgerRepository } from '../llm/usage-ledger.js'
import type { UsageLedgerRepository } from '../llm/usage-ledger.js'
import { createDefaultBudgetChecker } from '../llm/default-budget-checker.js'
import { BudgetGuard } from '../llm/budget-guard.js'
import { MediaAssetControlService } from '../services/media-asset-control-service.js'
import {
  ArkSeedreamGateway,
  DashScopeQwenImageGateway,
  FallbackMediaGenerationGateway,
  MediaAssetService,
  MediaBindingService,
  MediaGenerationService,
  MediaLineageService,
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
import type { MediaLineageEdgeRepository } from '../repos/media-lineage-edge-repository.js'
import type { ForumSceneMetadataRepository } from '../repos/forum-scene-metadata-repository.js'
import type { EventRepository, AgentRunRepository } from '../repos/event-repository.js'
import type { MessageRepository } from '../repos/message-repository.js'

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
  mediaLineageEdgeRepo: MediaLineageEdgeRepository
  forumSceneMetadataRepo: ForumSceneMetadataRepository
  messageRepo: MessageRepository
  eventRepo: EventRepository
  agentRunRepo: AgentRunRepository
  usageLedgerRepo?: UsageLedgerRepository
}) {
  const registryBundle = loadLlmRegistryBundle()

  const llmClient = new LlmClient()

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

  const mediaAssetStorage: StorageAdapter = createMediaAssetStorage()

  const mediaSemanticService = new MediaSemanticService({
    llmGateway,
    promptEngine,
    agentRepo: deps.agentRepo,
    agentConfigRepo: deps.agentConfigRepo,
    eventRepo: deps.eventRepo,
    agentRunRepo: deps.agentRunRepo,
  })
  const mediaLineageService = new MediaLineageService({
    mediaLineageEdgeRepo: deps.mediaLineageEdgeRepo,
  })
  const mediaBindingService = new MediaBindingService({
    sceneMediaBindingRepo: deps.sceneMediaBindingRepo,
    mediaLineageService,
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
    mediaLineageService,
  })
  const visualDirectiveService = new VisualDirectiveService({
    visualDirectiveRepo: deps.visualDirectiveRepo,
    messageRepo: deps.messageRepo,
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
    mediaLineageService,
    storage: mediaAssetStorage,
  })
  const mediaWriteBridge = new MediaWriteBridge({
    mediaAssetRepo: deps.mediaAssetRepo,
    mediaSemanticSnapshotRepo: deps.mediaSemanticSnapshotRepo,
    sceneMediaBindingRepo: deps.sceneMediaBindingRepo,
    mediaContextProjectionRepo: deps.mediaContextProjectionRepo,
    postMediaRepo: deps.postMediaRepo,
    imagePlanRepo: deps.imagePlanRepo,
    forumSceneMetadataRepo: deps.forumSceneMetadataRepo,
    storage: mediaAssetStorage,
    mediaBindingService,
    mediaProjectionService,
    mediaReuseGovernanceService,
    mediaObservabilityService,
    mediaLineageService,
  })
  const mediaAssetService = new MediaAssetService({
    mediaAssetRepo: deps.mediaAssetRepo,
    mediaSemanticSnapshotRepo: deps.mediaSemanticSnapshotRepo,
    sceneMediaBindingRepo: deps.sceneMediaBindingRepo,
    mediaContextProjectionRepo: deps.mediaContextProjectionRepo,
    storage: mediaAssetStorage,
    mediaSemanticService,
    mediaBindingService,
    mediaProjectionService,
    mediaWriteBridge,
    mediaObservabilityService,
    mediaLineageService,
  })
  const mediaGenerationGateway = new FallbackMediaGenerationGateway({
    primary: new ArkSeedreamGateway(),
    fallback: new DashScopeQwenImageGateway(),
  })
  const mediaGenerationService = new MediaGenerationService({
    imagePlanRepo: deps.imagePlanRepo,
    mediaGenerationJobRepo: deps.mediaGenerationJobRepo,
    mediaContextProjectionRepo: deps.mediaContextProjectionRepo,
    mediaSemanticSnapshotRepo: deps.mediaSemanticSnapshotRepo,
    forumSceneMetadataRepo: deps.forumSceneMetadataRepo,
    mediaAssetService,
    mediaReuseGovernanceService,
    mediaProjectionService,
    mediaWriteBridge,
    gateway: mediaGenerationGateway,
    mediaObservabilityService,
    mediaLineageService,
    mediaRolloutControllerService,
  })
  const surfaceMediaPlanningService = new SurfaceMediaPlanningService({
    visualDirectiveService,
    imagePlannerService,
    mediaProjectionService,
    mediaObservabilityService,
    mediaRolloutControllerService,
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
  const mediaAssetControlService = new MediaAssetControlService({
    agentRepo: deps.agentRepo,
    mediaAssetService,
    mediaReuseGovernanceService,
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
    mediaLineageService,
    mediaWriteBridge,
    visualDirectiveService,
    imagePlannerService,
    mediaReuseGovernanceService,
    mediaGenerationGateway,
    mediaGenerationService,
    surfaceMediaPlanningService,
    mediaLifecycleService,
    mediaAssetService,
    mediaAssetControlService,
  }
}

function createMediaAssetStorage(): StorageAdapter {
  if (config.mediaAssets.storageBackend === 's3') {
    if (!config.mediaAssets.s3.bucket) {
      if (config.appEnv === 'staging' || config.appEnv === 'prod') {
        throw new Error(
          `[MediaStorage] MEDIA_STORAGE_BACKEND=s3 requires MEDIA_S3_BUCKET when APP_ENV=${config.appEnv}.`,
        )
      }
    } else {
      return new S3StorageAdapter({
        bucket: config.mediaAssets.s3.bucket,
        region: config.mediaAssets.s3.region,
        endpoint: config.mediaAssets.s3.endpoint || undefined,
        forcePathStyle: config.mediaAssets.s3.forcePathStyle,
        accessKeyId: config.mediaAssets.s3.accessKeyId || undefined,
        secretAccessKey: config.mediaAssets.s3.secretAccessKey || undefined,
        publicBaseUrl: config.mediaAssets.publicBaseUrl || undefined,
      })
    }
  }

  return new LocalStorageAdapter({
    baseDir: config.mediaAssets.localDir,
  })
}
