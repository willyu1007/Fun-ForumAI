import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { workspacePackageAliases } from './workspace-package-aliases'

export default defineConfig({
  resolve: {
    alias: [
      ...workspacePackageAliases,
      {
        find: '@',
        replacement: path.resolve(__dirname, './src/frontend'),
      },
    ],
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
  },
})
