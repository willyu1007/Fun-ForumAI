import fs from 'node:fs'
import path from 'node:path'
import type { ScenePoolCatalog } from '../stage/index.js'
import {
  buildStageTemplateDistPayload,
  readYamlFile,
} from '../stage/stage-template-ops.js'

const DEFAULT_DIST_DIR = path.resolve(process.cwd(), 'docs/stage-templates/dist')
const DEFAULT_LAUNCH_PATH = path.resolve(process.cwd(), 'docs/stage-templates/dist/launch.json')
const DEFAULT_LIBRARY_PATH = path.resolve(process.cwd(), 'docs/stage-templates/dist/library.json')
const DEFAULT_SOURCE_BASE_DIR = path.resolve(process.cwd(), 'docs/stage-templates/source')
const DEFAULT_MANIFEST_PATH = path.resolve(DEFAULT_SOURCE_BASE_DIR, 'manifest.yaml')

interface PublicSceneCatalogServiceOptions {
  launchPath?: string
  libraryPath?: string
  sourceBaseDir?: string
  manifestPath?: string
}

export class PublicSceneCatalogService {
  private cached: { mtime_ms: number; catalog: ScenePoolCatalog | null } | null = null

  private readonly launchPath: string
  private readonly libraryPath: string
  private readonly sourceBaseDir: string
  private readonly manifestPath: string

  constructor(options: PublicSceneCatalogServiceOptions = {}) {
    this.launchPath = options.launchPath ?? DEFAULT_LAUNCH_PATH
    this.libraryPath = options.libraryPath ?? DEFAULT_LIBRARY_PATH
    this.sourceBaseDir = options.sourceBaseDir ?? DEFAULT_SOURCE_BASE_DIR
    this.manifestPath = options.manifestPath ?? DEFAULT_MANIFEST_PATH
  }

  getLaunchCatalog(): ScenePoolCatalog | null {
    const cached = this.readLaunchCatalogFromDisk()
    if (cached) {
      return cached
    }

    const rebuilt = this.rebuildLaunchCatalogFromSource()
    if (rebuilt) {
      this.cached = null
      return this.readLaunchCatalogFromDisk()
    }

    this.cached = null
    return null
  }

  private readLaunchCatalogFromDisk(): ScenePoolCatalog | null {
    try {
      const stat = fs.statSync(this.launchPath)
      if (this.cached && this.cached.mtime_ms === stat.mtimeMs) {
        return this.cached.catalog
      }

      const raw = fs.readFileSync(this.launchPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<ScenePoolCatalog> & Record<string, unknown>
      const catalog = normalizeCatalog(parsed)
      this.cached = { mtime_ms: stat.mtimeMs, catalog }
      return catalog
    } catch {
      return null
    }
  }

  private rebuildLaunchCatalogFromSource(): boolean {
    try {
      if (!fs.existsSync(this.manifestPath)) {
        return false
      }

      const manifest = readYamlFile(this.manifestPath)
      const distPayload = buildStageTemplateDistPayload(
        this.sourceBaseDir,
        manifest,
        new Date().toISOString(),
      )
      fs.mkdirSync(path.dirname(this.launchPath) || DEFAULT_DIST_DIR, { recursive: true })
      fs.writeFileSync(this.libraryPath, `${JSON.stringify(distPayload.library, null, 2)}\n`, 'utf8')
      fs.writeFileSync(this.launchPath, `${JSON.stringify(distPayload.launch, null, 2)}\n`, 'utf8')
      return true
    } catch {
      return false
    }
  }
}

function normalizeCatalog(value: Partial<ScenePoolCatalog> & Record<string, unknown>): ScenePoolCatalog | null {
  return (
    value.version === 'v2'
    && value.contract_version === 'public_director_contract_v1'
    && Array.isArray(value.stage_templates)
    && Array.isArray(value.scene_bindings)
  )
    ? (value as ScenePoolCatalog)
    : null
}
