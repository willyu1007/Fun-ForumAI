import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { config } from '../lib/config.js'
import { createRepositories } from '../container/repos.js'
import { createLlmServices } from '../container/llm.js'
import { disconnectPrisma } from '../persistence/prisma-client.js'

interface CliArgs {
  manifestPath: string
  dryRun: boolean
  apply: boolean
  requestedByType: 'user' | 'agent' | 'system'
  requestedById: string
}

function parseArgs(argv: string[]): CliArgs {
  let manifestPath = ''
  let dryRun = false
  let apply = false
  let requestedByType: CliArgs['requestedByType'] = 'system'
  let requestedById = `cli:${process.env.USER ?? 'unknown'}`

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    const next = argv[index + 1]
    switch (current) {
      case '--manifest':
        manifestPath = next ?? ''
        index += 1
        break
      case '--dry-run':
        dryRun = true
        break
      case '--apply':
        apply = true
        break
      case '--requested-by-type':
        if (next === 'user' || next === 'agent' || next === 'system') {
          requestedByType = next
        }
        index += 1
        break
      case '--requested-by-id':
        requestedById = next ?? requestedById
        index += 1
        break
    }
  }

  if (!manifestPath) {
    throw new Error('media:inject requires --manifest <path>')
  }
  if (dryRun === apply) {
    throw new Error('media:inject requires exactly one of --dry-run or --apply')
  }

  return {
    manifestPath: resolve(manifestPath),
    dryRun,
    apply,
    requestedByType,
    requestedById,
  }
}

function inferFormat(manifestPath: string): 'yaml' | 'json' {
  const extension = extname(manifestPath).toLowerCase()
  if (extension === '.json') return 'json'
  return 'yaml'
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  try {
    const rawManifestText = await readFile(args.manifestPath, 'utf8')
    const format = inferFormat(args.manifestPath)
    const { repos } = await createRepositories(config.db.usePrisma)
    const llm = createLlmServices({
      agentRepo: repos.agentRepo,
      agentConfigRepo: repos.agentConfigRepo,
      mediaAssetRepo: repos.mediaAssetRepo,
      mediaSemanticSnapshotRepo: repos.mediaSemanticSnapshotRepo,
      sceneMediaBindingRepo: repos.sceneMediaBindingRepo,
      mediaContextProjectionRepo: repos.mediaContextProjectionRepo,
      postMediaRepo: repos.postMediaRepo,
      visualDirectiveRepo: repos.visualDirectiveRepo,
      imagePlanRepo: repos.imagePlanRepo,
      mediaReusePolicyRepo: repos.mediaReusePolicyRepo,
      mediaGenerationJobRepo: repos.mediaGenerationJobRepo,
      mediaObservabilityEventRepo: repos.mediaObservabilityEventRepo,
      mediaScenePackRepo: repos.mediaScenePackRepo,
      mediaRolloutControllerOverrideRepo: repos.mediaRolloutControllerOverrideRepo,
      mediaLineageEdgeRepo: repos.mediaLineageEdgeRepo,
      mediaCatalogCardRepo: repos.mediaCatalogCardRepo,
      mediaRetrievalDocumentRepo: repos.mediaRetrievalDocumentRepo,
      mediaEmbeddingSnapshotRepo: repos.mediaEmbeddingSnapshotRepo,
      mediaRetrievalSearchRepo: repos.mediaRetrievalSearchRepo,
      mediaDuplicateClusterRepo: repos.mediaDuplicateClusterRepo,
      mediaImportJobRepo: repos.mediaImportJobRepo,
      mediaImportJobItemRepo: repos.mediaImportJobItemRepo,
      forumSceneMetadataRepo: repos.forumSceneMetadataRepo,
      messageRepo: repos.messageRepo,
      eventRepo: repos.eventRepo,
      agentRunRepo: repos.agentRunRepo,
    })

    if (args.dryRun) {
      const result = await llm.mediaInjectionService.dryRun({
        manifest_path: args.manifestPath,
        raw_manifest_text: rawManifestText,
        format,
      })
      console.log(JSON.stringify({
        mode: 'dry-run',
        ...result,
      }, null, 2))
      return
    }

    const job = await llm.mediaInjectionService.stageApply({
      manifest_path: args.manifestPath,
      raw_manifest_text: rawManifestText,
      format,
      requested_by_type: args.requestedByType,
      requested_by_id: args.requestedById,
    })
    console.log(JSON.stringify({
      mode: 'apply',
      job_id: job.id,
      status: job.status,
      request_fingerprint: job.request_fingerprint,
      intent_fingerprint: job.intent_fingerprint,
      total_items: job.total_items,
    }, null, 2))
  } finally {
    if (config.db.usePrisma) {
      await disconnectPrisma()
    }
  }
}

await main()
