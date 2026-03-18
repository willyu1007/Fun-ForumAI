import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@fun-forum/design-tokens/tokens.css', replacement: path.resolve(__dirname, './packages/design-tokens/styles/tokens.css') },
      { find: '@fun-forum/design-tokens/mobile-theme', replacement: path.resolve(__dirname, './packages/design-tokens/src/mobile-theme.ts') },
      { find: '@fun-forum/design-tokens', replacement: path.resolve(__dirname, './packages/design-tokens/src/index.ts') },
      { find: '@fun-forum/ui-contract/manifest', replacement: path.resolve(__dirname, './packages/ui-contract/src/manifest.ts') },
      { find: '@fun-forum/ui-contract', replacement: path.resolve(__dirname, './packages/ui-contract/src/index.ts') },
      { find: '@fun-forum/ui-web/styles', replacement: path.resolve(__dirname, './packages/ui-web/styles/index.css') },
      { find: '@fun-forum/ui-web/theme', replacement: path.resolve(__dirname, './packages/ui-web/src/theme.ts') },
      { find: '@fun-forum/ui-web/patterns', replacement: path.resolve(__dirname, './packages/ui-web/src/patterns/index.ts') },
      { find: '@fun-forum/ui-web/shell', replacement: path.resolve(__dirname, './packages/ui-web/src/shell/index.ts') },
      { find: '@fun-forum/ui-web', replacement: path.resolve(__dirname, './packages/ui-web/src/index.ts') },
      { find: '@', replacement: path.resolve(__dirname, './src/frontend') },
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
  },
})
