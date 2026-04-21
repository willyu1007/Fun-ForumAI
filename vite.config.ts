import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { workspacePackageAliases } from './workspace-package-aliases.js'

type BundleChunkGroup = {
  name: string
  packages: string[]
}

type AppChunkGroup = {
  name: string
  paths: string[]
}

type BundleBudgetConfig = {
  reportPath: string
  fallbackVendorChunkName?: string
  manualChunkGroups: BundleChunkGroup[]
}

type BundleAsset = {
  type: 'asset'
  fileName: string
}

type BundleChunk = {
  type: 'chunk'
  name: string
  fileName: string
  isEntry: boolean
  isDynamicEntry: boolean
  facadeModuleId: string | null
  imports: string[]
  dynamicImports: string[]
  modules: Record<string, unknown>
}

type BundleOutput = BundleAsset | BundleChunk

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url))
const bundleBudgetConfig = JSON.parse(
  readFileSync(path.resolve(ROOT_DIR, 'ui/config/bundle-budget.json'), 'utf8'),
) as BundleBudgetConfig

const appChunkGroups: AppChunkGroup[] = [
  {
    name: 'auth-pages',
    paths: [
      'src/frontend/features/auth/pages/LoginPage.tsx',
      'src/frontend/features/auth/pages/RegisterPage.tsx',
      'src/frontend/features/auth/components/',
    ],
  },
  {
    name: 'dev-toolbar',
    paths: [
      'src/frontend/widgets/dev/DevBadgeDebugPanel.tsx',
      'src/frontend/widgets/dev/DevFrontendFlagsPanel.tsx',
      'src/frontend/widgets/dev/DevGuidancePanel.tsx',
      'src/frontend/widgets/dev/DevKickoffPanel.tsx',
    ],
  },
  {
    name: 'agent-create-wizard',
    paths: [
      'src/frontend/features/agents/components/AgentCreateWizard.tsx',
      'src/frontend/features/agents/persona-seeds.ts',
      'src/shared/agent-persona-catalog.ts',
    ],
  },
  {
    name: 'agent-modal-panels',
    paths: [
      'src/frontend/features/agents/components/modal/TabChat.tsx',
      'src/frontend/features/agents/components/modal/TabHistory.tsx',
      'src/frontend/features/agents/components/modal/TabMoments.tsx',
      'src/frontend/features/agents/components/modal/TabSocial.tsx',
      'src/frontend/widgets/shell/LeftRailAgentDisplayEditor.tsx',
    ],
  },
  {
    name: 'screenshot-cropper',
    paths: ['src/frontend/features/private-chat/components/ScreenshotCropper.tsx'],
  },
  {
    name: 'admin-runtime-dashboard',
    paths: ['src/frontend/features/admin/components/RuntimeDashboard.tsx'],
  },
  {
    name: 'admin-programming',
    paths: ['src/frontend/features/admin/pages/admin-panel/ProgrammingTab.tsx'],
  },
  {
    name: 'admin-hot-topic',
    paths: ['src/frontend/features/admin/pages/admin-panel/HotTopicTab.tsx'],
  },
  {
    name: 'admin-feedback',
    paths: ['src/frontend/features/admin/pages/admin-panel/FeedbackInboxTab.tsx'],
  },
  {
    name: 'admin-users',
    paths: ['src/frontend/features/admin/pages/admin-panel/AdminUsersTab.tsx'],
  },
  {
    name: 'admin-invite-codes',
    paths: ['src/frontend/features/admin/pages/admin-panel/InviteCodesTab.tsx'],
  },
  {
    name: 'admin-warmup',
    paths: ['src/frontend/features/admin/pages/admin-panel/WarmupGovernanceTab.tsx'],
  },
]

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
  const normalized = normalizeModuleId(id)
  if (normalized) {
    for (const group of appChunkGroups) {
      if (
        group.paths.some(
          (pathPrefix) =>
            normalized === pathPrefix || normalized.startsWith(pathPrefix),
        )
      ) {
        return group.name
      }
    }
  }

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
    writeBundle(_options, bundle) {
      const bundleEntries = Object.values(bundle as Record<string, BundleOutput>)

      const jsChunks = bundleEntries
        .filter((item): item is BundleChunk => item.type === 'chunk')
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

      const assets = bundleEntries
        .filter((item): item is BundleAsset => item.type === 'asset')
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
        replacement: path.resolve(ROOT_DIR, './src/frontend'),
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
