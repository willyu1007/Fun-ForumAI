import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LookupAddress } from 'node:dns'
import { InclinationAssetService } from '../inclination-asset-service.js'
import { InMemoryAgentRepository } from '../../repos/agent-repository.js'
import { InMemoryInclinationAssetRepository } from '../../repos/inclination-asset-repository.js'
import { InMemoryPostMediaRepository } from '../../repos/post-media-repository.js'
import type { VisionSummaryService } from '../vision-summary-service.js'

const { lookupMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
}))

vi.mock('node:dns/promises', () => ({
  lookup: lookupMock,
  default: {
    lookup: lookupMock,
  },
}))

function createService() {
  const agentRepo = new InMemoryAgentRepository()
  const inclinationRepo = new InMemoryInclinationAssetRepository()
  const postMediaRepo = new InMemoryPostMediaRepository()

  const ownerUserId = 'owner-1'
  const agent = agentRepo.create({
    owner_id: ownerUserId,
    display_name: 'Inclination Agent',
  })

  const storage = {
    backend: 'local' as const,
    putObject: vi.fn(async ({ key, data, contentType }: { key: string; data: Buffer; contentType: string }) => ({
      key,
      url: `/v1/inclination-assets/media/local/${encodeURIComponent(key)}`,
      contentType,
      size: data.byteLength,
    })),
    getObject: vi.fn(async () => null),
    deleteObject: vi.fn(async () => {}),
    publicUrl: vi.fn((key: string) => `/v1/inclination-assets/media/local/${encodeURIComponent(key)}`),
  }

  const visionSummaryService = {
    build: vi.fn(async () => ({
      theme: 'theme',
      scene: 'scene',
      mood: 'mood',
      discussion_points: ['point-1', 'point-2', 'point-3'],
    })),
  }

  const service = new InclinationAssetService({
    agentRepo,
    inclinationRepo,
    postMediaRepo,
    storage,
    visionSummaryService: visionSummaryService as unknown as VisionSummaryService,
  })

  return { service, ownerUserId, agent }
}

describe('InclinationAssetService', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
    lookupMock.mockReset()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('blocks redirect that targets private network host', async () => {
    const { service, ownerUserId, agent } = createService()
    lookupMock.mockResolvedValue([
      { address: '93.184.216.34', family: 4 } as LookupAddress,
    ])

    globalThis.fetch = vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: 'https://127.0.0.1/internal.png' },
    })) as unknown as typeof fetch

    await expect(service.createFromUrl({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      source_url: 'https://safe.example/image.png',
    })).rejects.toThrow('host is not allowed')
  })

  it('creates asset from upload with valid PNG', async () => {
    const { service, ownerUserId, agent } = createService()
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const padding = Buffer.alloc(100)
    const bytes = Buffer.concat([pngSignature, padding])

    const result = await service.createFromUpload({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      mime_type: 'image/png',
      bytes,
      owner_note: 'test upload',
    })

    expect(result.asset_id).toBeTruthy()
    expect(result.status).toBe('PENDING')
    expect(result.mime_type).toBe('image/png')
    expect(result.owner_note).toBe('test upload')
  })

  it('rejects upload with unsupported MIME type', async () => {
    const { service, ownerUserId, agent } = createService()
    const bytes = Buffer.from('fake data')

    await expect(service.createFromUpload({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      mime_type: 'application/pdf',
      bytes,
    })).rejects.toThrow('unsupported media type')
  })

  it('rejects upload with wrong magic bytes for declared MIME', async () => {
    const { service, ownerUserId, agent } = createService()
    const fakeBytes = Buffer.from('this is not a png file at all, just text')

    await expect(service.createFromUpload({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      mime_type: 'image/png',
      bytes: fakeBytes,
    })).rejects.toThrow('corrupted image file')
  })

  it('rejects upload exceeding 10MB size limit', async () => {
    const { service, ownerUserId, agent } = createService()
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const oversized = Buffer.alloc(11 * 1024 * 1024)
    pngSignature.copy(oversized)

    await expect(service.createFromUpload({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      mime_type: 'image/png',
      bytes: oversized,
    })).rejects.toThrow('media exceeds 10MB limit')
  })

  it('rejects upload from non-owner user', async () => {
    const { service, agent } = createService()
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const bytes = Buffer.concat([pngSignature, Buffer.alloc(100)])

    await expect(service.createFromUpload({
      agent_id: agent.id,
      owner_user_id: 'not-the-owner',
      mime_type: 'image/png',
      bytes,
    })).rejects.toThrow('Not your agent')
  })

  it('rejects oversized remote file using total size from content-range', async () => {
    const { service, ownerUserId, agent } = createService()
    lookupMock.mockResolvedValue([
      { address: '93.184.216.34', family: 4 } as LookupAddress,
    ])

    const fetchMock = vi.fn()
    fetchMock.mockRejectedValueOnce(new Error('HEAD not supported'))
    fetchMock.mockResolvedValueOnce(new Response(Buffer.from([0x00]), {
      status: 206,
      headers: {
        'content-type': 'image/png',
        'content-length': '1',
        'content-range': 'bytes 0-0/20971520',
      },
    }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(service.createFromUrl({
      agent_id: agent.id,
      owner_user_id: ownerUserId,
      source_url: 'https://safe.example/image.png',
    })).rejects.toThrow('media exceeds 10MB limit')
  })
})
