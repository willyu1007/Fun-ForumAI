import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { workspacePackageAliases } from './workspace-package-aliases.js'

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      ...workspacePackageAliases,
      {
        find: '@',
        replacement: path.resolve(ROOT_DIR, './src/frontend'),
      },
    ],
  },
  test: {
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'ops/**/*.{test,spec}.{ts,tsx}',
      'scripts/**/*.{test,spec}.{ts,tsx}',
    ],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/vitest.setup.ts'],
  },
})
