import { describe, expect, it } from 'vitest'
import { S3StorageAdapter } from '../storage-adapter.js'

describe('S3StorageAdapter', () => {
  it('returns the same-origin media proxy URL when no public base URL is configured', () => {
    const storage = new S3StorageAdapter({
      bucket: 'bucket-forum-stag',
      region: 'us-east-1',
    })

    expect(storage.publicUrl('generated/post cover.png')).toBe(
      '/v1/media/local/generated%2Fpost%20cover.png',
    )
  })

  it('uses the configured public base URL when available', () => {
    const storage = new S3StorageAdapter({
      bucket: 'bucket-forum-stag',
      region: 'us-east-1',
      publicBaseUrl: 'https://cdn.example.test/media/',
    })

    expect(storage.publicUrl('generated/post cover.png')).toBe(
      'https://cdn.example.test/media/generated%2Fpost%20cover.png',
    )
  })
})
