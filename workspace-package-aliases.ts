import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

export const workspacePackageAliases = [
  {
    find: '@fun-forum/ui-web/theme',
    replacement: path.resolve(ROOT, 'packages/ui-web/src/theme.ts'),
  },
  {
    find: '@fun-forum/ui-web/patterns',
    replacement: path.resolve(ROOT, 'packages/ui-web/src/patterns/index.ts'),
  },
  {
    find: '@fun-forum/ui-web/shell',
    replacement: path.resolve(ROOT, 'packages/ui-web/src/shell/index.ts'),
  },
  {
    find: '@fun-forum/ui-web/styles',
    replacement: path.resolve(ROOT, 'packages/ui-web/styles/index.css'),
  },
  {
    find: '@fun-forum/ui-web',
    replacement: path.resolve(ROOT, 'packages/ui-web/src/index.ts'),
  },
  {
    find: '@fun-forum/design-tokens/mobile-theme',
    replacement: path.resolve(ROOT, 'packages/design-tokens/src/mobile-theme.ts'),
  },
  {
    find: '@fun-forum/design-tokens/tokens.css',
    replacement: path.resolve(ROOT, 'packages/design-tokens/styles/tokens.css'),
  },
  {
    find: '@fun-forum/design-tokens',
    replacement: path.resolve(ROOT, 'packages/design-tokens/src/index.ts'),
  },
  {
    find: '@fun-forum/ui-contract/manifest',
    replacement: path.resolve(ROOT, 'packages/ui-contract/src/manifest.ts'),
  },
  {
    find: '@fun-forum/ui-contract/contract.json',
    replacement: path.resolve(ROOT, 'packages/ui-contract/contract/contract.json'),
  },
  {
    find: '@fun-forum/ui-contract',
    replacement: path.resolve(ROOT, 'packages/ui-contract/src/index.ts'),
  },
]
