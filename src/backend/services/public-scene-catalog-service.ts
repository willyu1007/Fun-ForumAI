import fs from 'node:fs'
import path from 'node:path'
import type { ScenePoolCatalog } from '../stage/index.js'
import { config } from '../lib/config.js'

const DEFAULT_LAUNCH_PATH = path.resolve(process.cwd(), 'docs/stage-templates/dist/launch.json')

export class PublicSceneCatalogService {
  private cached: { mtime_ms: number; catalog: ScenePoolCatalog | null } | null = null

  constructor(private readonly launchPath = DEFAULT_LAUNCH_PATH) {}

  getLaunchCatalog(): ScenePoolCatalog | null {
    if (!(config.features.publicDirectorContractV1 && config.features.scenePoolAssetOpsV1)) {
      return null
    }

    try {
      const stat = fs.statSync(this.launchPath)
      if (this.cached && this.cached.mtime_ms === stat.mtimeMs) {
        return this.cached.catalog
      }

      const raw = fs.readFileSync(this.launchPath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<ScenePoolCatalog> & Record<string, unknown>
      const catalog = (
        parsed.version === 'v2'
        && parsed.contract_version === 'public_director_contract_v1'
        && Array.isArray(parsed.stage_templates)
        && Array.isArray(parsed.scene_bindings)
      )
        ? (parsed as ScenePoolCatalog)
        : null

      this.cached = { mtime_ms: stat.mtimeMs, catalog }
      return catalog
    } catch {
      this.cached = null
      return null
    }
  }
}
