import { basename, extname } from 'node:path'
import type { StorageAdapter } from '../services/storage-adapter.js'
import { config } from '../lib/config.js'

export interface MediaImportArtifactServiceDeps {
  storage: StorageAdapter
}

export class MediaImportArtifactService {
  constructor(private readonly deps: MediaImportArtifactServiceDeps) {}

  async deleteObjects(keys: string[]): Promise<void> {
    const uniqueKeys = Array.from(new Set(keys.filter(Boolean)))
    await Promise.all(uniqueKeys.map((key) => this.deps.storage.deleteObject(key)))
  }

  async stageRawManifest(input: {
    request_fingerprint: string
    text: string
    format: 'yaml' | 'json'
  }): Promise<string> {
    const key = `${config.mediaInjection.stagingPrefix}/${input.request_fingerprint}/raw-manifest.${input.format}`
    await this.deps.storage.putObject({
      key,
      data: Buffer.from(input.text, 'utf8'),
      contentType: input.format === 'json' ? 'application/json' : 'application/x-yaml',
    })
    return key
  }

  async stageNormalizedManifest(input: {
    request_fingerprint: string
    text: string
  }): Promise<string> {
    const key = `${config.mediaInjection.stagingPrefix}/${input.request_fingerprint}/normalized-manifest.json`
    await this.deps.storage.putObject({
      key,
      data: Buffer.from(input.text, 'utf8'),
      contentType: 'application/json',
    })
    return key
  }

  async stageLocalFile(input: {
    request_fingerprint: string
    item_id: string
    path: string
    bytes: Buffer
    content_type: string
  }): Promise<string> {
    const base = basename(input.path)
    const extension = extname(base)
    const key = `${config.mediaInjection.stagingPrefix}/${input.request_fingerprint}/items/${input.item_id}${extension}`
    await this.deps.storage.putObject({
      key,
      data: input.bytes,
      contentType: input.content_type,
    })
    return key
  }

  async readText(key: string): Promise<string | null> {
    const stored = await this.deps.storage.getObject(key)
    return stored ? stored.data.toString('utf8') : null
  }

  async readBuffer(key: string): Promise<{ data: Buffer; content_type: string } | null> {
    const stored = await this.deps.storage.getObject(key)
    return stored
      ? { data: stored.data, content_type: stored.contentType }
      : null
  }

  async writeResultManifest(jobId: string, payload: Record<string, unknown>): Promise<string> {
    const key = `${config.mediaInjection.artifactPrefix}/${jobId}/result-report.json`
    await this.deps.storage.putObject({
      key,
      data: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
      contentType: 'application/json',
    })
    return key
  }

  async writeFailureLog(jobId: string, payload: Record<string, unknown>): Promise<string> {
    const key = `${config.mediaInjection.artifactPrefix}/${jobId}/failure-log.json`
    await this.deps.storage.putObject({
      key,
      data: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
      contentType: 'application/json',
    })
    return key
  }
}
