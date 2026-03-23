import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

export interface PutObjectInput {
  key: string
  data: Buffer
  contentType: string
}

export interface StoredObject {
  key: string
  url: string
  contentType: string
  size: number
}

export interface RetrievedObject {
  data: Buffer
  contentType: string
  size: number
}

export interface StorageAdapter {
  backend: 'local' | 's3'
  putObject(input: PutObjectInput): Promise<StoredObject>
  getObject(key: string): Promise<RetrievedObject | null>
  deleteObject(key: string): Promise<void>
  publicUrl(key: string): string
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly backend = 'local' as const
  private readonly baseDir: string
  private readonly publicPathPrefix: string

  constructor(opts: { baseDir: string; publicPathPrefix?: string }) {
    this.baseDir = resolve(process.cwd(), opts.baseDir)
    this.publicPathPrefix = opts.publicPathPrefix ?? '/v1/media/local'
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const filePath = this.toFilePath(input.key)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, input.data)
    return {
      key: input.key,
      url: this.publicUrl(input.key),
      contentType: input.contentType,
      size: input.data.byteLength,
    }
  }

  async getObject(key: string): Promise<RetrievedObject | null> {
    try {
      const filePath = this.toFilePath(key)
      const [meta, data] = await Promise.all([stat(filePath), readFile(filePath)])
      return {
        data,
        contentType: this.inferContentType(key),
        size: meta.size,
      }
    } catch {
      return null
    }
  }

  async deleteObject(key: string): Promise<void> {
    const filePath = this.toFilePath(key)
    await rm(filePath, { force: true })
  }

  publicUrl(key: string): string {
    return `${this.publicPathPrefix}/${encodeURIComponent(key)}`
  }

  private toFilePath(key: string): string {
    const normalizedKey = key.replace(/^\/+/, '')
    const filePath = resolve(this.baseDir, normalizedKey)
    const basePrefix = this.baseDir.endsWith(sep) ? this.baseDir : `${this.baseDir}${sep}`
    if (filePath !== this.baseDir && !filePath.startsWith(basePrefix)) {
      throw new Error('Invalid storage key')
    }
    return filePath
  }

  private inferContentType(key: string): string {
    const lower = key.toLowerCase()
    if (lower.endsWith('.png')) return 'image/png'
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
    if (lower.endsWith('.webp')) return 'image/webp'
    if (lower.endsWith('.gif')) return 'image/gif'
    return 'application/octet-stream'
  }
}

export class S3StorageAdapter implements StorageAdapter {
  readonly backend = 's3' as const
  private readonly client: S3Client
  private readonly bucket: string
  private readonly publicBaseUrl: string

  constructor(opts: {
    bucket: string
    region: string
    endpoint?: string
    forcePathStyle?: boolean
    accessKeyId?: string
    secretAccessKey?: string
    publicBaseUrl?: string
  }) {
    this.bucket = opts.bucket
    this.publicBaseUrl = opts.publicBaseUrl?.replace(/\/+$/, '') ?? ''

    this.client = new S3Client({
      region: opts.region,
      endpoint: opts.endpoint || undefined,
      forcePathStyle: opts.forcePathStyle ?? false,
      credentials: opts.accessKeyId && opts.secretAccessKey
        ? {
            accessKeyId: opts.accessKeyId,
            secretAccessKey: opts.secretAccessKey,
          }
        : undefined,
    })
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      Body: input.data,
      ContentType: input.contentType,
    }))
    return {
      key: input.key,
      url: this.publicUrl(input.key),
      contentType: input.contentType,
      size: input.data.byteLength,
    }
  }

  async getObject(key: string): Promise<RetrievedObject | null> {
    try {
      const out = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }))
      if (!out.Body) return null
      const data = await streamToBuffer(out.Body as NodeJS.ReadableStream)
      return {
        data,
        contentType: out.ContentType ?? 'application/octet-stream',
        size: Number(out.ContentLength ?? data.byteLength),
      }
    } catch {
      return null
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }))
  }

  publicUrl(key: string): string {
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl}/${encodeURIComponent(key)}`
    }
    return `s3://${this.bucket}/${key}`
  }
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
