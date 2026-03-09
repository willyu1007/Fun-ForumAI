import { randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { AgentRepository } from '../repos/agent-repository.js'
import type { InclinationAssetRepository } from '../repos/inclination-asset-repository.js'
import type { PostMediaRepository } from '../repos/post-media-repository.js'
import type { AgentInclinationAsset } from '../repos/types.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js'
import type { StorageAdapter } from './storage-adapter.js'
import type { VisionSummaryService } from './vision-summary-service.js'

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const URL_PREFLIGHT_TIMEOUT_MS = 10_000
const URL_PREFLIGHT_MAX_REDIRECTS = 5
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const GIF87A_SIGNATURE = Buffer.from('GIF87a', 'ascii')
const GIF89A_SIGNATURE = Buffer.from('GIF89a', 'ascii')
const RIFF_SIGNATURE = Buffer.from('RIFF', 'ascii')
const WEBP_SIGNATURE = Buffer.from('WEBP', 'ascii')

export interface InclinationAssetView {
  asset_id: string
  status: AgentInclinationAsset['status']
  media_url: string
  mime_type: string
  file_size_bytes: number
  owner_note: string | null
  vision_summary: AgentInclinationAsset['vision_summary']
  created_at: string
}

export class InclinationAssetService {
  private readonly pendingLocks = new Map<string, Promise<void>>()

  constructor(
    private readonly deps: {
      agentRepo: AgentRepository
      inclinationRepo: InclinationAssetRepository
      postMediaRepo: PostMediaRepository
      storage: StorageAdapter
      visionSummaryService: VisionSummaryService
    },
  ) {}

  async createFromUrl(input: {
    agent_id: string
    owner_user_id: string
    source_url: string
    owner_note?: string
  }): Promise<InclinationAssetView> {
    const sourceUrl = this.requireHttpsUrl(input.source_url)
    this.assertOwner(input.agent_id, input.owner_user_id)
    const ownerNote = this.normalizeOwnerNote(input.owner_note)

    const preflight = await this.preflightRemoteImage(sourceUrl)
    const summary = await this.deps.visionSummaryService.build({
      agentId: input.agent_id,
      mimeType: preflight.mime_type,
      ownerNote,
      sourceUrl,
    })

    const asset = await this.withAgentPendingLock(input.agent_id, async () => {
      this.deps.inclinationRepo.replacePending(input.agent_id)
      return this.deps.inclinationRepo.create({
        agent_id: input.agent_id,
        owner_user_id: input.owner_user_id,
        source_type: 'URL',
        origin_url: sourceUrl,
        storage_key: null,
        media_url: sourceUrl,
        mime_type: preflight.mime_type,
        file_size_bytes: preflight.file_size_bytes,
        owner_note: ownerNote,
        vision_summary: summary,
        status: 'PENDING',
      })
    })
    return this.toView(asset)
  }

  async createFromUpload(input: {
    agent_id: string
    owner_user_id: string
    owner_note?: string
    original_name?: string
    mime_type: string
    bytes: Buffer
  }): Promise<InclinationAssetView> {
    this.assertOwner(input.agent_id, input.owner_user_id)
    const ownerNote = this.normalizeOwnerNote(input.owner_note)
    this.assertMimeType(input.mime_type)
    this.assertSize(input.bytes.byteLength)
    this.assertImageSignature(input.mime_type, input.bytes)

    const ext = this.extensionFromMime(input.mime_type)
    const key = `${input.agent_id}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${ext}`
    const stored = await this.deps.storage.putObject({
      key,
      data: input.bytes,
      contentType: input.mime_type,
    })

    const summary = await this.deps.visionSummaryService.build({
      agentId: input.agent_id,
      mimeType: input.mime_type,
      ownerNote,
      uploadBuffer: input.bytes,
    })

    const asset = await this.withAgentPendingLock(input.agent_id, async () => {
      this.deps.inclinationRepo.replacePending(input.agent_id)
      return this.deps.inclinationRepo.create({
        agent_id: input.agent_id,
        owner_user_id: input.owner_user_id,
        source_type: 'UPLOAD',
        origin_url: null,
        storage_key: stored.key,
        media_url: stored.url,
        mime_type: input.mime_type,
        file_size_bytes: input.bytes.byteLength,
        owner_note: ownerNote,
        vision_summary: summary,
        status: 'PENDING',
      })
    })
    return this.toView(asset)
  }

  getCurrent(agentId: string, ownerUserId: string): {
    pending: InclinationAssetView | null
    last_consumed: InclinationAssetView | null
  } {
    this.assertOwner(agentId, ownerUserId)
    const pending = this.deps.inclinationRepo.findPendingByAgent(agentId)
    const consumed = this.deps.inclinationRepo.findLastConsumedByAgent(agentId)
    return {
      pending: pending ? this.toView(pending) : null,
      last_consumed: consumed ? this.toView(consumed) : null,
    }
  }

  cancelCurrent(agentId: string, ownerUserId: string): { removed: boolean } {
    this.assertOwner(agentId, ownerUserId)
    const pending = this.deps.inclinationRepo.findPendingByAgent(agentId)
    if (!pending) return { removed: false }
    this.deps.inclinationRepo.update(pending.id, { status: 'CANCELLED' })
    return { removed: true }
  }

  listPendingAgentIds(limit = 100): string[] {
    return this.deps.inclinationRepo.listPendingAgentIds(limit)
  }

  getPendingForAgent(agentId: string): AgentInclinationAsset | null {
    return this.deps.inclinationRepo.findPendingByAgent(agentId)
  }

  attachPostMediaAndConsume(input: {
    asset_id: string
    post_id: string
  }): { linked: boolean } {
    const asset = this.deps.inclinationRepo.findById(input.asset_id)
    if (!asset || asset.status !== 'PENDING') return { linked: false }

    // Mark consumed first to prevent concurrent re-consumption
    this.deps.inclinationRepo.update(asset.id, {
      status: 'CONSUMED',
      consumed_post_id: input.post_id,
      consumed_at: new Date(),
    })

    try {
      this.deps.postMediaRepo.create({
        post_id: input.post_id,
        asset_id: asset.id,
        media_url: asset.media_url,
        mime_type: asset.mime_type,
      })
    } catch (err) {
      this.deps.inclinationRepo.update(asset.id, {
        status: 'PENDING',
        consumed_post_id: null,
        consumed_at: null,
      })
      throw err
    }

    return { linked: true }
  }

  getAssetMediaFile(assetId: string): Promise<{
    mime_type: string
    data: Buffer
  } | null> {
    const asset = this.deps.inclinationRepo.findById(assetId)
    if (!asset || !asset.storage_key) return Promise.resolve(null)
    return this.deps.storage.getObject(asset.storage_key)
      .then((object) => {
        if (!object) return null
        return {
          mime_type: asset.mime_type,
          data: object.data,
        }
      })
  }

  getStoredMediaByKey(storageKey: string): Promise<{
    mime_type: string
    data: Buffer
  } | null> {
    return this.deps.storage.getObject(storageKey)
      .then((object) => {
        if (!object) return null
        return {
          mime_type: object.contentType,
          data: object.data,
        }
      })
  }

  private toView(asset: AgentInclinationAsset): InclinationAssetView {
    return {
      asset_id: asset.id,
      status: asset.status,
      media_url: asset.media_url,
      mime_type: asset.mime_type,
      file_size_bytes: asset.file_size_bytes,
      owner_note: asset.owner_note,
      vision_summary: asset.vision_summary,
      created_at: asset.created_at.toISOString(),
    }
  }

  private assertOwner(agentId: string, ownerUserId: string): void {
    const agent = this.deps.agentRepo.findById(agentId)
    if (!agent) throw new NotFoundError('Agent', agentId)
    if (agent.owner_id !== ownerUserId) {
      throw new ForbiddenError('Not your agent')
    }
  }

  private normalizeOwnerNote(ownerNote: string | undefined): string | null {
    if (!ownerNote) return null
    const value = ownerNote.trim()
    if (!value) return null
    if (value.length > 500) {
      throw new ValidationError('owner_note exceeds 500 chars')
    }
    return value
  }

  private requireHttpsUrl(raw: string): string {
    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      throw new ValidationError('source_url must be a valid URL')
    }
    if (parsed.protocol !== 'https:') {
      throw new ValidationError('source_url must use https')
    }
    if (this.isBlockedHostname(parsed.hostname)) {
      throw new ValidationError('source_url host is not allowed')
    }
    return parsed.toString()
  }

  private async preflightRemoteImage(sourceUrl: string): Promise<{ mime_type: string; file_size_bytes: number }> {
    let meta: { mime_type: string; file_size_bytes: number }

    try {
      const head = await this.fetchWithValidatedRedirects(sourceUrl, { method: 'HEAD' })
      if (!head.ok) {
        throw new ValidationError(`source_url preflight failed with status ${head.status}`)
      }
      meta = this.extractRemoteImageMeta(head.headers)
    } catch {
      const getRes = await this.fetchWithValidatedRedirects(sourceUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
      })
      if (!getRes.ok) {
        throw new ValidationError(`source_url preflight failed with status ${getRes.status}`)
      }
      meta = this.extractRemoteImageMeta(getRes.headers)
    }

    await this.validateRemoteImageSignature(sourceUrl, meta.mime_type)
    return meta
  }

  private async validateRemoteImageSignature(sourceUrl: string, mimeType: string): Promise<void> {
    const SIGNATURE_BYTES = 12
    try {
      const res = await this.fetchWithValidatedRedirects(sourceUrl, {
        method: 'GET',
        headers: { Range: `bytes=0-${SIGNATURE_BYTES - 1}` },
      })
      if (!res.ok && res.status !== 206) return
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length === 0) return
      this.assertImageSignature(mimeType, buf)
    } catch (err) {
      if (err instanceof ValidationError) throw err
    }
  }

  private assertMimeType(mimeType: string): void {
    const normalized = mimeType.toLowerCase()
    if (!ALLOWED_MIME_TYPES.has(normalized)) {
      throw new ValidationError('unsupported media type')
    }
  }

  private assertSize(size: number): void {
    if (!Number.isFinite(size) || size <= 0) {
      throw new ValidationError('invalid media size')
    }
    if (size > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError('media exceeds 10MB limit')
    }
  }

  private assertImageSignature(mimeType: string, bytes: Buffer): void {
    const lower = mimeType.toLowerCase()
    if (lower === 'image/png') {
      if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        throw new ValidationError('corrupted image file')
      }
      return
    }

    if (lower === 'image/gif') {
      if (bytes.length < GIF87A_SIGNATURE.length) {
        throw new ValidationError('corrupted image file')
      }
      const head = bytes.subarray(0, GIF87A_SIGNATURE.length)
      if (!head.equals(GIF87A_SIGNATURE) && !head.equals(GIF89A_SIGNATURE)) {
        throw new ValidationError('corrupted image file')
      }
      return
    }

    if (lower === 'image/webp') {
      if (
        bytes.length < 12
        || !bytes.subarray(0, 4).equals(RIFF_SIGNATURE)
        || !bytes.subarray(8, 12).equals(WEBP_SIGNATURE)
      ) {
        throw new ValidationError('corrupted image file')
      }
      return
    }

    if (lower === 'image/jpeg' || lower === 'image/jpg') {
      if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
        throw new ValidationError('corrupted image file')
      }
    }
  }

  private extensionFromMime(mimeType: string): string {
    switch (mimeType) {
      case 'image/jpeg':
      case 'image/jpg':
        return '.jpg'
      case 'image/png':
        return '.png'
      case 'image/webp':
        return '.webp'
      case 'image/gif':
        return '.gif'
      default:
        return ''
    }
  }

  private isBlockedHostname(hostname: string): boolean {
    const lower = hostname.toLowerCase()
    if (lower === 'localhost' || lower.endsWith('.localhost')) return true
    if (lower.endsWith('.local')) return true
    if (isIP(lower) !== 0) return this.isPrivateAddress(lower)
    return false
  }

  private async withAgentPendingLock<T>(agentId: string, work: () => Promise<T>): Promise<T> {
    const tail = this.pendingLocks.get(agentId) ?? Promise.resolve()
    let release: () => void = () => {}
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    const queueEntry = tail.then(() => current)
    this.pendingLocks.set(agentId, queueEntry)

    await tail
    try {
      return await work()
    } finally {
      release()
      if (this.pendingLocks.get(agentId) === queueEntry) {
        this.pendingLocks.delete(agentId)
      }
    }
  }

  private async fetchWithValidatedRedirects(
    sourceUrl: string,
    init: {
      method: 'HEAD' | 'GET'
      headers?: Record<string, string>
    },
  ): Promise<Response> {
    let currentUrl = sourceUrl
    for (let hop = 0; hop <= URL_PREFLIGHT_MAX_REDIRECTS; hop += 1) {
      await this.assertRemoteUrlSafe(currentUrl)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), URL_PREFLIGHT_TIMEOUT_MS)
      try {
        const response = await fetch(currentUrl, {
          method: init.method,
          headers: init.headers,
          redirect: 'manual',
          signal: controller.signal,
        })

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location')
          if (!location) {
            throw new ValidationError('source_url redirect is missing location')
          }
          const nextUrl = new URL(location, currentUrl)
          if (nextUrl.protocol !== 'https:') {
            throw new ValidationError('source_url must use https')
          }
          currentUrl = nextUrl.toString()
          continue
        }

        return response
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new ValidationError('source_url preflight timeout')
        }
        throw err
      } finally {
        clearTimeout(timer)
      }
    }

    throw new ValidationError('source_url has too many redirects')
  }

  private async assertRemoteUrlSafe(rawUrl: string): Promise<void> {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:') {
      throw new ValidationError('source_url must use https')
    }
    if (this.isBlockedHostname(parsed.hostname)) {
      throw new ValidationError('source_url host is not allowed')
    }
    if (isIP(parsed.hostname) !== 0) {
      return
    }

    const addresses = await lookup(parsed.hostname, { all: true, verbatim: true }).catch(() => [])
    if (addresses.length === 0) {
      throw new ValidationError('source_url host cannot be resolved')
    }
    for (const item of addresses) {
      if (this.isPrivateAddress(item.address)) {
        throw new ValidationError('source_url resolves to private network')
      }
    }
  }

  private extractRemoteImageMeta(headers: Headers): { mime_type: string; file_size_bytes: number } {
    const mimeType = (headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    this.assertMimeType(mimeType)
    const size = this.extractImageSize(headers)
    this.assertSize(size)
    return {
      mime_type: mimeType,
      file_size_bytes: size,
    }
  }

  private extractImageSize(headers: Headers): number {
    const range = headers.get('content-range')
    if (range) {
      const match = range.match(/\/(\d+)$/)
      if (match) {
        const total = Number(match[1])
        if (Number.isFinite(total) && total > 0) {
          return total
        }
      }
    }

    const sizeRaw = headers.get('content-length')
    if (sizeRaw) {
      const size = Number(sizeRaw)
      if (Number.isFinite(size) && size > 0) {
        return size
      }
    }

    throw new ValidationError('invalid media size')
  }

  private isPrivateAddress(address: string): boolean {
    if (isIP(address) === 4) {
      if (address.startsWith('10.')) return true
      if (address.startsWith('127.')) return true
      if (address.startsWith('192.168.')) return true
      const second = Number(address.split('.')[1] ?? '0')
      if (address.startsWith('172.') && second >= 16 && second <= 31) return true
      if (address.startsWith('169.254.')) return true
      return false
    }
    if (isIP(address) === 6) {
      const lower = address.toLowerCase()
      if (lower === '::1') return true
      if (lower.startsWith('fc') || lower.startsWith('fd')) return true
      if (lower.startsWith('fe80:')) return true
      return false
    }
    return false
  }
}
