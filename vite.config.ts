import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { OutputAsset, OutputBundle, OutputChunk } from 'rollup'
import { workspacePackageAliases } from './workspace-package-aliases'

type BundleChunkGroup = {
  name: string
  packages: string[]
}

type BundleBudgetConfig = {
  reportPath: string
  fallbackVendorChunkName?: string
  manualChunkGroups: BundleChunkGroup[]
}

const ROOT_DIR = __dirname
const bundleBudgetConfig = JSON.parse(
  readFileSync(path.resolve(ROOT_DIR, 'ui/config/bundle-budget.json'), 'utf8'),
) as BundleBudgetConfig

function normalizeModuleId(id: string | null | undefined): string | null {
  if (!id) {
    return null
  }

  const normalized = id.split('?')[0]!.replace(/\\/g, '/')
  const rootNormalized = ROOT_DIR.replace(/\\/g, '/')
  if (normalized.startsWith(`${rootNormalized}/`)) {
    return normalized.slice(rootNormalized.length + 1)
  }

  return normalized
}

function getNodeModulesPackageName(id: string): string | null {
  const normalized = id.replace(/\\/g, '/')
  const nodeModulesIndex = normalized.lastIndexOf('/node_modules/')
  if (nodeModulesIndex === -1) {
    return null
  }

  let remainder = normalized.slice(nodeModulesIndex + '/node_modules/'.length)
  if (remainder.startsWith('.pnpm/')) {
    const pnpmNodeModulesIndex = remainder.indexOf('/node_modules/')
    if (pnpmNodeModulesIndex === -1) {
      return null
    }
    remainder = remainder.slice(pnpmNodeModulesIndex + '/node_modules/'.length)
  }

  if (remainder.startsWith('@')) {
    const [scope, name] = remainder.split('/')
    return scope && name ? `${scope}/${name}` : null
  }

  return remainder.split('/')[0] ?? null
}

function resolveManualChunk(id: string): string | undefined {
  const packageName = getNodeModulesPackageName(id)
  if (!packageName) {
    return undefined
  }

  for (const group of bundleBudgetConfig.manualChunkGroups) {
    if (
      group.packages.some(
        (packagePrefix) =>
          packageName === packagePrefix || packageName.startsWith(`${packagePrefix}/`),
      )
    ) {
      return group.name
    }
  }

  return bundleBudgetConfig.fallbackVendorChunkName
}

function createBundleReportPlugin(): Plugin {
  let buildOutDir = path.resolve(ROOT_DIR, 'dist/frontend')

  return {
    name: 'bundle-report',
    apply: 'build',
    configResolved(config) {
      buildOutDir = path.resolve(ROOT_DIR, config.build.outDir)
    },
    writeBundle(_options, bundle: OutputBundle) {
      const jsChunks = Object.values(bundle)
        .filter((item): item is OutputChunk => item.type === 'chunk')
        .map((chunk) => {
          const outputBuffer = readFileSync(path.resolve(buildOutDir, chunk.fileName))
          return {
            name: chunk.name,
            fileName: chunk.fileName,
            rawBytes: outputBuffer.byteLength,
            gzipBytes: gzipSync(outputBuffer).byteLength,
            isEntry: chunk.isEntry,
            isDynamicEntry: chunk.isDynamicEntry,
            facadeModuleId: normalizeModuleId(chunk.facadeModuleId),
            imports: [...chunk.imports].sort(),
            dynamicImports: [...chunk.dynamicImports].sort(),
            moduleIds: Object.keys(chunk.modules)
              .map((moduleId) => normalizeModuleId(moduleId))
              .filter((moduleId): moduleId is string => Boolean(moduleId))
              .sort(),
          }
        })
        .sort((left, right) => right.rawBytes - left.rawBytes)

      const assets = Object.values(bundle)
        .filter((item): item is OutputAsset => item.type === 'asset')
        .map((asset) => {
          const outputBuffer = readFileSync(path.resolve(buildOutDir, asset.fileName))
          const rawBytes = outputBuffer.byteLength
          return {
            fileName: asset.fileName,
            rawBytes,
            gzipBytes: gzipSync(outputBuffer).byteLength,
          }
        })
        .sort((left, right) => right.rawBytes - left.rawBytes)

      const report = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        jsChunks,
        assets,
      }

      const reportFilePath = path.resolve(ROOT_DIR, bundleBudgetConfig.reportPath)
      mkdirSync(path.dirname(reportFilePath), { recursive: true })
      writeFileSync(reportFilePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), createBundleReportPlugin()],
  resolve: {
    alias: [
      ...workspacePackageAliases,
      {
        find: '@',
        replacement: path.resolve(__dirname, './src/frontend'),
      },
    ],
  },
  server: {
    port: 3000,
    proxy: {
      '/v1': { target: 'http://localhost:4000', changeOrigin: true },
      '/health': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist/frontend',
    rollupOptions: {
      output: {
        manualChunks(id) {
          return resolveManualChunk(id)
        },
      },
    },
  },
})
