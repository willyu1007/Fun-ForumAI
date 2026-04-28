import { describe, expect, it } from 'vitest'
import { resolveBrowserMediaUrl } from '../media-url.js'

describe('resolveBrowserMediaUrl', () => {
  it('maps persisted s3 URLs to the same-origin media proxy', () => {
    expect(resolveBrowserMediaUrl('s3://bucket-forum-stag/generated/post cover.png')).toBe(
      '/v1/media/local/generated%2Fpost%20cover.png',
    )
  })

  it('keeps browser-loadable URLs unchanged', () => {
    expect(resolveBrowserMediaUrl('/v1/media/local/generated%2Fpost.png')).toBe(
      '/v1/media/local/generated%2Fpost.png',
    )
    expect(resolveBrowserMediaUrl('https://cdn.example.test/generated/post.png')).toBe(
      'https://cdn.example.test/generated/post.png',
    )
  })
})
