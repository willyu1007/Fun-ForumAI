import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      '*.config.*',
      'packages/*/dist',
      'packages/*/src/generated/**',
      'ui/codegen/**',
    ],
  },
  {
    extends: [js.configs.recommended],
    files: ['scripts/**/*.mjs', 'ops/**/*.mjs', '.ai/scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', {
        allowConstantExport: true,
        extraHOCs: ['lazyWithDynamicImportRecovery'],
      }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  // Import boundary rules for packages
  {
    files: ['packages/design-tokens/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@fun-forum/*'], message: 'design-tokens should not depend on other @fun-forum packages' },
          { group: ['../../../src/frontend/*'], message: 'packages should not import from src/frontend' },
        ],
      }],
    },
  },
  {
    files: ['packages/ui-contract/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@fun-forum/*'], message: 'ui-contract should not depend on other @fun-forum packages' },
          { group: ['../../../src/frontend/*'], message: 'packages should not import from src/frontend' },
        ],
      }],
    },
  },
  {
    files: ['packages/ui-web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@fun-forum/ui-mobile'], message: 'ui-web should not depend on ui-mobile' },
          { group: ['../../../src/frontend/*'], message: 'packages should not import from src/frontend' },
        ],
      }],
    },
  },
  {
    files: ['packages/ui-mobile/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@fun-forum/ui-web'], message: 'ui-mobile should not depend on ui-web' },
          { group: ['../../../src/frontend/*'], message: 'packages should not import from src/frontend' },
        ],
      }],
    },
  },
  // Shared should not import from features
  {
    files: ['src/frontend/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/features/*', '../features/*', '../../features/*'], message: 'shared should not depend on features' },
        ],
      }],
    },
  },
  // Discourage uix* usage in new code (warning for now, will become error after migration)
  {
    files: ['src/frontend/**/*.{ts,tsx}'],
    ignores: ['src/frontend/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['warn', {
        paths: [
          { name: '@/shared/utils/uix', message: 'Prefer using data-ui attributes and pattern components from @fun-forum/ui-web' },
          { name: '@/shared/utils/uix-shell', message: 'Prefer using AppShell and pattern components from @fun-forum/ui-web' },
          { name: '@/shared/utils/uix-primitives', message: 'Prefer using primitives with data-ui attributes' },
        ],
      }],
    },
  },
  // T-212 invariants I-2 / I-3: PostScheduler and CueWorker stay isolated.
  // I-2 is also enforced by the grep-based vitest at
  //   src/backend/runtime/__tests__/post-scheduler-cue-isolation.test.ts
  // (post-scheduler.ts must not import cue tables / domain). I-3 belongs to
  // T-212: cue-worker* / programming/cue/* must not import the post
  // scheduler so a future double-track regression is caught at lint time.
  {
    files: [
      'src/backend/runtime/public-discussion-cue-worker*.{ts,tsx}',
      'src/backend/programming/cue/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              '*post-scheduler*',
              '../runtime/post-scheduler',
              '../../runtime/post-scheduler',
              '../runtime/post-scheduler.js',
              '../../runtime/post-scheduler.js',
            ],
            message:
              'T-212 invariant I-3: cue worker / programming.cue must not import PostScheduler. See dev-docs/active/post-scheduler-boundary/02-architecture.md §E.',
          },
        ],
      }],
    },
  },
  // Mobile app should consume the generated package theme directly, not the legacy adapter.
  {
    files: ['apps/mobile/src/**/*.{ts,tsx}'],
    ignores: ['apps/mobile/src/theme.ts', 'apps/mobile/src/__tests__/theme.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: [
              '../theme',
              '../theme.ts',
              './theme',
              './theme.ts',
              '../../theme',
              '../../theme.ts',
            ],
            message: 'Use @fun-forum/ui-mobile/theme instead of the legacy apps/mobile theme adapter',
          },
        ],
      }],
    },
  },
)
